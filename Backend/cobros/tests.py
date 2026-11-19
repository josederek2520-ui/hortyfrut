import uuid
from datetime import timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from auditoria.consultas import actividad_modulos
from clientes.models import Cliente
from usuarios.models import Usuario
from ventas.models import Venta
from ventas.representaciones import representar
from .models import Cobro, AplicacionCobro
from .consultas import representar_saldo
from .servicios import registrar_cobro, revisar_cobro, ConflictoCobro


class DatosCobros:
    @classmethod
    def preparar_datos(cls):
        cls.actor = Usuario.objects.create_superuser(email='cobros@pruebas.test', cedula_identidad='72001')
        cls.cliente = Cliente.objects.create(razon_social='Supermercado de pruebas', nit='72001')
        cls.ajeno = Cliente.objects.create(razon_social='Otro cliente', nit='72002')
        cls.hoy = timezone.localdate()

    def venta(self, importe='100.00', cliente=None, estado='emitida'):
        cliente = cliente or self.cliente
        return Venta.objects.create(cliente=cliente, cliente_nombre=cliente.razon_social, cliente_nit=cliente.nit,
            estado=estado, desde=self.hoy, hasta=self.hoy, fecha_emision=self.hoy if estado == 'emitida' else None,
            emitido_en=timezone.now() if estado == 'emitida' else None, total=Decimal(importe),
            registrado_por=self.actor, registrado_por_nombre='Pruebas', emitido_por_nombre='Pruebas', peso_aceptado_kg=1)

    def datos(self, ventas, importes, **cambios):
        return {'clave_operacion': str(uuid.uuid4()), 'cliente': self.cliente.pk, 'fecha_cobro': str(self.hoy),
            'importe': format(sum(map(Decimal, importes)), '.2f'), 'medio': 'efectivo', 'referencia': 'REFERENCIA PRUEBA',
            'aplicaciones': [{'venta': venta.pk, 'importe': importe, 'version_saldo': representar_saldo(venta)['version_saldo']} for venta, importe in zip(ventas, importes)], **cambios}

    def revisar(self, datos, actor=None):
        return {**datos, 'revision': revisar_cobro(actor or self.actor, datos)['revision']}


