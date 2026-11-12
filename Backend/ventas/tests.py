import uuid
from decimal import Decimal
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from auditoria.consultas import actividad_modulos
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla
from clientes.models import Cliente
from usuarios.models import Usuario
from precios.tests import DatosPrecios
from .models import Venta, LineaVenta, AporteVenta, EntregaVenta, OperacionVenta
from .consultas import version_venta, revisar_venta, calcular_entrega
from .calculos import calcular_importes
from .servicios import guardar, actuar, ConflictoVenta
from .representaciones import representar, lineas_emitidas
from .documentos import generar_resumen_pdf


class DatosVentas(DatosPrecios):
    def datos_venta(self, entrega=None, **cambios):
        return {'clave_operacion': str(uuid.uuid4()), 'version': '', 'cliente': self.cliente.pk,
            'desde': str(self.hoy), 'hasta': str(self.hoy), 'vencimiento': None,
            'entregas': [entrega.pk] if entrega else [], **cambios}

    def accion_venta(self, venta, **cambios):
        venta.refresh_from_db()
        return {'clave_operacion': str(uuid.uuid4()), 'version': version_venta(venta), 'revision': revisar_venta(venta)['revision'], **cambios}

    def preparar_venta(self):
        entrega = self.preparar_entrega_confirmada()
        self.aceptado()
        return entrega, guardar(self.actor, self.datos_venta(entrega))


