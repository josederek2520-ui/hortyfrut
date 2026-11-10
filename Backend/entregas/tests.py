import uuid
import tempfile
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase, TransactionTestCase, override_settings
from django.contrib.auth.models import Permission
from django.http import Http404
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError, PermissionDenied
from usuarios.models import Usuario
from despachos.test_descarga_pedidos import DatosDescargaPedidos
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla
from auditoria.models import RegistroActividad
from .models import Entrega, OperacionEntrega
from .servicios import guardar_hoja, ejecutar_accion, ConflictoEntrega
from .vistas import representar
from .consultas import version_entrega
from .comprobantes import guardar_comprobante


class PruebasConcurrenciaEntregas(DatosDescargaPedidos, TransactionTestCase):
    def setUp(self):
        self.preparar_descargas()
        super().setUp()

    def test_dos_guardados_simultaneos_con_la_misma_clave_no_duplican(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        despacho, _ = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.pedido_centro)
        hoja = representar(self.actor, despacho.pk, self.pedido_centro.pk)
        datos = {'version': hoja['version'], 'clave_operacion': str(uuid.uuid4()), 'fecha_recepcion': None, 'recibido_por': '', 'lineas': []}
        barrera = Barrier(2)
        def guardar():
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                return guardar_hoja(actor, despacho.pk, self.pedido_centro.pk, datos).pk
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as grupo:
            resultados = list(grupo.map(lambda _: guardar(), range(2)))
        self.assertEqual(resultados[0], resultados[1])
        self.assertEqual((Entrega.objects.count(), OperacionEntrega.objects.count()), (1, 1))


