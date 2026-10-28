import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Permission, Group
from django.core.management import call_command
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from catalogos.models import CategoriaProducto, UnidadMedida
from clientes.models import Cliente, Sucursal
from pedidos.models import Pedido, DetallePedido
from productos.models import Producto, PresentacionProducto
from proveedores.models import Proveedor
from usuarios.models import Usuario
from .models import Compra
from .servicios import guardar_compra, registrar_compra, cancelar_compra, version_compra, ConflictoCompra


class PruebasCompras(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hoy = timezone.localdate()
        cls.fecha_pedidos = cls.hoy + timedelta(days=1)
        cls.admin = Usuario.objects.create_superuser(email='admin@compras.test', cedula_identidad='830001', password='ComprasSeguras_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@compras.test', cedula_identidad='830002')
        cls.sin_acceso = Usuario.objects.create_user(email='sinacceso@compras.test', cedula_identidad='830003')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='compras', codename='view_compra'))
        cls.categoria = CategoriaProducto.objects.create(nombre='Verduras')
        cls.unidad = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        cls.producto = Producto.objects.create(nombre='Tomate', categoria=cls.categoria, unidad_medida=cls.unidad)
        cls.otro_producto = Producto.objects.create(nombre='Lechuga', categoria=cls.categoria, unidad_medida=cls.unidad)
        cls.cajas = PresentacionProducto.objects.create(producto=cls.producto, nombre='Caja', uso='ambos', columna_pedido='cajas')
        cls.unidades = PresentacionProducto.objects.create(producto=cls.producto, nombre='Unidad', uso='pedido', columna_pedido='unidades')
        cls.otra_presentacion = PresentacionProducto.objects.create(producto=cls.otro_producto, nombre='Bolsa', uso='compra')
        cls.proveedor = Proveedor.objects.create(nombre='Productora principal')
        cls.otro_proveedor = Proveedor.objects.create(nombre='Productor secundario')
        cls.cliente = Cliente.objects.create(razon_social='Supermercado de prueba', nit='830000')
        cls.centro = Sucursal.objects.create(cliente=cls.cliente, nombre='Centro', direccion='Calle Uno')
        cls.sur = Sucursal.objects.create(cliente=cls.cliente, nombre='Sur', direccion='Calle Dos')
        cls.pedido_centro = cls.crear_pedido(cls.centro, cls.fecha_pedidos)
        cls.pedido_sur = cls.crear_pedido(cls.sur, cls.fecha_pedidos)
        cls.crear_detalle(cls.pedido_centro, cls.cajas, 'cajas', 6)
        cls.crear_detalle(cls.pedido_sur, cls.cajas, 'cajas', 4)
        cls.crear_detalle(cls.pedido_sur, cls.unidades, 'unidades', 5)
        cls.crear_detalle(cls.crear_pedido(cls.centro, cls.fecha_pedidos + timedelta(days=1)), cls.cajas, 'cajas', 99)
        cls.crear_detalle(cls.crear_pedido(cls.centro, cls.fecha_pedidos, 'preparado'), cls.cajas, 'cajas', 77)
        cls.crear_detalle(cls.crear_pedido(cls.centro, cls.fecha_pedidos, 'cancelado'), cls.cajas, 'cajas', 55)

    @classmethod
    def crear_pedido(cls, sucursal, fecha, estado='pendiente'):
        return Pedido.objects.create(sucursal=sucursal, fecha_requerida=fecha, estado=estado,
                                     creado_por=cls.admin, responsable=cls.admin, responsable_nombre='Responsable',
                                     cliente_nombre=cls.cliente.razon_social, sucursal_nombre=sucursal.nombre,
                                     direccion=sucursal.direccion, clave_operacion=uuid.uuid4(), huella_creacion='a' * 64)

    @classmethod
    def crear_detalle(cls, pedido, presentacion, columna, cantidad):
        return DetallePedido.objects.create(pedido=pedido, producto=cls.producto, presentacion=presentacion, columna=columna,
                                           cantidad=cantidad, producto_nombre='Tomate', presentacion_nombre=presentacion.nombre,
                                           categoria_nombre='Verduras')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def linea(self, **cambios):
        return {'producto': self.producto.pk, 'presentacion': self.cajas.pk, 'proveedor': self.proveedor.pk,
                'cantidad': '10', 'precio_unitario': '40', **cambios}

    def datos(self, **cambios):
        return {'fecha_pedidos': self.fecha_pedidos.isoformat(), 'fecha_compra': self.hoy.isoformat(),
                'detalles': [self.linea()], 'clave_operacion': str(uuid.uuid4()), **cambios}

    def crear_compra(self, **cambios):
        return guardar_compra(self.admin, self.datos(**cambios))[0]

    def accion(self, compra):
        return {'version': version_compra(compra), 'clave_operacion': str(uuid.uuid4())}

    def edicion(self, compra, **cambios):
        datos = self.datos(**cambios)
        datos.pop('clave_operacion')
        datos['version'] = version_compra(compra)
        return datos

    def test_dos_fechas_independientes_y_usuario_automatico(self):
        respuesta = self.client.post('/api/v1/compras/', self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['fecha_pedidos'], self.fecha_pedidos.isoformat())
        self.assertEqual(respuesta.data['fecha_compra'], self.hoy.isoformat())
        self.assertEqual(respuesta.data['estado'], 'borrador')
        self.assertEqual(respuesta.data['total'], '400.00')
        self.assertTrue(respuesta.data['creado_en'])
        compra = Compra.objects.get(pk=respuesta.data['id'])
        self.assertEqual(compra.responsable, self.admin)
        self.assertEqual(compra.pedidos_referencia.count(), 2)
        self.assertTrue(RegistroActividad.objects.filter(modulo='compras', accion='crear', objeto_id=str(compra.pk)).exists())

    def test_consulta_por_fecha_requerida_y_cant_uni_independientes(self):
        # Los pedidos se crearon hoy, pero solo los requeridos mañana aparecen.
        respuesta = self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat()})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['resumen'], {'pedidos': 2, 'sucursales': 2, 'productos': 1})
        self.assertEqual(respuesta.data['results'][0]['cajas'], 10)
        self.assertEqual(respuesta.data['results'][0]['unidades'], 5)
        self.assertEqual(self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.hoy.isoformat()}).data['count'], 0)
        por_sucursal = self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat(), 'vista': 'sucursales'})
        self.assertEqual(por_sucursal.data['count'], 3)
        self.assertEqual({fila['pedido'] for fila in por_sucursal.data['results']}, {self.pedido_centro.pk, self.pedido_sur.pk})

    def test_cambio_fecha_pedidos_no_usa_fecha_compra_como_filtro(self):
        otra_fecha = self.fecha_pedidos + timedelta(days=1)
        respuesta = self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': otra_fecha.isoformat(), 'fecha_compra': self.hoy.isoformat()})
        self.assertEqual(respuesta.data['results'][0]['cajas'], 99)
        compra = self.crear_compra(fecha_pedidos=(self.hoy - timedelta(days=2)).isoformat())
        self.assertEqual(compra.fecha_compra, self.hoy)

    def test_fechas_obligatorias_validas_y_compra_no_futura(self):
        for campo in ('fecha_pedidos', 'fecha_compra'):
            for valor in ('', '31/02/2026', None):
                with self.subTest(campo=campo, valor=valor):
                    respuesta = self.client.post('/api/v1/compras/', self.datos(**{campo: valor}), format='json')
                    self.assertEqual(respuesta.status_code, 400, respuesta.data)
                    self.assertIn(campo, respuesta.data['errors'])
        respuesta = self.client.post('/api/v1/compras/', self.datos(fecha_compra=self.fecha_pedidos.isoformat()), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('fecha_compra', respuesta.data['errors'])

    def test_borrador_incompleto_y_compra_sin_pedidos(self):
        vacia = self.crear_compra(detalles=[], fecha_pedidos=(self.fecha_pedidos + timedelta(days=10)).isoformat())
        self.assertEqual(vacia.total, Decimal('0'))
        self.assertEqual(vacia.pedidos_referencia.count(), 0)
        with self.assertRaises(ValidationError):
            registrar_compra(self.admin, vacia, self.accion(vacia))
        incompleta = self.crear_compra(detalles=[self.linea(proveedor=None, cantidad='0', precio_unitario='0')])
        with self.assertRaises(ValidationError):
            registrar_compra(self.admin, incompleta, self.accion(incompleta))
        compra = self.crear_compra(fecha_pedidos=(self.fecha_pedidos + timedelta(days=10)).isoformat())
        self.assertEqual(registrar_compra(self.admin, compra, self.accion(compra)).estado, 'registrada')

    def test_importes_calculados_decimal_y_redondeo_por_linea(self):
        compra = self.crear_compra(detalles=[self.linea(cantidad='0.005', precio_unitario='1.00'), self.linea(proveedor=self.otro_proveedor.pk, cantidad='0.005', precio_unitario='1.00')])
        self.assertEqual(compra.total, Decimal('0.02'))
        self.assertEqual(list(compra.detalles.values_list('subtotal', flat=True)), [Decimal('0.01'), Decimal('0.01')])
        with self.assertRaises(ValidationError):
            self.crear_compra(detalles=[self.linea(cantidad='999999999.999', precio_unitario='9999999999.99')])
        with self.assertRaises(ValidationError):
            self.crear_compra(detalles=[self.linea(cantidad='100', precio_unitario='9999999999.99'), self.linea(proveedor=self.otro_proveedor.pk, cantidad='100', precio_unitario='9999999999.99')])

    def test_campos_protegidos_y_detalles_malformados(self):
        for campo, valor in [('total', 1), ('estado', 'registrada'), ('responsable', self.lector.pk), ('creado_en', self.hoy.isoformat()), ('empleado', 1)]:
            respuesta = self.client.post('/api/v1/compras/', self.datos(**{campo: valor}), format='json')
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn(campo, respuesta.data['errors'])
        for linea, campo in [(self.linea(cantidad='-1'), 'cantidad'), (self.linea(cantidad='1.0001'), 'cantidad'),
                              (self.linea(precio_unitario='0.001'), 'precio_unitario'), (self.linea(subtotal='1'), 'subtotal')]:
            respuesta = self.client.post('/api/v1/compras/', self.datos(detalles=[linea]), format='json')
            self.assertEqual(respuesta.status_code, 400, respuesta.data)
            self.assertIn(f'detalle_0_{campo}', respuesta.data['errors'])

    def test_presentaciones_sin_equivalencias_y_proveedores_por_producto(self):
        for presentacion in (self.otra_presentacion.pk, self.unidades.pk):
            with self.assertRaises(ValidationError):
                self.crear_compra(detalles=[self.linea(presentacion=presentacion)])
        compra = self.crear_compra(detalles=[self.linea(), self.linea(proveedor=self.otro_proveedor.pk, presentacion=None, cantidad='2.5', precio_unitario='3')])
        self.assertEqual(compra.detalles.count(), 2)
        self.assertEqual(compra.total, Decimal('407.50'))
        self.assertEqual(compra.detalles.last().unidad_nombre, 'Kilogramo')
        with self.assertRaises(ValidationError):
            self.crear_compra(detalles=[self.linea(), self.linea()])

    def test_cambios_conservan_ids_y_fecha_creacion_y_exigen_version(self):
        compra = self.crear_compra()
        detalle = compra.detalles.get()
        fecha = compra.creado_en
        version = version_compra(compra)
        datos = self.edicion(compra, fecha_compra=(self.hoy - timedelta(days=1)).isoformat(), detalles=[self.linea(id=detalle.pk, cantidad='8')])
        respuesta = self.client.patch(f'/api/v1/compras/{compra.pk}/', datos, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['detalles'][0]['id'], detalle.pk)
        compra.refresh_from_db()
        self.assertEqual(compra.creado_en, fecha)
        self.assertEqual(compra.fecha_compra, self.hoy - timedelta(days=1))
        self.assertEqual(compra.total, Decimal('320.00'))
        datos['version'] = version
        self.assertEqual(self.client.patch(f'/api/v1/compras/{compra.pk}/', datos, format='json').status_code, 409)
        datos.pop('version')
        self.assertEqual(self.client.patch(f'/api/v1/compras/{compra.pk}/', datos, format='json').status_code, 400)

    def test_id_ajeno_o_duplicado_no_modifica_otras_compras(self):
        compra, otra = self.crear_compra(), self.crear_compra()
        for detalles in ([self.linea(id=otra.detalles.get().pk)], [self.linea(id=compra.detalles.get().pk), self.linea(id=compra.detalles.get().pk, proveedor=self.otro_proveedor.pk)]):
            with self.assertRaises(ValidationError):
                guardar_compra(self.admin, self.edicion(compra, detalles=detalles), compra)
        self.assertEqual(otra.detalles.get().cantidad, Decimal('10'))

    def test_reintento_creacion_no_duplica_y_rechaza_otros_datos(self):
        datos = self.datos()
        primera = self.client.post('/api/v1/compras/', datos, format='json')
        segunda = self.client.post('/api/v1/compras/', datos, format='json')
        self.assertEqual([primera.status_code, segunda.status_code], [201, 200])
        self.assertEqual(primera.data['id'], segunda.data['id'])
        self.assertEqual(Compra.objects.count(), 1)
        datos['fecha_compra'] = (self.hoy - timedelta(days=1)).isoformat()
        self.assertEqual(self.client.post('/api/v1/compras/', datos, format='json').status_code, 409)

    def test_registrar_congela_y_no_modifica_pedidos(self):
        compra = self.crear_compra()
        datos = self.accion(compra)
        antes = list(DetallePedido.objects.order_by('pk').values('id', 'cantidad', 'columna'))
        registrada = registrar_compra(self.admin, compra, datos)
        self.assertEqual(registrada.estado, 'registrada')
        self.assertEqual(registrar_compra(self.admin, compra, datos).pk, compra.pk)
        self.assertEqual(RegistroActividad.objects.filter(modulo='compras', accion='registrar', objeto_id=str(compra.pk)).count(), 1)
        self.assertEqual(list(DetallePedido.objects.order_by('pk').values('id', 'cantidad', 'columna')), antes)
        self.pedido_centro.refresh_from_db()
        self.assertEqual(self.pedido_centro.estado, 'pendiente')
        with self.assertRaises(ConflictoCompra):
            guardar_compra(self.admin, self.edicion(registrada), registrada)
        necesidades = self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat()})
        self.assertEqual(necesidades.data['compras_registradas'], 1)
        self.assertEqual(necesidades.data['results'][0]['cajas'], 10)

    def test_registro_revalida_referencias_inactivas_y_valores_positivos(self):
        for campo in ('proveedor', 'cantidad', 'precio_unitario'):
            compra = self.crear_compra(detalles=[self.linea(**{campo: None if campo == 'proveedor' else '0'})])
            with self.subTest(campo=campo), self.assertRaises(ValidationError):
                registrar_compra(self.admin, compra, self.accion(compra))
        compra = self.crear_compra()
        self.proveedor.activo = False
        self.proveedor.save()
        with self.assertRaises(ValidationError):
            registrar_compra(self.admin, compra, self.accion(compra))
        # Un borrador histórico sin cambios se puede conservar y corregir después.
        guardar_compra(self.admin, self.edicion(compra, detalles=[self.linea(id=compra.detalles.get().pk)]), compra)

    def test_cancelacion_con_motivo_conserva_historial_e_idempotencia(self):
        compra = self.crear_compra()
        datos = {**self.accion(compra), 'motivo': 'Compra duplicada'}
        cancelada = cancelar_compra(self.admin, compra, datos)
        self.assertEqual(cancelada.estado, 'cancelada')
        self.assertEqual(cancelada.detalles.count(), 1)
        self.assertEqual(cancelada.pedidos_referencia.count(), 2)
        self.assertEqual(cancelar_compra(self.admin, compra, datos).pk, compra.pk)
        self.assertEqual(RegistroActividad.objects.filter(modulo='compras', accion='cancelar', objeto_id=str(compra.pk)).count(), 1)
        self.assertEqual(self.client.post(f'/api/v1/compras/{compra.pk}/cancelar/', {**datos, 'motivo': ''}, format='json').status_code, 400)

    def test_copias_historicas_no_cambian_con_catalogos_o_pedidos(self):
        compra = self.crear_compra()
        registrar_compra(self.admin, compra, self.accion(compra))
        self.producto.nombre = 'Nombre cambiado'
        self.producto.save()
        self.proveedor.nombre = 'Proveedor cambiado'
        self.proveedor.save()
        self.cajas.nombre = 'Presentación cambiada'
        self.cajas.save()
        DetallePedido.objects.filter(pedido=self.pedido_centro).update(cantidad=20)
        respuesta = self.client.get(f'/api/v1/compras/{compra.pk}/')
        self.assertEqual(respuesta.data['detalles'][0]['producto_nombre'], 'Tomate')
        self.assertEqual(respuesta.data['detalles'][0]['proveedor_nombre'], 'Productora principal')
        self.assertEqual(respuesta.data['detalles'][0]['presentacion_nombre'], 'Caja')
        self.assertEqual(respuesta.data['pedidos_referencia'][0]['detalles'][0]['cantidad'], 6)
        with self.assertRaises(ProtectedError):
            self.proveedor.delete()

    def test_permisos_http_servicios_y_necesidades(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/compras/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat()}).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/compras/', self.datos(), format='json').status_code, 403)
        with self.assertRaises(PermissionDenied):
            guardar_compra(self.lector, self.datos())
        compra = self.crear_compra()
        for accion, servicio in [('registrar', registrar_compra), ('cancelar', cancelar_compra)]:
            with self.assertRaises(PermissionDenied):
                servicio(self.lector, compra, {**self.accion(compra), 'motivo': 'No autorizado'})
            self.assertEqual(self.client.post(f'/api/v1/compras/{compra.pk}/{accion}/', self.accion(compra), format='json').status_code, 403)
        self.client.force_authenticate(self.sin_acceso)
        self.assertEqual(self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat()}).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/v1/compras/').status_code, (401, 403))

    def test_selectores_propios_sin_permisos_administrativos(self):
        self.client.force_authenticate(self.lector)
        for ruta in ('productos/', 'proveedores/', f'presentaciones/?producto={self.producto.pk}'):
            self.assertEqual(self.client.get(f'/api/v1/compras/{ruta}').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/proveedores/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/v1/compras/presentaciones/?producto={self.producto.pk}').data['results'], [{'id': self.cajas.pk, 'nombre': 'Caja'}])

    def test_proveedores_del_producto_filtran_categoria_y_todos_incluye_sin_categoria(self):
        frutas = CategoriaProducto.objects.create(nombre='Frutas')
        verdulero = Proveedor.objects.create(nombre='Verdulero', categoria=self.categoria)
        frutero = Proveedor.objects.create(nombre='Frutero', categoria=frutas)
        Proveedor.objects.create(nombre='Verdulero inactivo', categoria=self.categoria, activo=False)
        ruta = '/api/v1/compras/proveedores/'
        respuesta = self.client.get(ruta, {'producto': self.producto.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual([fila['id'] for fila in respuesta.data['results']], [verdulero.pk])
        self.assertEqual(respuesta.data['categoria_producto'], {'id': self.categoria.pk, 'nombre': 'Verduras'})
        self.assertEqual(respuesta.data['results'][0]['categoria']['nombre'], 'Verduras')
        todos = self.client.get(ruta, {'producto': self.producto.pk, 'todos': 'true'})
        self.assertEqual(todos.data['count'], 4)
        self.assertIn(frutero.pk, [fila['id'] for fila in todos.data['results']])
        self.assertIn(self.proveedor.pk, [fila['id'] for fila in todos.data['results']])
        self.assertIsNone(next(fila for fila in todos.data['results'] if fila['id'] == self.proveedor.pk)['categoria'])
        # Los consumidores existentes sin producto conservan la consulta general.
        self.assertEqual(self.client.get(ruta).data['count'], todos.data['count'])

    def test_proveedores_filtrados_busqueda_paginacion_y_parametros_validos(self):
        for indice in range(12):
            Proveedor.objects.create(nombre=f'Agricultor {indice:02d}', categoria=self.categoria)
        ruta = '/api/v1/compras/proveedores/'
        filtros = {'producto': self.producto.pk, 'buscar': 'Agricultor', 'page_size': 100}
        primera = self.client.get(ruta, filtros)
        segunda = self.client.get(ruta, {**filtros, 'pagina': 2})
        self.assertEqual(primera.data['count'], 12)
        self.assertEqual(len(primera.data['results']), 10)
        self.assertEqual(len(segunda.data['results']), 2)
        self.assertFalse({fila['id'] for fila in primera.data['results']} & {fila['id'] for fila in segunda.data['results']})
        self.assertEqual(self.client.get(ruta, {'producto': self.producto.pk, 'buscar': 'Sin coincidencia'}).data['count'], 0)
        for filtros_invalidos in ({'producto': 99999999}, {'producto': 0}, {'todos': 'invalido'}, {'categoria': -1}):
            respuesta = self.client.get(ruta, filtros_invalidos)
            self.assertEqual(respuesta.status_code, 400, respuesta.data)

    def test_productos_por_categoria_y_categorias_paginadas_solo_activas(self):
        frutas = CategoriaProducto.objects.create(nombre='Frutas')
        inactiva = CategoriaProducto.objects.create(nombre='Categoría retirada', activo=False)
        fruta = Producto.objects.create(nombre='Papaya', categoria=frutas, unidad_medida=self.unidad)
        Producto.objects.create(nombre='Papaya retirada', categoria=frutas, unidad_medida=self.unidad, activo=False)
        productos = self.client.get('/api/v1/compras/productos/', {'categoria': frutas.pk, 'buscar': 'Papaya'})
        self.assertEqual([fila['id'] for fila in productos.data['results']], [fruta.pk])
        self.assertEqual(productos.data['results'][0]['categoria'], {'id': frutas.pk, 'nombre': 'Frutas'})
        self.assertEqual(self.client.get('/api/v1/compras/productos/', {'categoria': self.categoria.pk, 'buscar': 'Papaya'}).data['count'], 0)
        for indice in range(11):
            CategoriaProducto.objects.create(nombre=f'Categoría {indice:02d}')
        categorias = self.client.get('/api/v1/compras/categorias/', {'buscar': 'Categoría', 'page_size': 100})
        self.assertEqual(categorias.data['count'], 11)
        self.assertEqual(len(categorias.data['results']), 10)
        segunda = self.client.get('/api/v1/compras/categorias/', {'buscar': 'Categoría', 'pagina': 2})
        self.assertEqual(len(segunda.data['results']), 1)
        self.assertNotIn(inactiva.pk, [fila['id'] for fila in categorias.data['results'] + segunda.data['results']])

    def test_nuevos_filtros_respetan_permiso_compras_y_consulta_auditada(self):
        self.client.force_authenticate(self.lector)
        respuesta = self.client.get('/api/v1/compras/categorias/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(self.client.get('/api/v1/compras/proveedores/', {'producto': self.producto.pk}).status_code, 200)
        self.assertTrue(RegistroActividad.objects.filter(modulo='compras', ruta__contains='/compras/categorias/').exists())
        self.client.force_authenticate(self.sin_acceso)
        self.assertEqual(self.client.get('/api/v1/compras/categorias/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/compras/proveedores/', {'producto': self.producto.pk}).status_code, 403)

    def test_listados_selectores_y_necesidades_siempre_diez(self):
        for indice in range(12):
            self.crear_compra()
            Proveedor.objects.create(nombre=f'Proveedor {indice:02}')
            self.crear_detalle(self.crear_pedido(self.centro, self.fecha_pedidos), self.cajas, 'cajas', 1)
        self.assertEqual(len(self.client.get('/api/v1/compras/?page_size=100&tamano=100').data['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/compras/?pagina=2').data['results']), 2)
        self.assertEqual(len(self.client.get('/api/v1/compras/proveedores/?page_size=100').data['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat(), 'vista': 'sucursales', 'page_size': 100}).data['results']), 10)
        self.assertEqual(self.client.get('/api/v1/compras/resumen/?estado=registrada').data['borradores'], 12)

    def test_filtros_de_cada_fecha_y_busqueda(self):
        compra = self.crear_compra()
        self.assertEqual(self.client.get('/api/v1/compras/', {'fecha_pedidos': self.fecha_pedidos.isoformat(), 'fecha_compra': self.hoy.isoformat()}).data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/compras/', {'fecha_pedidos': self.hoy.isoformat()}).data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/compras/', {'fecha_compra': self.fecha_pedidos.isoformat()}).data['count'], 0)
        for buscar in ('Tomate', 'Productora', compra.codigo):
            self.assertEqual(self.client.get('/api/v1/compras/', {'buscar': buscar}).data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/compras/necesidades/').status_code, 400)
        self.producto.nombre = 'Tomate fresco'
        self.producto.save()
        respuesta = self.client.get('/api/v1/compras/necesidades/', {'fecha_pedidos': self.fecha_pedidos.isoformat(), 'buscar': 'fresco'})
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['cajas'], 10)

    def test_auditoria_fallida_revierte_todas_las_operaciones(self):
        compra = self.crear_compra()
        with patch('compras.servicios.registrar_actividad', side_effect=RuntimeError('Sin evidencia')):
            with self.assertRaises(RuntimeError):
                guardar_compra(self.admin, self.datos())
            with self.assertRaises(RuntimeError):
                guardar_compra(self.admin, self.edicion(compra, observaciones='No persistir'), compra)
            with self.assertRaises(RuntimeError):
                registrar_compra(self.admin, compra, self.accion(compra))
            with self.assertRaises(RuntimeError):
                cancelar_compra(self.admin, compra, {**self.accion(compra), 'motivo': 'No persistir'})
        compra.refresh_from_db()
        self.assertEqual(Compra.objects.count(), 1)
        self.assertEqual(compra.estado, 'borrador')
        self.assertEqual(compra.observaciones, '')

    def test_rol_independiente_y_sesion(self):
        rol = Group.objects.create(name='Administrador de compras')
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(rol.permissions.count(), 0)
        rol.delete()
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(Group.objects.get(name='Administrador de compras').permissions.count(), 5)
        self.client.force_authenticate(self.lector)
        permisos = self.client.get('/api/v1/auth/me/').data['permisos_compras']
        self.assertEqual(permisos, {'ver': True, 'crear': False, 'editar': False, 'registrar': False, 'cancelar': False})

    def test_no_borrar_ni_editar_totalmente(self):
        compra = self.crear_compra()
        self.assertEqual(self.client.delete(f'/api/v1/compras/{compra.pk}/').status_code, 405)
        self.assertEqual(self.client.put(f'/api/v1/compras/{compra.pk}/', self.datos(), format='json').status_code, 405)
