import uuid
from datetime import timedelta
from tempfile import TemporaryDirectory

from django.contrib.auth.models import Permission
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from clientes.models import Cliente, Sucursal
from clientes.servicios import guardar_registro, obtener_version
from pedidos.models import Pedido
from productos.models import Producto, PresentacionProducto
from usuarios.models import Usuario
from .consultas import version_acuerdo
from .models import AcuerdoPrecio
from .permisos import permisos_precios
from .servicios import guardar
from .tests import DatosPrecios


class PruebasPreciosSupermercado(DatosPrecios, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()
        cls.supermercado = Usuario.objects.create_user(email='super@precios.test', cedula_identidad='71001')
        # Incluso con permisos de decisión asignados por error, su alcance no se amplía.
        cls.supermercado.user_permissions.set(Permission.objects.filter(content_type__app_label='precios'))
        cls.cliente.encargado_precios = cls.supermercado
        cls.cliente.save()
        cls.ajeno = Cliente.objects.create(razon_social='Supermercado ajeno', nit='71002')
        cls.sucursal_ajena = Sucursal.objects.create(cliente=cls.ajeno, nombre='Sucursal ajena', direccion='Calle Tres')

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.supermercado)

    def origen(self, **cambios):
        return self.client.get('/api/v1/precios-acordados/productos-pedidos/', {
            'cliente': self.cliente.pk, 'desde': str(self.hoy), 'hasta': str(self.hoy), **cambios})

    def agregar_producto(self, nombre, pedido):
        producto = Producto.objects.create(nombre=nombre, categoria=self.categoria, unidad_medida=self.kg)
        presentacion = PresentacionProducto.objects.create(producto=producto, nombre='Caja', uso='pedido', columna_pedido='cajas')
        self.crear_detalle(pedido, presentacion, 2, producto=producto)
        return producto

    def test_productos_unicos_de_todas_sus_sucursales_sin_cantidades(self):
        producto_norte = self.agregar_producto('Banana del norte', self.pedido_norte)
        self.agregar_producto('Solo ajeno', self.crear_pedido(self.sucursal_ajena))
        self.agregar_producto('Cancelado', self.crear_pedido(self.centro, estado=Pedido.Estado.CANCELADO))
        self.agregar_producto('Otro día', self.crear_pedido(self.centro, fecha_requerida=self.hoy + timedelta(days=1)))
        respuesta = self.origen()
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 2)
        self.assertEqual({p['id'] for p in respuesta.data['results']}, {self.producto.pk, producto_norte.pk})
        self.assertEqual(set(respuesta.data['results'][0]), {'id', 'nombre', 'categoria_nombre', 'imagen'})
        self.assertEqual(respuesta['Cache-Control'], 'no-store')
        self.assertEqual(self.origen(hasta=str(self.hoy + timedelta(days=1))).data['count'], 3)

    def test_productos_filtrados_antes_de_paginar_de_diez_y_version_del_origen(self):
        for indice in range(11):
            self.agregar_producto(f'Producto {indice:02}', self.pedido_centro)
        primera, segunda = self.origen(page_size=500), self.origen(pagina=2)
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (12, 10, 2))
        self.assertEqual(primera.data['version_origen'], segunda.data['version_origen'])
        filtrada = self.origen(buscar='Papaya')
        self.assertEqual(filtrada.data['count'], 1)
        self.assertEqual(filtrada.data['version_origen'], primera.data['version_origen'])
        self.agregar_producto('Nuevo pedido', self.pedido_norte)
        self.assertNotEqual(self.origen().data['version_origen'], primera.data['version_origen'])

    def test_clientes_propuestas_historial_y_busqueda_se_limitan_antes_de_contar(self):
        propios = [guardar(self.actor, self.datos_precio()) for _ in range(12)]
        ajeno = guardar(self.actor, self.datos_precio(cliente=self.ajeno.pk))
        self.assertEqual(self.client.get('/api/v1/precios-acordados/').data['count'], 12)
        self.assertEqual(len(self.client.get('/api/v1/precios-acordados/?pagina=2').data['results']), 2)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/', {'cliente': self.ajeno.pk}).data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/', {'buscar': ajeno.codigo}).data['count'], 0)
        self.assertEqual(self.client.get(f'/api/v1/precios-acordados/{ajeno.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/precios-acordados/{ajeno.pk}/historial/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/precios-acordados/{propios[0].pk}/historial/').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/clientes/').data['count'], 1)
        self.assertEqual(self.origen(cliente=self.ajeno.pk).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/productos/').status_code, 403)

    def test_proponer_solo_productos_de_pedidos_y_cliente_propio(self):
        with self.assertRaises(PermissionDenied):
            guardar(self.supermercado, self.datos_precio(cliente=self.ajeno.pk))
        producto = self.agregar_producto('Producto ajeno', self.crear_pedido(self.sucursal_ajena))
        with self.assertRaises(ValidationError):
            guardar(self.supermercado, self.datos_precio(lineas=[{'producto': producto.pk, 'precio_kg': '3.00'}]))
        with self.assertRaises(ValidationError):
            guardar(self.supermercado, self.datos_precio(alcance='entregas', desde=None, hasta=None))
        with self.assertRaises(ValidationError):
            guardar(self.supermercado, self.datos_precio(desde=str(self.hoy + timedelta(days=1))))
        acuerdo = guardar(self.supermercado, self.datos_precio())
        self.assertEqual(acuerdo.lineas.get().precio_kg.as_tuple().exponent, -2)
        self.assertEqual(acuerdo.registrado_por_id, self.supermercado.pk)

    def test_supermercado_envia_y_solo_oficina_decide(self):
        acuerdo = guardar(self.supermercado, self.datos_precio())
        self.accion(acuerdo, 'presentar', actor=self.supermercado)
        for accion in ['aceptar', 'rechazar']:
            with self.subTest(accion=accion), self.assertRaises(PermissionDenied):
                self.accion(acuerdo, accion, actor=self.supermercado, motivo='No permitido')
        self.assertFalse(permisos_precios(self.supermercado)['aceptar'])
        self.assertEqual(self.accion(acuerdo, 'aceptar').estado, 'aceptado')
        self.assertTrue(RegistroActividad.objects.filter(modulo='precios', accion='presentar', actor=self.supermercado).exists())

    def test_revalidar_pedidos_al_enviar_y_conservar_propuesta_en_oficina(self):
        acuerdo = guardar(self.supermercado, self.datos_precio())
        Pedido.objects.filter(sucursal__cliente=self.cliente).update(estado=Pedido.Estado.CANCELADO)
        with self.assertRaises(ValidationError):
            self.accion(acuerdo, 'presentar', actor=self.supermercado)
        Pedido.objects.filter(sucursal__cliente=self.cliente).update(estado=Pedido.Estado.PENDIENTE)
        self.accion(acuerdo, 'presentar', actor=self.supermercado)
        Pedido.objects.filter(sucursal__cliente=self.cliente).update(estado=Pedido.Estado.CANCELADO)
        self.assertEqual(self.accion(acuerdo, 'aceptar').estado, 'aceptado')
        correccion = self.accion(acuerdo, 'nueva_version', actor=self.supermercado, motivo='Corregir precio')
        datos = self.datos_precio(version=version_acuerdo(correccion), lineas=[{'producto': self.producto.pk, 'precio_kg': '6.00'}])
        correccion = guardar(self.supermercado, datos, correccion.pk)
        self.assertEqual(self.accion(correccion, 'presentar', actor=self.supermercado).estado, 'propuesta')

    def test_revocar_asignacion_bloquea_consultas_y_reintentos(self):
        datos = self.datos_precio()
        acuerdo = guardar(self.supermercado, datos)
        Cliente.objects.filter(pk=self.cliente.pk).update(encargado_precios=None)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/').status_code, 403)
        with self.assertRaises(PermissionDenied):
            guardar(self.supermercado, datos)
        self.assertTrue(AcuerdoPrecio.objects.filter(pk=acuerdo.pk, estado='borrador').exists())

    def test_revocar_permiso_de_alcance_no_convierte_cuenta_en_oficina(self):
        datos = self.datos_precio()
        guardar(self.supermercado, datos)
        self.supermercado.user_permissions.remove(Permission.objects.get(codename='proponer_precios_propios'))
        with self.assertRaises(PermissionDenied):
            guardar(self.supermercado, datos)
        self.client.force_authenticate(Usuario.objects.get(pk=self.supermercado.pk))
        self.assertEqual(self.client.get('/api/v1/precios-acordados/').status_code, 403)

    def test_imagenes_actuales_privadas_limitadas_al_origen_o_acuerdo_propio(self):
        with TemporaryDirectory() as carpeta, override_settings(MEDIA_ROOT=carpeta):
            self.producto.imagen.save('papaya.webp', ContentFile(b'foto de prueba'), save=True)
            acuerdo = guardar(self.actor, self.datos_precio())
            ajeno = guardar(self.actor, self.datos_precio(cliente=self.ajeno.pk))
            ruta = f'/api/v1/precios-acordados/imagenes/{self.producto.pk}/'
            for consulta in [{'cliente': self.cliente.pk, 'desde': str(self.hoy), 'hasta': str(self.hoy)}, {'acuerdo': acuerdo.pk}]:
                respuesta = self.client.get(ruta, consulta)
                self.assertEqual(respuesta.status_code, 200)
                self.assertEqual(respuesta['Cache-Control'], 'private, no-store')
                for cerrar in respuesta._resource_closers:
                    cerrar()
            self.assertEqual(self.client.get(ruta, {'acuerdo': ajeno.pk}).status_code, 404)
            self.assertEqual(self.client.get(ruta).status_code, 400)
            Pedido.objects.filter(sucursal__cliente=self.cliente).update(estado=Pedido.Estado.CANCELADO)
            self.assertEqual(self.client.get(ruta, {'cliente': self.cliente.pk, 'desde': str(self.hoy), 'hasta': str(self.hoy)}).status_code, 404)
            respuesta = self.client.get(ruta, {'acuerdo': acuerdo.pk})
            self.assertEqual(respuesta.status_code, 200)
            for cerrar in respuesta._resource_closers:
                cerrar()

    def test_asignar_responsable_exige_permiso_y_no_otorga_roles(self):
        sin_permiso = Usuario.objects.create_user(email='editor@precios.test', cedula_identidad='71003')
        datos = {'encargado_precios_id': self.supermercado.pk, 'version': obtener_version(self.ajeno)}
        with self.assertRaises(PermissionDenied):
            guardar_registro(Cliente, sin_permiso, datos, self.ajeno)
        antes = set(self.supermercado.get_all_permissions())
        cliente = guardar_registro(Cliente, self.actor, datos, self.ajeno)
        self.assertEqual(cliente.encargado_precios_id, self.supermercado.pk)
        self.assertEqual(set(Usuario.objects.get(pk=self.supermercado.pk).get_all_permissions()), antes)
        self.assertTrue(RegistroActividad.objects.filter(modulo='clientes', objeto_id=str(cliente.pk), cambios__has_key='encargado_precios_id').exists())
        with self.assertRaises(ValidationError):
            guardar_registro(Cliente, self.actor, {'encargado_precios_id': self.actor.pk, 'version': obtener_version(cliente)}, cliente)

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_sesion_publica_y_flujo_http_con_csrf_sin_acceso_administrativo(self):
        navegador = APIClient(enforce_csrf_checks=True)
        navegador.force_login(self.supermercado)
        sesion = navegador.get('/api/v1/auth/me/').data
        self.assertTrue(sesion['precios_supermercado'])
        self.assertEqual(sesion['cliente_precios']['id'], self.cliente.pk)
        self.assertFalse(sesion['permisos_precios']['aceptar'])
        self.assertFalse(sesion['permisos_clientes']['ver'])
        self.assertEqual(navegador.get('/api/v1/clientes/').status_code, 404)
        self.assertEqual(navegador.get('/api/v1/precios-acordados/contexto/').data['cliente']['id'], self.cliente.pk)
        self.assertEqual(navegador.post('/api/v1/precios-acordados/', self.datos_precio(), format='json').status_code, 403)
        csrf = navegador.get('/api/v1/auth/csrf/').json()['csrfToken']
        respuesta = navegador.post('/api/v1/precios-acordados/', self.datos_precio(), format='json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': respuesta.data['version']}
        respuesta = navegador.post(f'/api/v1/precios-acordados/{respuesta.data["id"]}/presentar/', datos, format='json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.data['estado'], 'propuesta')
        respuesta = navegador.post(f'/api/v1/precios-acordados/{respuesta.data["id"]}/aceptar/',
            {'clave_operacion': str(uuid.uuid4()), 'version': respuesta.data['version']}, format='json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code, 403)

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_superusuario_publico_tambien_esta_limitado_al_cliente_asignado(self):
        self.client.force_authenticate(self.actor)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/').status_code, 403)
        Cliente.objects.filter(pk=self.cliente.pk).update(encargado_precios=self.actor)
        acuerdo = guardar(Usuario.objects.get(pk=self.actor.pk), self.datos_precio())
        respuesta = self.client.get('/api/v1/precios-acordados/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 1)
        with self.assertRaises(PermissionDenied):
            self.accion(acuerdo, 'aceptar', actor=self.actor)
