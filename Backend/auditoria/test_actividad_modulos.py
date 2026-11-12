import uuid

from django.contrib.auth.models import Permission
from django.test import RequestFactory, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from almacenes.models import Almacen
from catalogos.models import CategoriaProducto, UnidadMedida
from productos.models import Producto
from usuarios.models import Usuario
from .consultas import actividad_modulos
from .models import RegistroActividad
from .servicios import registrar_actividad


def crear_evento(modulo, accion, metodo=None, **datos):
    solicitud = RequestFactory().generic(metodo, '/api/v1/prueba/') if metodo else None
    return registrar_actividad(modulo, accion, solicitud=solicitud, **datos)


class PruebasActividadModulos(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.actor = Usuario.objects.create_superuser(email='operaciones@actividad.test', cedula_identidad='710011')
        cls.lector = Usuario.objects.create_user(email='lectura@actividad.test', cedula_identidad='710012')
        cls.lector.user_permissions.add(Permission.objects.get(content_type__app_label='auditoria', codename='ver_registroactividad'))

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def test_listado_contadores_y_opciones_excluyen_ruido_incluso_si_se_filtra(self):
        principal = crear_evento('usuarios', 'editar', actor=self.actor, objeto=self.lector,
                                 cambios={'first_name': {'antes': '', 'despues': 'Ana'}})
        tecnicos = []
        for modulo, accion, adicionales in (
            ('chat', 'crear', {'metodo': 'POST', 'codigo_http': 200}),
            ('chat', 'abrir_canal_chat', {}),
            ('chat', 'enviar_mensaje_chat', {}),
            ('despachos', 'recibir_posiciones', {}),
            ('despachos', 'consultar_guia_chofer', {}),
            ('despachos', 'iniciar_seguimiento', {}),
            ('despachos', 'autorizar_supervision', {}),
            ('preparaciones', 'lotes', {'metodo': 'POST', 'codigo_http': 200}),
            ('preparaciones', 'lotes', {'metodo': 'POST', 'codigo_http': 403, 'resultado': 'rechazado'}),
            ('usuarios', 'listar', {'metodo': 'GET', 'codigo_http': 500, 'resultado': 'error'}),
            ('auditoria', 'listar', {}),
            ('autenticacion', 'iniciar_sesion', {}),
            ('entregas', 'crear_rol', {}),
        ):
            tecnicos.append(crear_evento(modulo, accion, objeto_tipo='prueba.objeto', **adicionales).pk)
        for _ in range(2):
            respuesta = self.client.get('/api/v1/actividad/').data
            self.assertEqual([fila['id'] for fila in respuesta['results']], [principal.pk])
            self.assertEqual(respuesta['count'], 1)
            self.assertEqual(respuesta['resumen'], {'total': 1, 'exitosos': 1, 'rechazados': 0, 'errores': 0})
        self.assertEqual(self.client.get('/api/v1/actividad/resumen/').data, respuesta['resumen'])
        self.assertEqual(self.client.get('/api/v1/actividad/opciones/').data, {'modulos': ['usuarios'], 'acciones': ['editar']})
        self.assertEqual(self.client.get('/api/v1/actividad/?modulo=chat').data['count'], 0)
        self.assertEqual(RegistroActividad.objects.filter(pk__in=tecnicos).count(), len(tecnicos))
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get(f'/api/v1/actividad/{tecnicos[0]}/').status_code, 200)

    def test_errores_de_operaciones_se_cuentan_con_los_mismos_filtros(self):
        crear_evento('compras', 'crear', objeto_tipo='compras.compra')
        rechazado = crear_evento('compras', 'registrar', resultado='rechazado', metodo='POST', codigo_http=409)
        crear_evento('compras', 'cancelar', resultado='error', metodo='POST', codigo_http=500)
        crear_evento('compras', 'listar', resultado='error', metodo='GET', codigo_http=500)
        respuesta = self.client.get('/api/v1/actividad/?modulo=compras&resultado=rechazado').data
        self.assertEqual([fila['id'] for fila in respuesta['results']], [rechazado.pk])
        self.assertEqual(respuesta['resumen'], {'total': 3, 'exitosos': 1, 'rechazados': 1, 'errores': 1})
        self.assertEqual(self.client.get('/api/v1/actividad/resumen/?modulo=compras').data, respuesta['resumen'])

    def test_alias_http_rechazados_y_descarga_explicita(self):
        for modulo, accion, metodo in (
            ('productos', 'cambiar_estado', 'POST'), ('unidades_inventario', 'crear', 'POST'),
            ('despachos', 'elegir_alternativa', 'POST'), ('entregas', 'operar', 'POST'),
            ('entregas', 'hoja', 'PUT'), ('devoluciones', 'revision', 'POST'),
            ('respaldos', 'descargar', 'GET'),
        ):
            registro = crear_evento(modulo, accion, metodo=metodo, codigo_http=403, resultado='rechazado')
            self.assertTrue(actividad_modulos().filter(pk=registro.pk).exists())
        lectura = crear_evento('entregas', 'hoja', metodo='GET', codigo_http=403, resultado='rechazado')
        self.assertFalse(actividad_modulos().filter(pk=lectura.pk).exists())

    def test_un_cambio_real_no_se_confunde_con_reintentos_ni_guardados_sin_cambios(self):
        ruta = f'/api/v1/usuarios/{self.lector.pk}/'
        for _ in range(2):
            self.assertEqual(self.client.patch(ruta, {'first_name': 'Ana'}, format='json').status_code, 200)
        self.assertEqual(actividad_modulos().filter(modulo='usuarios', accion='editar').count(), 1)
        self.assertEqual(self.client.patch(ruta, {'first_name': 'Elena'}, format='json').status_code, 200)
        self.assertEqual(actividad_modulos().filter(modulo='usuarios', accion='editar').count(), 2)
        crear_evento('pedidos', 'confirmar_registro', objeto_tipo='pedidos.pedido')
        crear_evento('pedidos', 'crear', metodo='POST', codigo_http=201)
        self.assertFalse(actividad_modulos().filter(modulo='pedidos').exists())

    def test_confirmar_recepcion_cuenta_una_operacion_conservando_lotes_y_movimientos(self):
        from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion

        unidad = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        categoria = CategoriaProducto.objects.create(nombre='Fruta')
        producto = Producto.objects.create(nombre='Papaya', categoria=categoria, unidad_medida=unidad)
        almacen = Almacen.objects.create(nombre='Central', direccion='Calle Uno')
        recepcion, _ = guardar_recepcion(self.actor, {
            'compra': None, 'almacen': almacen.pk, 'fecha_recepcion': str(timezone.localdate()),
            'observaciones': 'Ingreso inicial', 'clave_operacion': str(uuid.uuid4()),
            'detalles': [{'producto': producto.pk, 'unidad_inventario': unidad.pk, 'cantidad_inventario': '20'}],
        })
        datos = {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())}
        confirmar_recepcion(self.actor, recepcion, datos)
        confirmar_recepcion(self.actor, recepcion, datos)
        self.assertTrue(RegistroActividad.objects.filter(modulo='lotes', accion='crear').exists())
        self.assertTrue(RegistroActividad.objects.filter(modulo='movimientos_inventario').exists())
        respuesta = self.client.get('/api/v1/actividad/').data
        self.assertEqual([(fila['modulo'], fila['accion']) for fila in respuesta['results']],
                         [('recepciones', 'confirmar'), ('recepciones', 'crear')])
        self.assertEqual(respuesta['resumen']['total'], 2)

    def test_cajilla_con_saldo_inicial_y_reintento_se_cuenta_una_vez(self):
        almacen = Almacen.objects.create(nombre='Central', direccion='Calle Uno')
        datos = {'color': 'Verde', 'cantidad_inicial': 10, 'almacen': almacen.pk, 'clave_operacion': str(uuid.uuid4())}
        for _ in range(2):
            self.assertIn(self.client.post('/api/v1/cajillas/', datos, format='json').status_code, (200, 201))
        self.assertTrue(RegistroActividad.objects.filter(modulo='cajillas', accion='registrar_inicial').exists())
        self.assertEqual(list(actividad_modulos().values_list('modulo', 'accion')), [('cajillas', 'crear')])

    def test_derivados_de_despacho_y_preparacion_no_cuentan_como_operaciones(self):
        for modulo, accion in (
            ('despachos', 'fijar_ruta'), ('cajillas', 'registrar_carga'), ('cajillas', 'registrar_entrega'),
            ('pedidos', 'preparar'), ('pedidos', 'preparar_parcial'), ('lotes', 'separar_aprovechable'),
            ('lotes', 'recibir_devolucion'), ('movimientos_inventario', 'registrar_preparacion'),
            ('despachos', 'completar_optimizacion'), ('respaldos', 'completar_respaldo'),
        ):
            crear_evento(modulo, accion, objeto_tipo='prueba.objeto')
        self.assertFalse(actividad_modulos().exists())
        for modulo, accion in (('despachos', 'iniciar'), ('preparaciones', 'confirmar'), ('devoluciones', 'recibir')):
            crear_evento(modulo, accion, objeto_tipo='prueba.objeto')
        self.assertEqual(actividad_modulos().count(), 3)

    def test_procesos_centrales_e_historial_son_visibles_sin_exigir_cuenta_vigente(self):
        for origen in ('sistema', 'historico', 'admin'):
            crear_evento('roles', 'eliminar', objeto_tipo='auth.group', objeto_nombre='Rol anterior', origen=origen)
        self.assertEqual(actividad_modulos().count(), 3)

    def test_corte_paginacion_y_opciones_no_cambian_por_visitas_al_historial(self):
        for indice in range(12):
            crear_evento('productos', 'crear', objeto_tipo='productos.producto', objeto_id=str(indice))
        primera = self.client.get('/api/v1/actividad/').data
        for _ in range(15):
            crear_evento('chat', 'abrir_canal_chat')
        nueva = crear_evento('productos', 'editar', objeto_tipo='productos.producto', objeto_id='1',
                            cambios={'nombre': {'antes': 'Papaya', 'despues': 'Papaya grande'}})
        segunda = self.client.get(f'/api/v1/actividad/?page=2&corte={primera["corte"]}').data
        self.assertEqual(primera['count'], 12)
        self.assertEqual(segunda['resumen']['total'], 12)
        self.assertEqual(len(primera['results']), 10)
        self.assertEqual(len(segunda['results']), 2)
        self.assertFalse({fila['id'] for fila in primera['results']} & {fila['id'] for fila in segunda['results']})
        actualizada = self.client.get('/api/v1/actividad/').data
        self.assertEqual(actualizada['count'], 13)
        self.assertEqual(actualizada['results'][0]['id'], nueva.pk)
