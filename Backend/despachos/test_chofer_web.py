import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import MovimientoInventario
from usuarios.models import Usuario, SesionMovil
from usuarios.autenticacion_movil import crear_sesion_movil, revocar_sesion_movil
from .models import Despacho
from .modelos_seguimiento import SesionSeguimiento, PosicionSeguimiento
from .servicios import version_despacho
from .tests import DatosDespachos
from .test_rutas_carretera import resultado_prueba


class PruebasChoferWeb(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()
        cls.chofer = Usuario.objects.create_user(email='web@chofer.test', cedula_identidad='98950', password='Pruebas_web_2026!')
        cls.otro = Usuario.objects.create_user(email='otro.web@chofer.test', cedula_identidad='98951')
        permisos = Permission.objects.filter(content_type__app_label='despachos', codename__in=[
            'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios'])
        cls.chofer.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)

    def navegador(self, usuario=None, abrir=True):
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(usuario or self.chofer)
        token = cliente.get('/api/v1/auth/csrf/', secure=True).json()['csrfToken']
        cliente.credentials(HTTP_X_CSRFTOKEN=token, HTTP_REFERER='https://testserver/')
        if abrir:
            respuesta = cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            self.assertNotIn('credencial', respuesta.data)
        return cliente

    def enviado(self):
        viaje = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(viaje, 'enviar')
        return viaje

    def accion_web(self, cliente, viaje, accion, **datos):
        viaje.refresh_from_db()
        return cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/{accion}/', {
            'version': version_despacho(viaje), 'clave_operacion': str(uuid.uuid4()), **datos,
        }, format='json', secure=True)

    def test_acceso_exige_sesion_csrf_y_permiso_sin_otorgar_administracion(self):
        anonimo = APIClient()
        self.assertEqual(anonimo.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 401)
        cliente = self.navegador(abrir=False)
        cliente.credentials()
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 403)
        sin_permiso = self.navegador(self.lector, abrir=False)
        self.assertEqual(sin_permiso.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 403)
        cliente = self.navegador()
        self.assertEqual(cliente.get('/api/v1/despachos/', secure=True).status_code, 403)
        self.assertEqual(cliente.get('/api/v1/auth/me/', secure=True).data['permisos_chofer'], {'ver': True, 'operar': True})

    def test_sesion_web_y_bearer_movil_conservan_sus_fronteras(self):
        viaje = self.enviado()
        cliente = self.navegador()
        self.assertEqual(cliente.get('/api/v1/movil/mis-despachos/', secure=True).status_code, 401)
        acceso, credencial = crear_sesion_movil(self.chofer, uuid.uuid4(), 'Android conservado')
        movil = APIClient()
        movil.credentials(HTTP_AUTHORIZATION='Bearer ' + credencial)
        self.assertEqual(movil.get('/api/v1/chofer/mis-viajes/', secure=True).status_code, 401)
        self.assertEqual(movil.get(f'/api/v1/movil/mis-despachos/{viaje.pk}/', secure=True).status_code, 200)
        self.assertEqual(cliente.post('/api/v1/auth/logout/', {}, format='json', secure=True).status_code, 200)
        acceso.refresh_from_db()
        self.assertIsNone(acceso.revocada_en)
        self.assertEqual(movil.get('/api/v1/movil/mis-despachos/', secure=True).status_code, 200)

    def test_alcance_vistas_y_paginacion_se_aplican_antes_de_paginar(self):
        viaje = self.enviado()
        for indice in range(12):
            Despacho.objects.create(almacen=self.almacen, almacen_nombre='Almacén', vehiculo=self.vehiculo,
                vehiculo_placa=self.vehiculo.placa, chofer=self.chofer, chofer_nombre='Chofer',
                fecha_reparto=self.hoy, responsable=self.actor, responsable_nombre='Responsable',
                enviado_en=timezone.now(), estado='cancelado' if indice == 11 else 'borrador',
                clave_operacion=uuid.uuid4(), huella_creacion='a' * 64)
        cliente = self.navegador()
        lista = cliente.get('/api/v1/chofer/mis-viajes/', secure=True)
        self.assertEqual(lista.data['count'], 12)
        self.assertEqual(len(lista.data['results']), 10)
        self.assertEqual(len(cliente.get('/api/v1/chofer/mis-viajes/?page=2', secure=True).data['results']), 2)
        self.assertEqual(cliente.get('/api/v1/chofer/mis-viajes/?vista=historial', secure=True).data['count'], 1)
        ajeno = self.navegador(self.otro)
        self.assertEqual(ajeno.get('/api/v1/chofer/mis-viajes/', secure=True).data['count'], 0)
        self.assertEqual(ajeno.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/', secure=True).status_code, 404)
        self.assertEqual(self.accion_web(ajeno, viaje, 'iniciar').status_code, 404)

    def test_el_flujo_manual_descarga_por_pedido_no_duplica_productos_ni_cajillas(self):
        viaje, cliente = self.enviado(), self.navegador()
        productos = MovimientoInventario.objects.count()
        self.assertEqual(self.accion_web(cliente, viaje, 'iniciar').status_code, 200)
        for parada in viaje.paradas.all():
            self.assertEqual(self.accion_web(cliente, viaje, 'llegar', parada=parada.pk).status_code, 200)
            pedidos = cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/pedidos/?parada={parada.pk}', secure=True).data['results']
            for pedido in pedidos:
                filas = cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/productos-pedido/?parada={parada.pk}&pedido={pedido["pedido"]}', secure=True).data['results']
                viaje.refresh_from_db()
                documento = {'version': version_despacho(viaje), 'clave_operacion': str(uuid.uuid4()),
                    'parada': parada.pk, 'pedido': pedido['pedido'], 'cargas_comprobadas': [fila['id'] for fila in filas]}
                ruta = f'/api/v1/chofer/mis-viajes/{viaje.pk}/descargar-pedido/'
                for _ in range(2):
                    respuesta = cliente.post(ruta, documento, format='json', secure=True)
                    self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(self.accion_web(cliente, viaje, 'finalizar').status_code, 200)
        self.assertEqual(MovimientoInventario.objects.count(), productos)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=viaje, tipo='entrega').count(), 2)
        self.assertTrue(RegistroActividad.objects.filter(actor=self.chofer, accion='descargar_pedido').exists())

    def test_permiso_operar_y_version_se_revalidan(self):
        viaje, cliente = self.enviado(), self.navegador()
        self.chofer.user_permissions.remove(Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios'))
        self.assertEqual(cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/', secure=True).status_code, 200)
        self.assertEqual(self.accion_web(cliente, viaje, 'iniciar').status_code, 403)
        self.chofer.user_permissions.add(Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios'))
        self.assertEqual(self.accion_web(cliente, viaje, 'iniciar', version='f' * 64).status_code, 409)

    def test_gps_web_es_idempotente_y_cerrar_sesion_cierra_seguimiento(self):
        viaje, cliente = self.enviado(), self.navegador()
        self.assertEqual(self.accion_web(cliente, viaje, 'iniciar').status_code, 200)
        sesion = self.accion_web(cliente, viaje, 'iniciar-seguimiento').data['id']
        lote = {'sesion': sesion, 'clave_operacion': str(uuid.uuid4()), 'posiciones': [{
            'id': str(uuid.uuid4()), 'latitud': '-16.5000000', 'longitud': '-68.1400000',
            'precision_m': '8.00', 'capturada_en': timezone.now().isoformat()}]}
        for _ in range(2):
            respuesta = cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/enviar-posiciones/', lote, format='json', secure=True)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(PosicionSeguimiento.objects.filter(sesion_id=sesion).count(), 1)
        self.assertEqual(cliente.post('/api/v1/auth/logout/', {}, format='json', secure=True).status_code, 200)
        self.assertIsNotNone(SesionSeguimiento.objects.get(pk=sesion).cerrada_en)

    def test_acceso_revocado_no_se_reabre_y_expirado_requiere_acceso_explicito(self):
        cliente = self.navegador()
        acceso = SesionMovil.objects.get(usuario=self.chofer)
        SesionMovil.objects.filter(pk=acceso.pk).update(vence_en=timezone.now() - timedelta(seconds=1))
        self.assertEqual(cliente.get('/api/v1/chofer/mis-viajes/', secure=True).status_code, 401)
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 200)
        nuevo = SesionMovil.objects.filter(usuario=self.chofer, revocada_en__isnull=True).get()
        revocar_sesion_movil(self.chofer, nuevo.pk)
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 401)

    def test_acceso_repetido_conserva_dispositivo_y_sesion(self):
        cliente = self.navegador()
        acceso = SesionMovil.objects.get(usuario=self.chofer)
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 200)
        self.assertEqual(SesionMovil.objects.filter(usuario=self.chofer).count(), 1)
        self.assertEqual(SesionMovil.objects.get(usuario=self.chofer).pk, acceso.pk)

    def test_revision_incluye_foto_y_prevision_exacta_sin_asignar_cajillas_generales(self):
        from preparaciones.models import CajillaPrevista
        CajillaPrevista.objects.create(preparacion=self.preparacion, sucursal=self.centro,
            producto=self.producto, cajilla=self.cajilla, color=self.cajilla.color, cantidad=7)
        CajillaPrevista.objects.create(preparacion=self.preparacion, sucursal=self.norte,
            producto=self.producto, cajilla=self.cajilla, color=self.cajilla.color, cantidad=3)
        viaje, cliente = self.enviado(), self.navegador()
        viaje.refresh_from_db()
        version = version_despacho(viaje)
        productos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        for sucursal, cantidad in [(self.centro, 7), (self.norte, 3)]:
            parada = viaje.paradas.get(sucursal=sucursal)
            pedido = viaje.cargas.filter(parada=parada).first().contenido['pedido']
            respuesta = cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/productos-pedido/?parada={parada.pk}&pedido={pedido}', secure=True)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            self.assertEqual(respuesta.data['count'], 1)
            fila = respuesta.data['results'][0]
            self.assertIsNone(fila['producto_imagen'])
            self.assertEqual(fila['cajillas_preparacion'], [{'cajilla': self.cajilla.pk, 'color': self.cajilla.color, 'cantidad': cantidad}])
        viaje.refresh_from_db()
        self.assertEqual(version_despacho(viaje), version)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (productos, cajillas))

    def test_foto_actual_limitada_a_carga_propia_sin_permiso_catalogo_ni_operar(self):
        from tempfile import TemporaryDirectory
        from io import BytesIO
        from django.core.files.base import ContentFile
        from PIL import Image
        from productos.models import Producto
        viaje, cliente = self.enviado(), self.navegador()
        parada = viaje.paradas.get(sucursal=self.centro)
        pedido = viaje.cargas.filter(parada=parada).first().contenido['pedido']
        consulta = f'/api/v1/chofer/mis-viajes/{viaje.pk}/productos-pedido/?parada={parada.pk}&pedido={pedido}'
        with TemporaryDirectory() as carpeta, override_settings(MEDIA_ROOT=carpeta):
            contenido = BytesIO()
            Image.new('RGB', (4, 4), 'green').save(contenido, format='WEBP')
            self.producto.imagen.save('prueba.webp', ContentFile(contenido.getvalue()), save=True)
            fila = cliente.get(consulta, secure=True).data['results'][0]
            ruta = fila['producto_imagen']
            self.assertEqual(ruta, f'/api/v1/chofer/mis-viajes/{viaje.pk}/imagenes/{self.producto.pk}/')
            self.chofer.user_permissions.remove(Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios'))
            foto = cliente.get(ruta, secure=True)
            self.assertEqual(foto.status_code, 200)
            self.assertEqual(b''.join(foto.streaming_content), contenido.getvalue())
            self.assertEqual(foto['Content-Type'], 'image/webp')
            self.assertIn('no-store', foto['Cache-Control'])
            self.assertEqual(APIClient().get(ruta, secure=True).status_code, 401)
            self.assertEqual(self.navegador(self.otro).get(ruta, secure=True).status_code, 404)
            ajeno = Producto.objects.create(nombre='Fuera de carga', categoria=self.categoria, unidad_medida=self.kg)
            self.assertEqual(cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/imagenes/{ajeno.pk}/', secure=True).status_code, 404)
            self.producto.imagen.delete(save=True)
            self.assertEqual(cliente.get(ruta, secure=True).status_code, 404)

    def test_prevision_historica_sin_producto_no_se_inventa_en_revision(self):
        viaje, cliente = self.enviado(), self.navegador()
        parada = viaje.paradas.get(sucursal=self.centro)
        pedido = viaje.cargas.filter(parada=parada).first().contenido['pedido']
        fila = cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/productos-pedido/?parada={parada.pk}&pedido={pedido}', secure=True).data['results'][0]
        self.assertEqual(fila['cajillas_preparacion'], [])

    def test_calcular_y_confirmar_desde_web_conserva_paradas_carga_y_fija_al_salir(self):
        for referencia, latitud, longitud in ((self.almacen, '-16.50', '-68.14'),
                (self.centro, '-16.49', '-68.12'), (self.norte, '-16.48', '-68.10')):
            referencia.latitud, referencia.longitud = Decimal(latitud), Decimal(longitud)
            referencia.save()
        viaje, cliente = self.enviado(), self.navegador()
        paradas = list(viaje.paradas.values_list('pk', flat=True))
        cargas = list(viaje.cargas.values_list('pk', flat=True))
        movimientos = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=resultado_prueba):
            respuesta = self.accion_web(cliente, viaje, 'calcular-ruta', orden_paradas=list(reversed(paradas)))
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(list(viaje.paradas.values_list('pk', flat=True)), paradas)
        plan = respuesta.data['plan']['id']
        self.assertEqual(self.accion_web(cliente, viaje, 'iniciar').status_code, 400)
        respuesta = self.accion_web(cliente, viaje, 'aprobar-ruta', plan=plan)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(list(viaje.paradas.values_list('pk', flat=True)), list(reversed(paradas)))
        self.assertCountEqual(viaje.cargas.values_list('pk', flat=True), cargas)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), movimientos)
        self.assertEqual(self.accion_web(cliente, viaje, 'iniciar').status_code, 200)
        self.assertIsNotNone(viaje.planes_ruta.get(pk=plan).fijada_en)

    @override_settings(OPTIMIZACION_HABILITADA=True)
    def test_web_solicita_y_cancela_optimizacion_sin_aplicar_el_orden(self):
        for referencia, latitud, longitud in ((self.almacen, '-16.50', '-68.14'),
                (self.centro, '-16.49', '-68.12'), (self.norte, '-16.48', '-68.10')):
            referencia.latitud, referencia.longitud = Decimal(latitud), Decimal(longitud)
            referencia.save()
        viaje, cliente = self.enviado(), self.navegador()
        orden = list(viaje.paradas.values_list('pk', flat=True))
        movimientos = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
        with patch('despachos.optimizacion.servicios.publicar_calculo'), self.captureOnCommitCallbacks(execute=True):
            respuesta = self.accion_web(cliente, viaje, 'optimizar-ruta', orden_paradas=orden)
        self.assertEqual(respuesta.status_code, 202, respuesta.data)
        calculo = respuesta.data['optimizacion']['id']
        self.assertNotEqual(self.accion_web(cliente, viaje, 'iniciar').status_code, 200)
        respuesta = self.accion_web(cliente, viaje, 'cancelar-optimizacion', calculo=calculo)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['optimizacion']['estado'], 'cancelada')
        self.assertEqual(list(viaje.paradas.values_list('pk', flat=True)), orden)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), movimientos)