class PruebasCobros(DatosCobros, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def test_varios_pagos_parciales_hasta_cubrir_exactamente_venta(self):
        venta = self.venta('1000.00')
        original = (venta.total, venta.actualizado_en, venta.estado, venta.empresa)
        for importe, saldo, estado in [('300.00','700.00','parcial'), ('200.00','500.00','parcial'), ('500.00','0.00','pagada')]:
            registrar_cobro(self.actor, self.revisar(self.datos([venta],[importe])))
            datos = representar(venta, False)
            self.assertEqual((datos['saldo'], datos['estado_cobro']), (saldo, estado))
        venta.refresh_from_db()
        self.assertEqual((venta.total, venta.actualizado_en, venta.estado, venta.empresa), original)
        self.assertEqual(Cobro.objects.count(), 3)
        self.assertEqual(self.client.get('/api/v1/cobros/ventas/', {'cliente': self.cliente.pk}).data['count'], 0)

    def test_pago_completo_y_centavos_exactos_distribuidos_en_varias_ventas(self):
        ventas = [self.venta('0.10'), self.venta('0.20')]
        datos = self.revisar(self.datos(ventas, ['0.10','0.20']))
        cobro = registrar_cobro(self.actor, datos)
        self.assertEqual(cobro.importe, Decimal('0.30'))
        self.assertEqual(sum((f.importe for f in cobro.aplicaciones.all()), Decimal(0)), cobro.importe)
        self.assertTrue(all(representar_saldo(v)['saldo'] == '0.00' for v in ventas))

    def test_revisar_no_crea_cobro_ni_reduce_saldo(self):
        venta = self.venta()
        self.revisar(self.datos([venta],['50.00']))
        self.assertEqual(Cobro.objects.count(), 0)
        self.assertEqual(representar_saldo(venta)['saldo'], '100.00')
        self.assertEqual(actividad_modulos().filter(modulo='cobros').count(), 0)

    def test_resumen_de_ventas_descuenta_cobros_parciales_y_queda_en_cero_al_pagar(self):
        venta = self.venta('109.50')
        self.venta('999.00', estado='borrador')
        registrar_cobro(self.actor, self.revisar(self.datos([venta], ['100.00'])))
        listado = self.client.get('/api/v1/ventas/').data
        self.assertEqual(listado['resumen'], {'total': '109.50', 'pendiente_cobro': '9.50', 'emitidas': 1, 'borradores': 1})
        self.assertEqual(next(f for f in listado['results'] if f['id'] == venta.pk)['saldo'], '9.50')
        registrar_cobro(self.actor, self.revisar(self.datos([venta], ['9.50'])))
        self.assertEqual(self.client.get('/api/v1/ventas/').data['resumen']['pendiente_cobro'], '0.00')

    def test_pendiente_resumen_respeta_filtros_y_todas_las_paginas(self):
        ventas = [self.venta('10.00') for _ in range(12)]
        self.venta('50.00', cliente=self.ajeno)
        self.venta('999.00', estado='cancelada')
        registrar_cobro(self.actor, self.revisar(self.datos([ventas[0]], ['3.00'])))
        self.assertEqual(self.client.get('/api/v1/ventas/').data['resumen']['pendiente_cobro'], '167.00')
        for pagina in [1, 2]:
            respuesta = self.client.get('/api/v1/ventas/', {'cliente': self.cliente.pk, 'estado': 'emitida', 'pagina': pagina}).data
            self.assertEqual(respuesta['resumen']['pendiente_cobro'], '117.00')
            self.assertEqual(respuesta['count'], 12)
        buscada = self.client.get('/api/v1/ventas/', {'buscar': ventas[0].codigo}).data
        self.assertEqual(buscada['resumen']['pendiente_cobro'], '7.00')
        for filtros in [{'estado': 'borrador'}, {'buscar': 'ninguna coincidencia'}, {'estado': 'cancelada'}]:
            self.assertEqual(self.client.get('/api/v1/ventas/', filtros).data['resumen']['pendiente_cobro'], '0.00')

    def test_rechaza_exceso_cliente_distinto_borrador_y_distribucion_inexacta(self):
        venta = self.venta()
        for datos in [self.datos([venta],['100.01']), self.datos([self.venta(cliente=self.ajeno)], ['10.00']),
                self.datos([self.venta(estado='borrador')], ['10.00']), self.datos([venta],['10.00'], importe='10.01')]:
            with self.subTest(datos=datos), self.assertRaises(ValidationError):
                self.revisar(datos)
        self.assertEqual(Cobro.objects.count(), 0)

    def test_validacion_importes_y_medio_fecha_referencia(self):
        venta = self.venta()
        for cambios in [{'importe': '0'}, {'importe':'1.001'}, {'importe':'-1'}, {'importe':'NaN'},
                {'importe':'10000000000000000.00'}, {'fecha_cobro': str(self.hoy + timedelta(days=1))},
                {'medio':'transferencia'}, {'medio':'deposito'}, {'medio':'cheque'}, {'medio':'inventado'}]:
            with self.subTest(cambios=cambios), self.assertRaises(ValidationError):
                self.revisar(self.datos([venta],['1.00'], **cambios))
        repetida = self.datos([venta,venta],['1.00','1.00'])
        with self.assertRaises(ValidationError):
            self.revisar(repetida)
        efectivo = self.datos([venta],['1.00'], medio='efectivo', referencia='')
        self.assertTrue(self.revisar(efectivo)['revision'])

    def test_uuid_cuerpo_responsable_y_revocacion_se_revalidan(self):
        venta = self.venta()
        operador = Usuario.objects.create_user(email='operador@cobros.test', cedula_identidad='72003')
        permisos = Permission.objects.filter(content_type__app_label='cobros')
        operador.user_permissions.set(permisos)
        datos = self.revisar(self.datos([venta],['20.00']), operador)
        cobro = registrar_cobro(operador, datos)
        self.assertEqual(registrar_cobro(operador, datos).pk, cobro.pk)
        with self.assertRaises(ConflictoCobro):
            registrar_cobro(operador, {**datos, 'referencia':'OTRO CUERPO'})
        with self.assertRaises(ConflictoCobro):
            registrar_cobro(self.actor, datos)
        operador.user_permissions.clear()
        with self.assertRaises(PermissionDenied):
            registrar_cobro(operador, datos)
        self.assertEqual(RegistroActividad.objects.filter(modulo='cobros', accion='registrar').count(), 1)

    def test_otro_cobro_cambia_version_y_exige_revisar_otra_vez(self):
        venta = self.venta()
        anterior = self.revisar(self.datos([venta],['70.00']))
        registrar_cobro(self.actor, self.revisar(self.datos([venta],['50.00'])))
        with self.assertRaises(ConflictoCobro):
            registrar_cobro(self.actor, anterior)
        self.assertEqual(representar_saldo(venta)['saldo'], '50.00')
        with self.assertRaises(ConflictoCobro):
            registrar_cobro(self.actor, self.datos([venta],['1.00']))

    def test_fallo_de_auditoria_revierte_cobro_y_aplicaciones(self):
        venta = self.venta()
        datos = self.revisar(self.datos([venta],['30.00']))
        with patch('cobros.servicios.registrar_actividad', side_effect=RuntimeError('Prueba')):
            with self.assertRaises(RuntimeError):
                registrar_cobro(self.actor, datos)
        self.assertEqual((Cobro.objects.count(), AplicacionCobro.objects.count()), (0,0))
        self.assertEqual(representar_saldo(venta)['saldo'], '100.00')

    def test_cliente_inactivo_puede_pagar_deuda_y_textos_historicos_no_cambian(self):
        venta = self.venta()
        Cliente.objects.filter(pk=self.cliente.pk).update(activo=False)
        self.assertEqual(self.client.get('/api/v1/cobros/clientes/').data['count'], 1)
        cobro = registrar_cobro(self.actor, self.revisar(self.datos([venta],['10.00'])))
        Cliente.objects.filter(pk=self.cliente.pk).update(razon_social='Nombre nuevo')
        cobro.refresh_from_db()
        self.assertEqual(cobro.cliente_nombre, 'Supermercado de pruebas')
        self.assertEqual(cobro.aplicaciones.get().saldo_posterior, Decimal('90.00'))

    def test_filtros_totales_y_paginacion_de_diez_antes_de_contar(self):
        venta = self.venta()
        for indice in range(12):
            registrar_cobro(self.actor, self.revisar(self.datos([venta],['1.00'], referencia=f'REF {indice}')))
        primera = self.client.get('/api/v1/cobros/?page_size=100')
        self.assertEqual((primera.data['count'], len(primera.data['results']), primera.data['total_cobrado']), (12,10,'12.00'))
        self.assertEqual(len(self.client.get('/api/v1/cobros/?pagina=2').data['results']), 2)
        filtrada = self.client.get('/api/v1/cobros/', {'buscar':'REF 11'})
        self.assertEqual((filtrada.data['count'], filtrada.data['total_cobrado']), (1,'1.00'))
        self.assertEqual(self.client.get('/api/v1/cobros/', {'venta': venta.pk}).data['count'], 12)
        saldos = self.client.get('/api/v1/ventas/').data['results'][0]
        self.assertEqual((saldos['cobrado'],saldos['saldo']), ('12.00','88.00'))

    def test_selector_y_aplicaciones_paginan_y_no_admiten_editar_confirmados(self):
        ventas = [self.venta() for _ in range(12)]
        seleccion = self.client.get('/api/v1/cobros/ventas/', {'cliente':self.cliente.pk,'page_size':500})
        self.assertEqual((seleccion.data['count'],len(seleccion.data['results'])), (12,10))
        cobro = registrar_cobro(self.actor, self.revisar(self.datos(ventas, ['1.00'] * 12)))
        self.assertEqual(len(self.client.get(f'/api/v1/cobros/{cobro.pk}/aplicaciones/').data['results']), 10)
        for metodo in ('patch','delete'):
            self.assertEqual(getattr(self.client,metodo)(f'/api/v1/cobros/{cobro.pk}/', {}, format='json').status_code,405)

    def test_http_csrf_y_permisos_separados_de_ventas(self):
        operador = Usuario.objects.create_user(email='consulta@cobros.test', cedula_identidad='72004')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='cobros',codename='view_cobro'))
        navegador = APIClient(enforce_csrf_checks=True); navegador.force_login(operador)
        venta = self.venta(); datos = self.datos([venta],['1.00'])
        self.assertEqual(navegador.get('/api/v1/cobros/').status_code, 200)
        self.assertEqual(navegador.get('/api/v1/ventas/').status_code, 403)
        self.assertEqual(navegador.post('/api/v1/cobros/revisar/', datos,format='json').status_code,403)
        operador.user_permissions.add(Permission.objects.get(codename='add_cobro'))
        self.assertEqual(navegador.post('/api/v1/cobros/',datos,format='json').status_code,403)
        csrf = navegador.get('/api/v1/auth/csrf/').json()['csrfToken']
        respuesta = navegador.post('/api/v1/cobros/revisar/',datos,format='json',HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code,200,respuesta.data)
        respuesta = navegador.post('/api/v1/cobros/',{**datos,'revision':respuesta.data['revision']},format='json',HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code,200,respuesta.data)

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_cobros_y_empresa_no_se_publican_por_https(self):
        for ruta in ['/api/v1/cobros/','/api/v1/datos-empresa/']:
            self.assertEqual(self.client.get(ruta).status_code,404)
        sesion = self.client.get('/api/v1/auth/me/').data
        self.assertFalse(any(sesion['permisos_cobros'].values()))
        self.assertFalse(any(sesion['permisos_empresa'].values()))


class PruebasConcurrenciaCobros(DatosCobros, TransactionTestCase):
    def setUp(self):
        self.preparar_datos()

    def ejecutar_dos(self, datos):
        barrera = Barrier(2)
        def ejecutar(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    return registrar_cobro(actor,datos[indice]).pk
                except ConflictoCobro:
                    return 'conflicto'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as grupo:
            return list(grupo.map(ejecutar,range(2)))

    def test_dos_pagos_concurrentes_no_superan_saldo(self):
        venta = self.venta()
        datos = [self.revisar(self.datos([venta],['70.00'])) for _ in range(2)]
        resultados = self.ejecutar_dos(datos)
        self.assertEqual(resultados.count('conflicto'),1)
        self.assertEqual(representar_saldo(venta)['saldo'],'30.00')

    def test_mismo_uuid_concurrente_registra_una_vez(self):
        venta = self.venta(); datos = self.revisar(self.datos([venta],['50.00']))
        resultados = self.ejecutar_dos([datos,datos])
        self.assertEqual(resultados[0],resultados[1])
        self.assertEqual((Cobro.objects.count(),AplicacionCobro.objects.count()),(1,1))