class PruebasVentas(DatosVentas, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()

    def test_borrador_no_reserva_ni_mueve_y_guardado_igual_no_cuenta_actividad(self):
        entrega, venta = self.preparar_venta()
        movimientos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        self.assertFalse(EntregaVenta.objects.exists())
        datos = self.datos_venta(entrega, version=version_venta(venta))
        original = version_venta(venta)
        guardar(self.actor, datos, venta.pk)
        venta.refresh_from_db()
        self.assertEqual(version_venta(venta), original)
        self.assertEqual(actividad_modulos().filter(modulo='ventas').count(), 1)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (movimientos, cajillas))
        self.assertEqual(self.client.get(f'/api/v1/ventas/entregas/?cliente={self.cliente.pk}').data['count'], 1)

    def test_emision_exacta_inmutable_y_entrega_no_se_repite(self):
        entrega, venta = self.preparar_venta()
        original = entrega.origen.copy()
        movimientos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        datos = self.accion_venta(venta)
        venta = actuar(self.actor, venta.pk, 'emitir', datos)
        self.assertEqual(venta.total, sum((f.importe for f in venta.lineas.all()), Decimal(0)))
        self.assertEqual(sum((a.importe for a in AporteVenta.objects.all()), Decimal(0)), venta.total)
        self.assertEqual(venta.peso_aceptado_kg, entrega.lineas.get().peso_recibido_kg)
        self.assertEqual(actuar(self.actor, venta.pk, 'emitir', datos).pk, venta.pk)
        self.assertEqual(RegistroActividad.objects.filter(modulo='ventas', accion='emitir').count(), 1)
        with self.assertRaises(ConflictoVenta):
            guardar(self.actor, self.datos_venta(entrega))
        for accion in ['emitir', 'cancelar']:
            with self.assertRaises(ConflictoVenta):
                actuar(self.actor, venta.pk, accion, {'clave_operacion': str(uuid.uuid4()), 'version': version_venta(venta)})
        entrega.refresh_from_db()
        self.assertEqual(entrega.origen, original)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (movimientos, cajillas))
        self.assertEqual(self.client.get(f'/api/v1/ventas/entregas/?cliente={self.cliente.pk}').data['count'], 0)

    def test_uuid_exige_mismo_cuerpo_y_responsable(self):
        datos = self.datos_venta()
        venta = guardar(self.actor, datos)
        self.assertEqual(guardar(self.actor, datos).pk, venta.pk)
        with self.assertRaises(ConflictoVenta):
            guardar(self.actor, {**datos, 'hasta': str(self.hoy + timedelta(days=1))})
        otro = Usuario.objects.create_superuser(email='otra-venta@prueba.test', password='prueba', cedula_identidad='889002')
        with self.assertRaises(ConflictoVenta):
            guardar(otro, datos)
        self.assertEqual(OperacionVenta.objects.count(), 1)

    def test_sin_precio_aceptado_no_emite_ni_inventa_importe(self):
        entrega = self.preparar_entrega_confirmada()
        venta = guardar(self.actor, self.datos_venta(entrega))
        revision = revisar_venta(venta)
        self.assertIsNone(revision['total'])
        self.assertIn('sin_precio', revision['incidencias'])
        with self.assertRaises(ValidationError):
            actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        self.assertFalse(LineaVenta.objects.exists())

    def test_revision_obsoleta_por_precio_cambiado_exige_revisar(self):
        entrega = self.preparar_entrega_confirmada()
        acuerdo = self.aceptado()
        venta = guardar(self.actor, self.datos_venta(entrega))
        datos = self.accion_venta(venta)
        nueva = self.accion(acuerdo, 'nueva_version', motivo='Corrección comercial')
        from precios.servicios import guardar as guardar_precio
        from precios.consultas import version_acuerdo
        guardar_precio(self.actor, self.datos_precio(version=version_acuerdo(nueva), lineas=[{'producto': self.producto.pk, 'precio_kg': '6.00'}]), nueva.pk)
        self.accion(nueva, 'presentar')
        self.accion(nueva, 'aceptar')
        with self.assertRaises(ConflictoVenta):
            actuar(self.actor, venta.pk, 'emitir', datos)
        emitida = actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        self.assertEqual(emitida.lineas.get().precio_kg, Decimal('6.00'))

    def test_precio_especifico_prioritario_y_historicos_no_se_reescriben(self):
        entrega, venta = self.preparar_venta()
        especifico = self.aceptado(alcance='entregas', desde=None, hasta=None, entregas=[entrega.pk], lineas=[{'producto': self.producto.pk, 'precio_kg': '4.50'}])
        venta = actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        antes = lineas_emitidas(venta)
        self.assertEqual(venta.lineas.get().precio.acuerdo_id, especifico.pk)
        self.cliente.razon_social = 'Nombre cambiado'
        self.cliente.save()
        self.producto.nombre = 'Producto renombrado'
        self.producto.save()
        self.centro.nombre = 'Sucursal renombrada'
        self.centro.save()
        self.assertEqual(lineas_emitidas(venta), antes)
        self.assertNotEqual(representar(venta)['cliente_nombre'], self.cliente.razon_social)

    def test_pesos_rechazados_se_excluyen_y_lotes_no_duplican_la_linea(self):
        entrega, venta = self.preparar_venta()
        fila = entrega.lineas.get()
        aporte = entrega.aportes.order_by('pk').first()
        aporte.peso_rechazado_kg = Decimal('0.333')
        aporte.save()
        fila.peso_rechazado_kg = Decimal('0.333')
        fila.save()
        venta = actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        self.assertEqual(venta.lineas.count(), 1)
        self.assertEqual(venta.peso_aceptado_kg, fila.peso_recibido_kg - Decimal('0.333'))

    def test_redondeo_por_producto_reparte_centavos_conservando_total(self):
        total, importes = calcular_importes([Decimal('.333'), Decimal('.333'), Decimal('.334')], Decimal('.05'))
        self.assertEqual(total, Decimal('.05'))
        self.assertEqual(importes, [Decimal('.02'), Decimal('.01'), Decimal('.02')])
        self.assertEqual(sum(importes), total)

    def test_reune_varios_dias_y_pedidos_con_precio_por_fecha_requerida(self):
        from entregas.vistas import representar as representar_entrega
        from entregas.servicios import guardar_hoja, ejecutar_accion
        from entregas.consultas import version_entrega

        primera = self.preparar_entrega_confirmada()
        self.aceptado(hasta=str(self.hoy))
        self.confirmar_pedido(primera.despacho, self.segundo_pedido)
        hoja = representar_entrega(self.actor, primera.despacho_id, self.segundo_pedido.pk)
        siguiente = self.hoy + timedelta(days=1)
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': hoja['version'],
            'fecha_recepcion': str(siguiente), 'recibido_por': 'Sucursal',
            'lineas': [{'producto': p['producto'], 'cajas_recibidas': p['cajas'], 'unidades_recibidas': p['unidades'],
                'peso_recibido_kg': p['peso_kg'], 'peso_rechazado_kg': '0', 'motivo_rechazo': ''} for p in hoja['origen']['productos']],
            'aportes': [{'carga': a['carga'], 'lote': a['lote'], 'peso_recibido_kg': a['peso_kg'], 'peso_rechazado_kg': '0'}
                for p in hoja['origen']['productos'] for a in p['aportes']]}
        # Simula el día siguiente sin cambiar las fechas requeridas de pedidos.
        with patch('entregas.servicios.timezone.localdate', return_value=siguiente):
            segunda = guardar_hoja(self.actor, primera.despacho_id, self.segundo_pedido.pk, datos)
            for accion in ['enviar', 'confirmar']:
                ejecutar_accion(self.actor, primera.despacho_id, self.segundo_pedido.pk, accion,
                    {'clave_operacion': str(uuid.uuid4()), 'version': version_entrega(segunda, segunda.origen)})
                segunda.refresh_from_db()
            consulta = self.client.get(f'/api/v1/ventas/entregas/?cliente={self.cliente.pk}&desde={siguiente}&hasta={siguiente}')
            self.assertEqual([fila['id'] for fila in consulta.data['results']], [segunda.pk])
            venta = guardar(self.actor, self.datos_venta(entregas=[primera.pk, segunda.pk], hasta=str(siguiente)))
            emitida = actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        pesos = primera.lineas.get().peso_recibido_kg + segunda.lineas.get().peso_recibido_kg
        self.assertEqual(emitida.peso_aceptado_kg, pesos)
        self.assertEqual(emitida.total, (pesos * Decimal('5.25')).quantize(Decimal('.01')))
        self.assertEqual(EntregaVenta.objects.filter(venta=emitida).count(), 2)
        self.assertEqual({f['pedido'] for f in lineas_emitidas(emitida)}, {self.pedido_centro.pk, self.segundo_pedido.pk})

    def test_ajenos_fechas_repetidos_y_campos_monetarios_inyectados_se_rechazan(self):
        entrega, venta = self.preparar_venta()
        otro = Cliente.objects.create(razon_social='Otro', nit='747474')
        for cambios in [{'cliente': otro.pk}, {'desde': str(self.hoy + timedelta(days=1))}, {'entregas': [entrega.pk] * 2}, {'total': '0.01'}, {'pagado': True}]:
            with self.subTest(cambios=cambios), self.assertRaises(ValidationError):
                guardar(self.actor, self.datos_venta(entrega, **cambios))
        self.assertEqual(Venta.objects.count(), 1)

    def test_sin_conciliacion_completa_no_emite(self):
        entrega, venta = self.preparar_venta()
        entrega.aportes.all().delete()
        self.assertIn('aportes_incompletos', revisar_venta(venta)['incidencias'])
        with self.assertRaises(ValidationError):
            actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))

    def test_vencimiento_y_borrador_vacio_no_emiten(self):
        venta = guardar(self.actor, self.datos_venta())
        with self.assertRaises(ValidationError):
            actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        entrega, venta = self.preparar_venta()
        venta = guardar(self.actor, self.datos_venta(entrega, version=version_venta(venta), vencimiento=str(self.hoy - timedelta(days=1))), venta.pk)
        with self.assertRaises(ValidationError):
            actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))

    def test_cancelar_borrador_no_reserva_y_conserva_seleccion(self):
        entrega, venta = self.preparar_venta()
        cancelada = actuar(self.actor, venta.pk, 'cancelar', self.accion_venta(venta))
        self.assertEqual(cancelada.estado, 'cancelada')
        self.assertEqual(cancelada.selecciones.get().entrega_id, entrega.pk)
        self.assertFalse(EntregaVenta.objects.exists())

    def test_fallo_auditoria_revierte_emision_completa(self):
        entrega, venta = self.preparar_venta()
        with patch('ventas.servicios.registrar_actividad', side_effect=RuntimeError('Fallo controlado')):
            with self.assertRaises(RuntimeError):
                actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        venta.refresh_from_db()
        self.assertEqual(venta.estado, 'borrador')
        self.assertFalse(EntregaVenta.objects.exists())
        self.assertFalse(LineaVenta.objects.exists())
        self.assertFalse(AporteVenta.objects.exists())

    def test_paginas_de_diez_resumen_y_filtros_consistentes(self):
        for _ in range(12):
            guardar(self.actor, self.datos_venta())
        primera = self.client.get('/api/v1/ventas/?page_size=999').data
        segunda = self.client.get('/api/v1/ventas/?pagina=2').data
        self.assertEqual((primera['count'], len(primera['results']), len(segunda['results']), primera['resumen']['borradores']), (12, 10, 2, 12))
        self.assertEqual(self.client.get('/api/v1/ventas/?estado=emitida').data['resumen']['borradores'], 0)

    def test_http_csrf_y_permisos_separados_sin_catalogos(self):
        operador = Usuario.objects.create_user(email='ventas@pruebas.test', cedula_identidad='889003')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='ventas', codename__in=['view_venta', 'add_venta']))
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(operador)
        self.assertEqual(cliente.get('/api/v1/ventas/clientes/').status_code, 200)
        datos = self.datos_venta()
        self.assertEqual(cliente.post('/api/v1/ventas/', datos, format='json').status_code, 403)
        csrf = cliente.get('/api/v1/auth/csrf/').json()['csrfToken']
        respuesta = cliente.post('/api/v1/ventas/', datos, format='json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        for accion in ['guardar', 'emitir', 'cancelar']:
            respuesta_accion = cliente.post(f'/api/v1/ventas/{respuesta.data["id"]}/{accion}/', {**datos, 'version': respuesta.data['version']} if accion == 'guardar' else {'clave_operacion': str(uuid.uuid4()), 'version': respuesta.data['version']}, format='json', HTTP_X_CSRFTOKEN=csrf)
            self.assertEqual(respuesta_accion.status_code, 403, respuesta_accion.data)
        operador.user_permissions.clear()
        self.assertEqual(cliente.get('/api/v1/ventas/').status_code, 403)

    def test_autorizacion_fresca_y_solo_local(self):
        entrega, venta = self.preparar_venta()
        actor = Usuario.objects.get(pk=self.actor.pk)
        actor._entregas_solo_propias = True
        with self.assertRaises(PermissionDenied):
            actuar(actor, venta.pk, 'emitir', self.accion_venta(venta))
        with patch('ventas.servicios.revisar_venta', side_effect=lambda v: (Usuario.objects.filter(pk=self.actor.pk).update(is_active=False), revisar_venta(v))[1]):
            with self.assertRaises(PermissionDenied):
                actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        self.assertFalse(LineaVenta.objects.exists())

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_modulo_no_publicado_por_https(self):
        self.assertEqual(self.client.get('/api/v1/ventas/').status_code, 404)
        self.assertFalse(any(self.client.get('/api/v1/auth/me/').data['permisos_ventas'].values()))

    def test_pdf_privado_solo_emitida_y_descarga_auditada(self):
        entrega, venta = self.preparar_venta()
        self.assertEqual(self.client.get(f'/api/v1/ventas/{venta.pk}/descargar/').status_code, 400)
        venta = actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        respuesta = self.client.get(f'/api/v1/ventas/{venta.pk}/descargar/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta['Cache-Control'], 'private, no-store')
        self.assertTrue(b''.join(respuesta.streaming_content).startswith(b'%PDF-'))
        self.assertEqual(actividad_modulos().filter(modulo='ventas', accion='descargar', resultado='exito').count(), 1)
        for idioma in ['es', 'en']:
            pdf = generar_resumen_pdf(representar(venta), lineas_emitidas(venta) * 30, idioma)
            self.assertTrue(pdf.startswith(b'%PDF-'))

    def test_descarga_tiene_permiso_propio_y_no_admite_borrado(self):
        entrega, venta = self.preparar_venta()
        actuar(self.actor, venta.pk, 'emitir', self.accion_venta(venta))
        lector = Usuario.objects.create_user(email='lector-ventas@pruebas.test', cedula_identidad='889004')
        lector.user_permissions.set(Permission.objects.filter(content_type__app_label='ventas', codename='view_venta'))
        cliente = APIClient()
        cliente.force_login(lector)
        self.assertEqual(cliente.get(f'/api/v1/ventas/{venta.pk}/').status_code, 200)
        self.assertEqual(cliente.get(f'/api/v1/ventas/{venta.pk}/descargar/').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/v1/ventas/{venta.pk}/').status_code, 405)
        lector.user_permissions.add(Permission.objects.get(content_type__app_label='ventas', codename='descargar_venta'))
        self.assertEqual(cliente.get(f'/api/v1/ventas/{venta.pk}/descargar/').status_code, 200)


class PruebasConcurrenciaVentas(DatosVentas, TransactionTestCase):
    def setUp(self):
        self.preparar_descargas()
        super().setUp()

    def test_dos_documentos_no_emiten_la_misma_entrega(self):
        entrega, primera = self.preparar_venta()
        segunda = guardar(self.actor, self.datos_venta(entrega))
        documentos = [primera, segunda]
        datos = [self.accion_venta(v) for v in documentos]
        barrera = Barrier(2)
        def ejecutar(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    actuar(actor, documentos[indice].pk, 'emitir', datos[indice])
                    return 'emitida'
                except (ValidationError, ConflictoVenta):
                    return 'conflicto'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as grupo:
            resultados = list(grupo.map(ejecutar, range(2)))
        self.assertEqual(sorted(resultados), ['conflicto', 'emitida'])
        self.assertEqual(EntregaVenta.objects.count(), 1)
        self.assertEqual(LineaVenta.objects.count(), 1)
