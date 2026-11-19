import io
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.test import TestCase, TransactionTestCase, override_settings
from django.db import close_old_connections
from django.http import Http404
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.exceptions import PermissionDenied, ValidationError
from PIL import Image
from auditoria.models import RegistroActividad
from auditoria.consultas import actividad_modulos
from clientes.models import Cliente
from usuarios.models import Usuario
from cobros.models import Cobro, ComprobanteCobro
from cobros.consultas import representar_saldo
from cobros.servicios import registrar_cobro, ConflictoCobro
from cobros.tests import DatosCobros
from .models import AvisoPago, ComprobanteAvisoPago, OperacionPago
from .servicios import revisar_informe, informar_pago, revisar_verificacion, decidir_pago


def comprobante(color='white'):
    salida = io.BytesIO()
    Image.new('RGB', (16, 16), color).save(salida, 'PNG')
    return SimpleUploadedFile('pago.png', salida.getvalue(), 'image/png')


class PruebasPagos(DatosCobros, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()
        cls.responsable = Usuario.objects.create_user(email='pagador@pruebas.test', cedula_identidad='83101')
        cls.responsable.user_permissions.set(Permission.objects.filter(content_type__app_label='pagos', codename__in=['consultar_pagos_propios', 'informar_pagos_propios']))
        cls.cliente.encargado_pagos = cls.responsable
        cls.cliente.save()
        cls.otra_cuenta = Usuario.objects.create_user(email='otro-pagador@pruebas.test', cedula_identidad='83102')
        cls.otra_cuenta.user_permissions.set(cls.responsable.user_permissions.all())
        cls.ajeno.encargado_pagos = cls.otra_cuenta
        cls.ajeno.save()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)
        self.propio = APIClient()
        self.propio.force_authenticate(self.responsable)

    def entrada(self, venta, importe='100.00', **cambios):
        return self.datos([venta], [importe], medio='transferencia', referencia='', **cambios)

    def crear_aviso(self, venta=None, importe='100.00'):
        venta = venta or self.venta('109.50')
        archivo = comprobante()
        datos = self.entrada(venta, importe)
        datos['revision'] = revisar_informe(self.responsable, datos, archivo)['revision']
        return informar_pago(self.responsable, datos, archivo), datos, archivo

    def decision(self, aviso, **cambios):
        return {'clave_operacion': str(uuid.uuid4()), 'version': str(aviso.version), **cambios}

    def confirmar(self, aviso):
        datos = self.decision(aviso)
        datos['revision'] = revisar_verificacion(self.actor, aviso.pk, datos)['revision']
        return decidir_pago(self.actor, aviso.pk, 'confirmar', datos), datos

    def test_informar_no_cobra_y_confirmar_crea_un_unico_cobro_con_comprobante(self):
        venta = self.venta('109.50')
        aviso, _, _ = self.crear_aviso(venta)
        self.assertEqual((Cobro.objects.count(), ComprobanteCobro.objects.count()), (0, 0))
        self.assertEqual(representar_saldo(venta)['saldo'], '109.50')
        fila = self.propio.get('/api/v1/mis-pagos/ventas/').data['results'][0]
        self.assertEqual((fila['saldo'], fila['por_verificar']), ('109.50', '100.00'))
        confirmado, datos = self.confirmar(aviso)
        self.assertEqual(confirmado.estado, 'confirmado')
        self.assertEqual(Cobro.objects.count(), 1)
        self.assertEqual(representar_saldo(venta)['saldo'], '9.50')
        self.assertEqual(bytes(confirmado.archivo_comprobante.contenido), bytes(confirmado.cobro.archivo_comprobante.contenido))
        repetida = decidir_pago(self.actor, aviso.pk, 'confirmar', datos)
        self.assertEqual(repetida.cobro_id, confirmado.cobro_id)
        self.assertEqual(OperacionPago.objects.count(), 1)
        self.assertEqual(actividad_modulos().filter(modulo='cobros', accion='registrar').count(), 1)
        self.assertEqual(actividad_modulos().filter(modulo='pagos', accion='confirmar').count(), 0)

    def test_observar_con_motivo_no_modifica_deuda_y_es_inmutable(self):
        aviso, _, _ = self.crear_aviso()
        datos = self.decision(aviso)
        with self.assertRaises(ValidationError):
            decidir_pago(self.actor, aviso.pk, 'observar', datos)
        datos['motivo'] = 'El depósito no aparece en la cuenta de la empresa.'
        observado = decidir_pago(self.actor, aviso.pk, 'observar', datos)
        self.assertEqual(observado.estado, 'observado')
        self.assertEqual(Cobro.objects.count(), 0)
        self.assertEqual(decidir_pago(self.actor, aviso.pk, 'observar', datos).pk, aviso.pk)
        with self.assertRaises(ConflictoCobro):
            decidir_pago(self.actor, aviso.pk, 'observar', {**datos, 'motivo': 'Otro motivo'})
        with self.assertRaises(ConflictoCobro):
            self.confirmar(observado)
        for metodo in ['patch', 'delete']:
            self.assertEqual(getattr(self.propio, metodo)(f'/api/v1/mis-pagos/{aviso.pk}/', {}, format='json').status_code, 405)

    def test_solo_ventas_y_avisos_propios_antes_de_filtros_conteos_y_descarga(self):
        venta_propia = self.venta()
        self.venta('900.00', cliente=self.ajeno)
        aviso, _, _ = self.crear_aviso(venta_propia, '20.00')
        ajeno = APIClient(); ajeno.force_authenticate(self.otra_cuenta)
        for ruta in [f'/api/v1/mis-pagos/{aviso.pk}/', f'/api/v1/mis-pagos/{aviso.pk}/aplicaciones/', f'/api/v1/mis-pagos/{aviso.pk}/comprobante/']:
            self.assertEqual(ajeno.get(ruta).status_code, 404)
        self.assertEqual(ajeno.get('/api/v1/mis-pagos/', {'cliente': self.cliente.pk}).data['count'], 0)
        self.assertEqual(self.propio.get('/api/v1/mis-pagos/ventas/').data['count'], 1)
        self.assertEqual(self.propio.get('/api/v1/mis-pagos/ventas/', {'cliente': self.ajeno.pk}).status_code, 404)
        self.assertEqual(self.propio.get('/api/v1/mis-pagos/clientes/').data['count'], 1)
        with self.assertRaises(Http404):
            revisar_informe(self.otra_cuenta, self.entrada(venta_propia, '10.00'), comprobante())

    def test_mismos_uuid_cuerpo_actor_archivo_y_revocacion_en_reintentos(self):
        aviso, datos, archivo = self.crear_aviso()
        self.assertEqual(informar_pago(self.responsable, datos, archivo).pk, aviso.pk)
        with self.assertRaises(ConflictoCobro):
            informar_pago(self.responsable, datos, comprobante('red'))
        self.responsable.user_permissions.clear()
        with self.assertRaises(PermissionDenied):
            informar_pago(self.responsable, datos, archivo)
        self.assertEqual(AvisoPago.objects.count(), 1)

    def test_saldos_cambiados_despues_de_revisar_bloquean_confirmacion(self):
        venta = self.venta('200.00')
        aviso, _, _ = self.crear_aviso(venta, '100.00')
        datos = self.decision(aviso)
        datos['revision'] = revisar_verificacion(self.actor, aviso.pk, datos)['revision']
        registrar_cobro(self.actor, self.revisar(self.datos([venta], ['10.00'])))
        with self.assertRaises(ConflictoCobro):
            decidir_pago(self.actor, aviso.pk, 'confirmar', datos)
        aviso.refresh_from_db()
        self.assertEqual(aviso.estado, 'por_verificar')
        self.assertEqual(Cobro.objects.count(), 1)

    def test_error_auditoria_revierte_confirmacion_y_cobro(self):
        aviso, _, _ = self.crear_aviso()
        datos = self.decision(aviso)
        datos['revision'] = revisar_verificacion(self.actor, aviso.pk, datos)['revision']
        with patch('pagos.servicios.registrar_actividad', side_effect=RuntimeError('Prueba')):
            with self.assertRaises(RuntimeError):
                decidir_pago(self.actor, aviso.pk, 'confirmar', datos)
        aviso.refresh_from_db()
        self.assertEqual(aviso.estado, 'por_verificar')
        self.assertEqual((Cobro.objects.count(), ComprobanteCobro.objects.count(), OperacionPago.objects.count()), (0, 0, 0))

    def test_cliente_inactivo_con_deuda_y_multiples_pagos_parciales(self):
        Cliente.objects.filter(pk=self.cliente.pk).update(activo=False)
        venta = self.venta('109.50')
        primero, _, _ = self.crear_aviso(venta, '100.00')
        self.confirmar(primero)
        segundo, _, _ = self.crear_aviso(venta, '9.50')
        self.confirmar(segundo)
        self.assertEqual(representar_saldo(venta)['saldo'], '0.00')
        self.assertEqual(self.propio.get('/api/v1/mis-pagos/ventas/').data['count'], 0)
        self.assertEqual(self.propio.get('/api/v1/mis-pagos/ventas/?historial=1').data['count'], 1)

    def test_responsable_no_puede_autoconfirmarse_con_permisos_globales_erroneos(self):
        aviso, _, _ = self.crear_aviso()
        self.responsable.user_permissions.add(*Permission.objects.filter(content_type__app_label__in=['pagos', 'cobros', 'ventas']))
        self.assertEqual(self.propio.get('/api/v1/pagos-por-verificar/').status_code, 403)
        self.assertEqual(self.propio.get('/api/v1/cobros/').status_code, 403)
        self.assertEqual(self.propio.get('/api/v1/ventas/').status_code, 403)
        with self.assertRaises(PermissionDenied):
            decidir_pago(self.responsable, aviso.pk, 'confirmar', self.decision(aviso))

    def test_http_multipart_csrf_y_https_solo_propios(self):
        navegador = APIClient(enforce_csrf_checks=True); navegador.force_login(self.responsable)
        datos = self.entrada(self.venta(), '10.00')
        self.assertEqual(navegador.post('/api/v1/mis-pagos/revisar/', {'datos': json.dumps(datos), 'comprobante': comprobante()}, format='multipart').status_code, 403)
        csrf = navegador.get('/api/v1/auth/csrf/').json()['csrfToken']
        revision = navegador.post('/api/v1/mis-pagos/revisar/', {'datos': json.dumps(datos), 'comprobante': comprobante()}, format='multipart', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(revision.status_code, 200, revision.data)
        datos['revision'] = revision.data['revision']
        aviso = navegador.post('/api/v1/mis-pagos/', {'datos': json.dumps(datos), 'comprobante': comprobante()}, format='multipart', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(aviso.status_code, 200, aviso.data)
        ruta = f"/api/v1/mis-pagos/{aviso.data['id']}/comprobante/"
        self.assertEqual(navegador.get(ruta).status_code, 200)
        self.assertEqual(ComprobanteAvisoPago.objects.count(), 1)
        with override_settings(ROOT_URLCONF='config.rutas_chofer_https'):
            self.assertEqual(navegador.get('/api/v1/mis-pagos/').status_code, 200)
            self.assertEqual(navegador.get('/api/v1/pagos-por-verificar/').status_code, 404)
            self.assertEqual(navegador.post(f"/api/v1/mis-pagos/{aviso.data['id']}/confirmar/", {}, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 404)
            self.assertFalse(navegador.get('/api/v1/auth/me/').data['permisos_pagos']['ver'])

    def test_paginacion_de_diez_y_sin_reservar_el_saldo(self):
        venta = self.venta('1000.00')
        for _ in range(12):
            self.crear_aviso(venta, '1.00')
        primera = self.propio.get('/api/v1/mis-pagos/?page_size=100').data
        self.assertEqual((primera['count'], len(primera['results']), primera['resumen']['por_verificar']), (12, 10, 12))
        self.assertEqual(len(self.propio.get('/api/v1/mis-pagos/?pagina=2').data['results']), 2)
        self.assertEqual(representar_saldo(venta)['saldo'], '1000.00')

    def test_promover_informante_no_permite_verificar_su_propio_aviso(self):
        aviso, _, _ = self.crear_aviso()
        Cliente.objects.filter(pk=self.cliente.pk).update(encargado_pagos=None)
        self.responsable.user_permissions.clear()
        self.responsable.user_permissions.add(*Permission.objects.filter(content_type__app_label__in=['pagos', 'cobros']).exclude(codename__in=['consultar_pagos_propios', 'informar_pagos_propios']))
        for accion in ['confirmar', 'observar']:
            with self.assertRaises(PermissionDenied):
                decidir_pago(self.responsable, aviso.pk, accion, self.decision(aviso, motivo='Revisión propia'))
        self.assertEqual(Cobro.objects.count(), 0)

    def test_permisos_de_consultar_observar_y_confirmar_separados_y_frescos(self):
        aviso, _, _ = self.crear_aviso()
        revisor = Usuario.objects.create_user(email='observador@pruebas.test', cedula_identidad='83103')
        revisor.user_permissions.set(Permission.objects.filter(content_type__app_label='pagos', codename__in=['view_avisopago', 'observar_avisopago']))
        with self.assertRaises(PermissionDenied):
            revisar_verificacion(revisor, aviso.pk, self.decision(aviso))
        datos = self.decision(aviso, motivo='No corresponde al movimiento bancario')
        decidir_pago(revisor, aviso.pk, 'observar', datos)
        revisor.user_permissions.clear()
        with self.assertRaises(PermissionDenied):
            decidir_pago(revisor, aviso.pk, 'observar', datos)
        self.assertEqual(Cobro.objects.count(), 0)


class PruebasConcurrenciaPagos(DatosCobros, TransactionTestCase):
    def setUp(self):
        self.preparar_datos()
        self.responsable = Usuario.objects.create_user(email='pagador-concurrente@pruebas.test', cedula_identidad='83104')
        self.responsable.user_permissions.set(Permission.objects.filter(content_type__app_label='pagos', codename__in=['consultar_pagos_propios', 'informar_pagos_propios']))
        self.cliente.encargado_pagos = self.responsable
        self.cliente.save()

    def aviso(self, venta):
        datos = self.datos([venta], ['70.00'], medio='transferencia', referencia='')
        archivo = comprobante()
        datos['revision'] = revisar_informe(self.responsable, datos, archivo)['revision']
        return informar_pago(self.responsable, datos, archivo)

    def decision(self, aviso):
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': str(aviso.version)}
        return {**datos, 'revision': revisar_verificacion(self.actor, aviso.pk, datos)['revision']}

    def ejecutar_dos(self, operaciones):
        barrera = Barrier(2)
        def ejecutar(operacion):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    aviso, accion, datos = operacion
                    return decidir_pago(actor, aviso.pk, accion, datos).pk
                except (ConflictoCobro, ValidationError):
                    return 'conflicto'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as grupo:
            return list(grupo.map(ejecutar, operaciones))

    def test_dos_confirmaciones_del_mismo_uuid_generan_un_cobro(self):
        venta = self.venta()
        aviso = self.aviso(venta)
        datos = self.decision(aviso)
        resultados = self.ejecutar_dos([(aviso, 'confirmar', datos)] * 2)
        self.assertEqual(resultados, [aviso.pk, aviso.pk])
        self.assertEqual((Cobro.objects.count(), OperacionPago.objects.count()), (1, 1))
        self.assertEqual(representar_saldo(venta)['saldo'], '30.00')

    def test_dos_avisos_no_pueden_cobrar_mas_que_el_saldo(self):
        venta = self.venta()
        primero, segundo = self.aviso(venta), self.aviso(venta)
        resultados = self.ejecutar_dos([(aviso, 'confirmar', self.decision(aviso)) for aviso in [primero, segundo]])
        self.assertEqual(resultados.count('conflicto'), 1)
        self.assertEqual((Cobro.objects.count(), OperacionPago.objects.count()), (1, 1))
        self.assertEqual(AvisoPago.objects.filter(estado='por_verificar').count(), 1)
        self.assertEqual(representar_saldo(venta)['saldo'], '30.00')

    def test_confirmar_y_observar_al_mismo_tiempo_admite_una_decision(self):
        venta = self.venta()
        aviso = self.aviso(venta)
        confirmar = self.decision(aviso)
        observar = {'clave_operacion': str(uuid.uuid4()), 'version': str(aviso.version), 'motivo': 'No se encuentra el ingreso'}
        resultados = self.ejecutar_dos([(aviso, 'confirmar', confirmar), (aviso, 'observar', observar)])
        self.assertEqual(resultados.count('conflicto'), 1)
        aviso.refresh_from_db()
        self.assertEqual(OperacionPago.objects.count(), 1)
        self.assertEqual(Cobro.objects.count(), int(aviso.estado == 'confirmado'))
        self.assertEqual(representar_saldo(venta)['saldo'], '30.00' if aviso.estado == 'confirmado' else '100.00')