class PruebasEntregas(DatosDescargaPedidos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()
        cls.encargado = Usuario.objects.create_user(email='recepcion@pruebas.test', cedula_identidad='97821')
        cls.encargado.user_permissions.set(Permission.objects.filter(content_type__app_label='entregas',
            codename__in=['view_entrega', 'add_entrega', 'change_entrega', 'enviar_entrega']))
        cls.centro.encargado_recepcion = cls.encargado
        cls.centro.encargado_pedidos = cls.encargado
        cls.centro.save()

    def preparar_entrega(self):
        despacho, parada = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.pedido_centro)
        return despacho

    def test_listado_distingue_reparto_de_descarga_y_conserva_el_filtro(self):
        despacho = self.preparar_entrega()
        fecha_reparto = self.hoy - timedelta(days=1)
        despacho.fecha_reparto = fecha_reparto
        despacho.save(update_fields=['fecha_reparto'])
        cliente = APIClient()
        cliente.force_authenticate(self.encargado)
        respuesta = cliente.get('/api/v1/entregas/', {'fecha': str(fecha_reparto)})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        fila = respuesta.data['results'][0]
        self.assertEqual(str(fila['fecha_reparto']), str(fecha_reparto))
        self.assertNotEqual(str(fila['descargada_en'])[:10], str(fecha_reparto))
        self.assertEqual(cliente.get('/api/v1/entregas/', {'fecha': str(self.hoy)}).data['count'], 0)

    def datos(self, despacho, actor=None, **cambios):
        hoja = representar(actor or self.actor, despacho.pk, self.pedido_centro.pk)
        origen = hoja['origen']
        return {'clave_operacion': str(uuid.uuid4()), 'version': hoja['version'], 'fecha_recepcion': str(self.hoy),
            'recibido_por': 'Recepción de prueba',
            'lineas': [{'producto': p['producto'], 'cajas_recibidas': p['cajas'], 'unidades_recibidas': p['unidades'],
                'peso_recibido_kg': p['peso_kg'], 'peso_rechazado_kg': '0', 'motivo_rechazo': ''} for p in origen['productos']],
            'aportes': [], **cambios}

    def accion(self, despacho, entrega, accion, actor=None, **cambios):
        entrega.refresh_from_db()
        return ejecutar_accion(actor or self.actor, despacho.pk, self.pedido_centro.pk, accion,
            {'clave_operacion': str(uuid.uuid4()), 'version': version_entrega(entrega, entrega.origen), **cambios})

    def test_pendientes_se_agrupan_tras_descarga_sin_escrituras_por_consultar(self):
        despacho, parada = self.iniciar_descarga()
        self.assertEqual(self.client.get('/api/v1/entregas/').data['count'], 0)
        self.confirmar_pedido(despacho, self.pedido_centro)
        respuesta = self.client.get('/api/v1/entregas/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['estado'], 'pendiente')
        self.assertEqual(Entrega.objects.count(), 0)
        hoja = representar(self.actor, despacho.pk, self.pedido_centro.pk)
        self.assertEqual((hoja['origen']['productos'][0]['cajas'], hoja['origen']['productos'][0]['unidades']), (2, 4))
        self.assertEqual(Decimal(hoja['origen']['productos'][0]['peso_kg']), Decimal('24'))

    def test_descarga_incompleta_y_viaje_borrador_no_admiten_recepcion(self):
        despacho, parada = self.iniciar_descarga()
        with self.assertRaises(ValidationError):
            representar(self.actor, despacho.pk, self.pedido_centro.pk)

    def test_encargado_solo_consulta_y_escribe_sus_sucursales(self):
        despacho = self.preparar_entrega()
        cliente = APIClient()
        cliente.force_authenticate(self.encargado)
        self.assertEqual(cliente.get('/api/v1/entregas/').data['count'], 1)
        datos = self.datos(despacho, self.encargado)
        entrega = guardar_hoja(self.encargado, despacho.pk, self.pedido_centro.pk, datos)
        self.accion(despacho, entrega, 'enviar', self.encargado)
        with self.assertRaises(PermissionDenied):
            self.accion(despacho, entrega, 'confirmar', self.encargado)
        self.centro.encargado_recepcion = None
        self.centro.encargado_pedidos = None
        self.centro.save()
        self.assertEqual(cliente.get('/api/v1/entregas/').data['count'], 0)
        self.assertEqual(cliente.get(f'/api/v1/entregas/{despacho.pk}/pedidos/{self.pedido_centro.pk}/').status_code, 404)
        with self.assertRaises(Http404):
            guardar_hoja(self.encargado, despacho.pk, self.pedido_centro.pk, datos)

    def test_reintento_de_guardado_no_duplica_y_cuerpo_distinto_da_conflicto(self):
        despacho = self.preparar_entrega()
        datos = self.datos(despacho)
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        repetida = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.assertEqual(entrega.pk, repetida.pk)
        self.assertEqual(OperacionEntrega.objects.count(), 1)
        with self.assertRaises(ConflictoEntrega):
            guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, {**datos, 'recibido_por': 'Otra persona'})

    def test_borrador_incompleto_se_guarda_pero_no_se_envia(self):
        despacho = self.preparar_entrega()
        datos = self.datos(despacho)
        datos['lineas'][0]['peso_recibido_kg'] = None
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        with self.assertRaises(ValidationError):
            self.accion(despacho, entrega, 'enviar')
        self.assertEqual(Entrega.objects.get(pk=entrega.pk).estado, 'borrador')

    def test_rechazo_no_supera_recepcion_y_exige_motivo(self):
        despacho = self.preparar_entrega()
        for peso in ['25', '1']:
            datos = self.datos(despacho)
            datos['lineas'][0]['peso_rechazado_kg'] = peso
            with self.assertRaises(ValidationError):
                guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.assertEqual(Entrega.objects.count(), 0)

    def test_confirmacion_conserva_inventario_cajillas_y_estado_de_pedido(self):
        despacho = self.preparar_entrega()
        productos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        self.pedido_centro.refresh_from_db()
        estado_pedido = self.pedido_centro.estado
        datos = self.datos(despacho)
        origen = representar(self.actor, despacho.pk, self.pedido_centro.pk)['origen']
        datos['aportes'] = [{'carga': a['carga'], 'lote': a['lote'], 'peso_recibido_kg': a['peso_kg'], 'peso_rechazado_kg': '0'} for p in origen['productos'] for a in p['aportes']]
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.accion(despacho, entrega, 'enviar')
        entrega = self.accion(despacho, entrega, 'confirmar')
        self.assertEqual(entrega.estado, 'confirmada')
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (productos, cajillas))
        self.pedido_centro.refresh_from_db()
        self.assertEqual(self.pedido_centro.estado, estado_pedido)
        self.assertTrue(RegistroActividad.objects.filter(modulo='entregas', accion='confirmar', objeto_id=str(entrega.pk)).exists())
        with self.assertRaises(ConflictoEntrega):
            guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))

    def test_varios_aportes_exigen_distribucion_exacta_sin_inventarla(self):
        despacho = self.preparar_entrega()
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        self.accion(despacho, entrega, 'enviar')
        with self.assertRaises(ValidationError):
            self.accion(despacho, entrega, 'confirmar')
        self.assertEqual(entrega.aportes.count(), 0)

    def test_version_anterior_no_sobrescribe_recepcion(self):
        despacho = self.preparar_entrega()
        datos = self.datos(despacho)
        guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        with self.assertRaises(ConflictoEntrega):
            guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, {**datos, 'clave_operacion': str(uuid.uuid4())})

    def test_adjunto_privado_valida_formato_y_conserva_version(self):
        despacho = self.preparar_entrega()
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        with tempfile.TemporaryDirectory() as carpeta, override_settings(ENTREGAS_ARCHIVOS_DIR=carpeta):
            datos = {'version': version_entrega(entrega, entrega.origen), 'clave_operacion': str(uuid.uuid4())}
            with self.assertRaises(ValidationError):
                guardar_comprobante(self.actor, despacho.pk, self.pedido_centro.pk, datos, SimpleUploadedFile('falso.pdf', b'no es pdf'))
            entrega = guardar_comprobante(self.actor, despacho.pk, self.pedido_centro.pk, datos, SimpleUploadedFile('prueba.pdf', b'%PDF-1.4\nprueba\n%%EOF'))
            respuesta = self.client.get(f'/api/v1/entregas/{despacho.pk}/pedidos/{self.pedido_centro.pk}/comprobante/')
            self.assertEqual(respuesta.status_code, 200)
            self.assertIn('attachment', respuesta['Content-Disposition'])
            # Liberar el archivo sin emitir request_finished dentro del TestCase atómico.
            for cerrar in respuesta._resource_closers:
                cerrar()

    def test_api_productos_aportes_y_recepcion_confirmada_no_exigen_administrar_productos(self):
        despacho = self.preparar_entrega()
        cliente = APIClient()
        cliente.force_authenticate(self.encargado)
        ruta = f'/api/v1/entregas/{despacho.pk}/pedidos/{self.pedido_centro.pk}/'
        respuesta = cliente.get(ruta + 'productos/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        producto = respuesta.data['results'][0]['producto']
        self.assertEqual(cliente.get(ruta + f'aportes/?producto={producto}').data['count'], 2)
        self.assertEqual(cliente.get(ruta + 'aportes/?producto=9999999').status_code, 404)

    def test_api_pedidos_acumula_solo_recepciones_confirmadas(self):
        despacho = self.preparar_entrega()
        datos = self.datos(despacho)
        origen = representar(self.actor, despacho.pk, self.pedido_centro.pk)['origen']
        datos['aportes'] = [{'carga': a['carga'], 'lote': a['lote'], 'peso_recibido_kg': a['peso_kg'], 'peso_rechazado_kg': '0'} for p in origen['productos'] for a in p['aportes']]
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        ruta = f'/api/v1/pedidos/{self.pedido_centro.pk}/'
        self.assertEqual(self.client.get(ruta).data['recepcion_confirmada'], [])
        self.accion(despacho, entrega, 'enviar')
        self.assertEqual(self.client.get(ruta).data['recepcion_confirmada'], [])
        self.accion(despacho, entrega, 'confirmar')
        filas = self.client.get(ruta).data['recepcion_confirmada']
        self.assertEqual(len(filas), 1)
        self.assertEqual((filas[0]['cajas'], filas[0]['unidades']), (2, 4))
        self.assertEqual(Decimal(filas[0]['peso_kg']), Decimal('24'))

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_https_limita_incluso_al_administrador_a_sus_sucursales_y_no_confirma(self):
        despacho = self.preparar_entrega()
        cliente = APIClient()
        cliente.force_authenticate(self.actor)
        self.assertEqual(cliente.get('/api/v1/entregas/').data['count'], 0)
        ruta = f'/api/v1/entregas/{despacho.pk}/pedidos/{self.pedido_centro.pk}/'
        self.assertEqual(cliente.get(ruta).status_code, 404)
        self.centro.encargado_recepcion = self.actor
        self.centro.save()
        self.assertEqual(cliente.get('/api/v1/entregas/').data['count'], 1)
        hoja = cliente.get(ruta).data
        datos = self.datos(despacho)
        self.assertEqual(cliente.post(ruta, datos, format='json').status_code, 200)
        entrega = Entrega.objects.get(despacho=despacho, pedido=self.pedido_centro)
        self.accion(despacho, entrega, 'enviar')
        entrega.refresh_from_db()
        accion = {'version': version_entrega(entrega, entrega.origen), 'clave_operacion': str(uuid.uuid4())}
        self.assertEqual(cliente.post(ruta + 'confirmar/', accion, format='json').status_code, 403)
        self.assertEqual(cliente.post(ruta + 'devolver/', accion, format='json').status_code, 403)
        datos = self.datos(despacho)
        self.assertEqual(cliente.post(ruta, datos, format='json').status_code, 409)
        sesion = cliente.get('/api/v1/auth/me/').data['permisos_entregas']
        self.assertTrue(sesion['ver'])
        self.assertFalse(sesion['confirmar'])
        self.assertFalse(sesion['gestionar_todas'])

    def test_solicitud_incompleta_no_omite_productos_ajenos_y_separacion_de_roles(self):
        despacho = self.preparar_entrega()
        datos = self.datos(despacho)
        datos['lineas'][0]['producto'] = 9999999
        with self.assertRaises(ValidationError):
            guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        datos = self.datos(despacho, self.encargado)
        origen = representar(self.actor, despacho.pk, self.pedido_centro.pk)['origen']
        a = origen['productos'][0]['aportes'][0]
        datos['aportes'] = [{'carga': a['carga'], 'lote': a['lote'], 'peso_recibido_kg': '1', 'peso_rechazado_kg': '0'}]
        with self.assertRaises(PermissionDenied):
            guardar_hoja(self.encargado, despacho.pk, self.pedido_centro.pk, datos)
        self.assertEqual(Entrega.objects.count(), 0)

    def test_tras_enviar_encargado_no_edita_hasta_devolucion_de_oficina(self):
        despacho = self.preparar_entrega()
        entrega = guardar_hoja(self.encargado, despacho.pk, self.pedido_centro.pk, self.datos(despacho, self.encargado))
        self.accion(despacho, entrega, 'enviar', self.encargado)
        with self.assertRaises(ConflictoEntrega):
            guardar_hoja(self.encargado, despacho.pk, self.pedido_centro.pk, self.datos(despacho, self.encargado))
        self.accion(despacho, entrega, 'devolver')
        entrega = guardar_hoja(self.encargado, despacho.pk, self.pedido_centro.pk, self.datos(despacho, self.encargado))
        self.assertEqual(entrega.estado, 'borrador')

    def test_recepcion_puede_diferir_en_peso_sin_convertir_faltante_en_rechazo(self):
        despacho = self.preparar_entrega()
        datos = self.datos(despacho)
        datos['lineas'][0].update(peso_recibido_kg='23.8', peso_rechazado_kg='0.3', motivo_rechazo='Golpeado')
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.accion(despacho, entrega, 'enviar')
        fila = entrega.lineas.get()
        self.assertEqual(fila.peso_rechazado_kg, Decimal('0.3'))
        self.assertEqual(fila.peso_recibido_kg - fila.peso_rechazado_kg, Decimal('23.5'))

    def test_paginacion_agrupa_pedidos_antes_de_cortar_diez(self):
        from preparaciones.models import AsignacionPreparacion
        from despachos.models import CargaDespacho
        despacho = self.preparar_entrega()
        referencia = despacho.cargas.filter(asignacion__pedido=self.pedido_centro).first()
        for indice in range(11):
            pedido = self.crear_pedido(self.centro)
            asignacion = AsignacionPreparacion.objects.create(preparacion=self.preparacion, pedido=pedido, sucursal=self.centro,
                sucursal_nombre=self.centro.nombre, producto_id=referencia.contenido['producto'], producto_nombre=referencia.contenido['producto_nombre'],
                presentacion_nombre='Caja', columna='cajas', cantidad_solicitada=1, cantidad=1)
            CargaDespacho.objects.create(despacho=despacho, parada=referencia.parada, asignacion=asignacion, activa=False,
                descargada_en=referencia.descargada_en, contenido={**referencia.contenido, 'pedido': pedido.pk, 'codigo_pedido': pedido.codigo})
        primera = self.client.get('/api/v1/entregas/')
        segunda = self.client.get('/api/v1/entregas/?pagina=2')
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (12, 10, 2))
        self.assertFalse({f['pedido'] for f in primera.data['results']} & {f['pedido'] for f in segunda.data['results']})

    def test_csrf_se_exige_en_recepcion_de_navegador(self):
        despacho = self.preparar_entrega()
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(self.encargado)
        ruta = f'/api/v1/entregas/{despacho.pk}/pedidos/{self.pedido_centro.pk}/'
        datos = self.datos(despacho, self.encargado)
        self.assertEqual(cliente.post(ruta, datos, format='json').status_code, 403)
        csrf = cliente.get('/api/v1/auth/csrf/').json()['csrfToken']
        self.assertEqual(cliente.post(ruta, datos, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 200)

    def test_recepcion_se_registra_despues_de_finalizar_el_viaje(self):
        despacho = self.preparar_entrega()
        self.confirmar_pedido(despacho, self.segundo_pedido)
        parada = despacho.paradas.get(sucursal=self.norte)
        self.operar(despacho, 'llegar', parada=parada.pk)
        self.confirmar_pedido(despacho, self.pedido_norte)
        self.operar(despacho, 'finalizar')
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        self.assertEqual(entrega.estado, 'borrador')
