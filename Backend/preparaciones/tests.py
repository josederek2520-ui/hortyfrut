import uuid
from io import BytesIO
from tempfile import TemporaryDirectory
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from PIL import Image
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError, PermissionDenied
from usuarios.models import Usuario
from clientes.models import Cliente, Sucursal
from productos.models import Producto, PresentacionProducto
from catalogos.models import CategoriaProducto, UnidadMedida
from pedidos.models import Pedido, DetallePedido
from pedidos.servicios import cancelar_pedido, obtener_version, ConflictoPedido
from almacenes.models import Almacen
from inventario.models import Lote, MovimientoInventario
from inventario.consultas import lotes_con_saldo
from inventario.servicios import cambiar_estado_lote, version_lote
from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion
from cajillas.models import MovimientoCajilla
from cajillas.servicios import crear_cajilla
from .models import Preparacion
from .consultas import version_preparacion, avance_detalles
from .servicios import guardar_preparacion, confirmar_preparacion, cancelar_preparacion, ConflictoPreparacion


class DatosPreparaciones:
    @classmethod
    def preparar_datos(cls):
        cls.hoy = timezone.localdate()
        cls.actor = Usuario.objects.create_superuser(email='admin@preparaciones.test', cedula_identidad='94001', password='Preparaciones_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@preparaciones.test', cedula_identidad='94002')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='preparaciones', codename='view_preparacion'))
        cls.cliente = Cliente.objects.create(razon_social='Supermercado', nit='94001')
        cls.centro = Sucursal.objects.create(cliente=cls.cliente, nombre='Centro', direccion='Calle Uno')
        cls.norte = Sucursal.objects.create(cliente=cls.cliente, nombre='Norte', direccion='Calle Dos')
        cls.almacen = Almacen.objects.create(nombre='Central', direccion='Avenida Uno')
        cls.categoria = CategoriaProducto.objects.create(nombre='Frutas')
        cls.kg = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        cls.producto = Producto.objects.create(nombre='Papaya', categoria=cls.categoria, unidad_medida=cls.kg)
        cls.cajas = PresentacionProducto.objects.create(producto=cls.producto, nombre='Caja', uso='ambos', columna_pedido='cajas')
        cls.unidades = PresentacionProducto.objects.create(producto=cls.producto, nombre='Unidad', uso='pedido', columna_pedido='unidades')
        cls.pedido_centro = cls.crear_pedido(cls.centro)
        cls.pedido_norte = cls.crear_pedido(cls.norte)
        cls.centro_cajas = cls.crear_detalle(cls.pedido_centro, cls.cajas, 2)
        cls.centro_uni = cls.crear_detalle(cls.pedido_centro, cls.unidades, 4)
        cls.norte_cajas = cls.crear_detalle(cls.pedido_norte, cls.cajas, 3)
        cls.norte_uni = cls.crear_detalle(cls.pedido_norte, cls.unidades, 6)
        recepcion, _ = guardar_recepcion(cls.actor, {'compra': None, 'almacen': cls.almacen.pk, 'fecha_recepcion': str(cls.hoy - timedelta(days=2)), 'clave_operacion': str(uuid.uuid4()),
            'detalles': [{'producto': cls.producto.pk, 'unidad_inventario': cls.kg.pk, 'cantidad_inventario': '200'}]})
        confirmar_recepcion(cls.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        cls.lote = Lote.objects.get()
        cls.cajilla = crear_cajilla(cls.actor, {'color': 'Verde', 'cantidad_inicial': 100, 'almacen': cls.almacen.pk, 'clave_operacion': str(uuid.uuid4())})[0]

    @classmethod
    def crear_pedido(cls, sucursal, **cambios):
        return Pedido.objects.create(sucursal=sucursal, cliente_nombre=sucursal.cliente.razon_social, sucursal_nombre=sucursal.nombre,
            responsable=cls.actor, creado_por=cls.actor, responsable_nombre='Responsable', direccion=sucursal.direccion,
            fecha_requerida=cambios.pop('fecha_requerida', cls.hoy), clave_operacion=uuid.uuid4(), huella_creacion='a' * 64, **cambios)

    @classmethod
    def crear_detalle(cls, pedido, presentacion, cantidad, producto=None):
        return DetallePedido.objects.create(pedido=pedido, producto=producto or cls.producto, presentacion=presentacion,
            columna=presentacion.columna_pedido, cantidad=cantidad, producto_nombre=(producto or cls.producto).nombre,
            presentacion_nombre=presentacion.nombre, categoria_nombre=cls.categoria.nombre)

    def datos(self, **cambios):
        return {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy), 'almacen': self.almacen.pk, 'clave_operacion': str(uuid.uuid4()),
            'lineas': [{'lote': self.lote.pk, 'cantidad_utilizada': '50'}],
            'asignaciones': [self.asignacion(self.centro_cajas, 2, '20'), self.asignacion(self.norte_cajas, 3, '30')], 'cajillas': [], **cambios}

    def asignacion(self, detalle, cantidad, real):
        return {'detalle_pedido': detalle.pk, 'cantidad': cantidad, 'aportes': [{'lote': self.lote.pk, 'cantidad': real}]}

    def crear(self, **cambios):
        return guardar_preparacion(self.actor, self.datos(**cambios))[0]

    def accion(self, preparacion, **cambios):
        return {'version': version_preparacion(preparacion), 'clave_operacion': str(uuid.uuid4()), **cambios}

    def confirmar(self, preparacion):
        return confirmar_preparacion(self.actor, preparacion, self.accion(preparacion))


class PruebasPreparaciones(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def test_hoja_consolida_fecha_cliente_sucursales_y_cant_uni_independientes(self):
        self.crear_detalle(self.crear_pedido(self.centro, estado='cancelado'), self.cajas, 99)
        self.crear_detalle(self.crear_pedido(self.centro, fecha_requerida=self.hoy + timedelta(days=1)), self.cajas, 50)
        respuesta = self.client.get('/api/v1/preparaciones/consolidado/', {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy)})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['resumen']['pedidos'], 2)
        self.assertEqual((respuesta.data['results'][0]['cajas'], respuesta.data['results'][0]['unidades']), (5, 10))
        self.assertEqual(respuesta.data['sucursales']['count'], 2)
        self.assertEqual(respuesta.data['results'][0]['sucursales'][str(self.centro.pk)]['cajas']['solicitada'], 2)

    def test_borrador_no_modifica_inventario_pedidos_ni_cajillas(self):
        preparacion = self.crear(cajillas=[{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 2}])
        self.assertEqual(preparacion.estado, 'borrador')
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('200'))
        self.assertEqual(avance_detalles([self.centro_cajas.pk]), {})
        self.assertEqual(MovimientoCajilla.objects.count(), 1)

    def test_confirmar_parcial_solo_cant_no_completa_uni_ni_pedido(self):
        preparacion = self.confirmar(self.crear())
        self.pedido_centro.refresh_from_db()
        self.assertEqual(self.pedido_centro.estado, 'pendiente')
        self.assertEqual(avance_detalles([self.centro_cajas.pk]), {self.centro_cajas.pk: 2})
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('150'))
        self.assertEqual(preparacion.movimiento_salida.naturaleza, 'salida')
        self.assertEqual(preparacion.movimiento_salida.referencia_tipo, 'preparacion')

    def test_segunda_preparacion_completa_solo_pendiente_y_cambia_estado(self):
        self.confirmar(self.crear())
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '10'}],
            asignaciones=[self.asignacion(self.centro_uni, 4, '4'), self.asignacion(self.norte_uni, 6, '6')]))
        self.pedido_centro.refresh_from_db()
        self.pedido_norte.refresh_from_db()
        self.assertEqual(self.pedido_centro.estado, 'preparado')
        self.assertEqual(self.pedido_norte.estado, 'preparado')
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('140'))
        respuesta = self.client.get('/api/v1/preparaciones/consolidado/', {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy), 'vista': 'pendiente'})
        self.assertEqual(respuesta.data['count'], 0)

    def test_confirmacion_idempotente_no_duplica_salida(self):
        preparacion = self.crear()
        datos = self.accion(preparacion)
        confirmar_preparacion(self.actor, preparacion, datos)
        confirmar_preparacion(self.actor, preparacion, datos)
        self.assertEqual(MovimientoInventario.objects.filter(tipo='salida_preparacion').count(), 1)
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('150'))

    def test_merma_y_aprovechable_separados_del_pedido(self):
        preparacion = self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '65', 'merma': '5', 'aprovechable': '10', 'motivo_separacion': 'Revisión de calidad'}]))
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('135'))
        retenido = preparacion.lineas.get().lote_aprovechable
        self.assertEqual(lotes_con_saldo().get(pk=retenido.pk).saldo, Decimal('10'))
        self.assertEqual(retenido.calidad, 'aprovechable')
        self.assertEqual(retenido.lote_origen_id, self.lote.pk)
        self.assertEqual(retenido.codigo_lote, retenido.codigo)
        self.assertTrue(retenido.codigo.startswith(f'L{self.hoy:%d%m%y}-'))
        self.assertEqual(avance_detalles([self.centro_cajas.pk])[self.centro_cajas.pk], 2)
        with self.assertRaises(ValidationError):
            cambiar_estado_lote(self.actor, retenido, {'estado': 'disponible', 'version': version_lote(retenido)})

    def test_codigo_corto_se_busca_y_comparte_consecutivo_con_aprovechable(self):
        recepcion, _ = guardar_recepcion(self.actor, {
            'compra': None, 'almacen': self.almacen.pk, 'fecha_recepcion': str(self.hoy), 'clave_operacion': str(uuid.uuid4()),
            'detalles': [{'producto': self.producto.pk, 'unidad_inventario': self.kg.pk, 'cantidad_inventario': '5'}],
        })
        recepcion = confirmar_recepcion(self.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        nuevo = recepcion.detalles.get().lote
        self.assertEqual(nuevo.codigo, f'L{self.hoy:%d%m%y}-01')
        respuesta = self.client.get('/api/v1/preparaciones/lotes/', {
            'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy), 'almacen': self.almacen.pk,
            'producto': self.producto.pk, 'buscar': nuevo.codigo.lower(),
        })
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual([fila['id'] for fila in respuesta.data['results']], [nuevo.pk])
        preparacion = self.confirmar(self.crear(lineas=[{
            'lote': self.lote.pk, 'cantidad_utilizada': '65', 'merma': '5', 'aprovechable': '10', 'motivo_separacion': 'Revisión de calidad',
        }]))
        aprovechable = preparacion.lineas.get().lote_aprovechable
        self.assertEqual(aprovechable.codigo, f'L{self.hoy:%d%m%y}-02')

    def test_sin_equivalencias_balance_real_debe_coincidir(self):
        preparacion = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '51'}])
        with self.assertRaises(ValidationError):
            self.confirmar(preparacion)
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('200'))

    def test_no_sobrepreparar_otra_preparacion_ya_confirmada(self):
        otro = self.crear()
        self.confirmar(self.crear())
        with self.assertRaises(ValidationError):
            self.confirmar(otro)

    def test_no_sobreconsumir_lote_bloqueado_vencido_o_inactivo(self):
        for campo, valor in [('estado', 'bloqueado'), ('fecha_vencimiento', self.hoy - timedelta(days=1))]:
            preparacion = self.crear()
            anterior = getattr(self.lote, campo)
            setattr(self.lote, campo, valor)
            self.lote.save()
            with self.assertRaises(ValidationError):
                self.confirmar(preparacion)
            setattr(self.lote, campo, anterior)
            self.lote.save()
        preparacion = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '201', 'merma': '151', 'motivo_separacion': 'Daño'}])
        with self.assertRaises(ValidationError):
            self.confirmar(preparacion)

    def test_pedido_preparado_parcialmente_no_se_cancela_ni_editable(self):
        self.confirmar(self.crear())
        self.pedido_centro.refresh_from_db()
        with self.assertRaises(ConflictoPedido):
            cancelar_pedido(self.actor, self.pedido_centro, {'version': obtener_version(self.pedido_centro)})
        datos = self.client.get(f'/api/v1/pedidos/{self.pedido_centro.pk}/').data
        self.assertTrue(datos['bloqueado_preparacion'])
        self.assertFalse(datos['puede_editar'])
        self.assertEqual(next(fila for fila in datos['detalles'] if fila['id'] == self.centro_cajas.pk)['cantidad_preparada'], 2)

    def test_confirmada_no_se_cancela_y_cancelar_borrador_no_genera_stock(self):
        borrador = self.crear()
        datos = self.accion(borrador, motivo='Reprogramación')
        cancelar_preparacion(self.actor, borrador, datos)
        cancelar_preparacion(self.actor, borrador, datos)
        with self.assertRaises(ConflictoPreparacion):
            self.confirmar(borrador)
        confirmada = self.confirmar(self.crear())
        with self.assertRaises(ConflictoPreparacion):
            cancelar_preparacion(self.actor, confirmada, self.accion(confirmada, motivo='Error'))

    def test_auditoria_fallida_revierte_lotes_movimientos_y_avance(self):
        preparacion = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '60', 'aprovechable': '10', 'motivo_separacion': 'Calidad'}])
        with patch('preparaciones.servicios.registrar_actividad', side_effect=RuntimeError('sin evidencia')):
            with self.assertRaises(RuntimeError):
                self.confirmar(preparacion)
        self.assertEqual(Lote.objects.count(), 1)
        self.assertEqual(MovimientoInventario.objects.count(), 1)
        self.assertEqual(avance_detalles([self.centro_cajas.pk]), {})
        preparacion.refresh_from_db()
        self.assertEqual(preparacion.estado, 'borrador')

    def test_lector_preparacion_consulta_fuentes_sin_permisos_administrativos(self):
        self.client.force_authenticate(self.lector)
        respuesta = self.client.get('/api/v1/preparaciones/necesidades/', {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy)})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertNotIn('direccion', respuesta.data['results'][0])
        self.assertEqual(self.client.get('/api/v1/pedidos/').status_code, 403)
        with self.assertRaises(PermissionDenied):
            guardar_preparacion(self.lector, self.datos())

    def test_version_hoja_detecta_edicion_para_impresion_consistente(self):
        filtros = {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy)}
        hoja = self.client.get('/api/v1/preparaciones/consolidado/', filtros).data
        self.pedido_centro.observaciones = 'Cambio'
        self.pedido_centro.save()
        self.assertEqual(self.client.get('/api/v1/preparaciones/consolidado/', {**filtros, 'version_hoja': hoja['version_hoja']}).status_code, 409)

    def test_http_documento_completo_y_campos_controlados(self):
        respuesta = self.client.post('/api/v1/preparaciones/', self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        preparacion = Preparacion.objects.get(pk=respuesta.data['id'])
        confirmada = self.client.post(f'/api/v1/preparaciones/{preparacion.pk}/confirmar/', self.accion(preparacion), format='json')
        self.assertEqual(confirmada.status_code, 200, confirmada.data)
        self.assertTrue(confirmada.data['salida_codigo'])
        self.assertEqual(self.client.delete(f'/api/v1/preparaciones/{preparacion.pk}/').status_code, 405)
        self.assertEqual(self.client.post('/api/v1/preparaciones/', {**self.datos(), 'estado': 'confirmada'}, format='json').status_code, 400)

    def test_crear_y_confirmar_desde_hoja_respeta_permiso_editar_separado(self):
        self.lector.user_permissions.add(*Permission.objects.filter(
            content_type__app_label='preparaciones', codename__in=['add_preparacion', 'confirmar_preparacion']))
        self.client.force_authenticate(self.lector)
        respuesta = self.client.post('/api/v1/preparaciones/', self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        ruta = f'/api/v1/preparaciones/{respuesta.data["id"]}/'
        self.assertEqual(self.client.patch(ruta, {'version': respuesta.data['version']}, format='json').status_code, 403)
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('200'))
        accion = {'version': respuesta.data['version'], 'clave_operacion': str(uuid.uuid4())}
        for _ in range(2):
            confirmada = self.client.post(f'{ruta}confirmar/', accion, format='json')
            self.assertEqual(confirmada.status_code, 200, confirmada.data)
        self.assertEqual(MovimientoInventario.objects.filter(tipo='salida_preparacion').count(), 1)
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('150'))


class PruebasImagenesTrabajoPreparacion(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.directorio = TemporaryDirectory()
        self.addCleanup(self.directorio.cleanup)
        configuracion = override_settings(MEDIA_ROOT=self.directorio.name)
        configuracion.enable()
        self.addCleanup(configuracion.disable)
        archivo = BytesIO()
        Image.new('RGB', (24, 24), color='orange').save(archivo, 'WEBP')
        self.producto.imagen.save('papaya.webp', ContentFile(archivo.getvalue()), save=True)
        self.filtros = {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy)}
        self.ruta = f'/api/v1/preparaciones/imagenes/{self.producto.pk}/'
        self.client = APIClient()
        self.client.force_authenticate(self.lector)

    def test_foto_operativa_no_exige_administrar_catalogo(self):
        respuesta = self.client.get('/api/v1/preparaciones/productos/', self.filtros)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        producto = respuesta.data['results'][0]
        self.assertEqual((producto['pendientes_cajas'], producto['pendientes_unidades']), (5, 10))
        self.assertEqual(producto['categoria'], {'id': self.categoria.pk, 'nombre': 'Frutas'})
        foto = self.client.get(producto['imagen'])
        self.assertEqual(foto.status_code, 200)
        self.assertEqual(foto['Content-Type'], 'image/webp')
        self.assertIn('private', foto['Cache-Control'])
        self.assertEqual(foto['X-Content-Type-Options'], 'nosniff')
        self.assertTrue(b''.join(foto.streaming_content))
        self.assertEqual(self.client.get(f'/api/v1/productos/{self.producto.pk}/imagen/').status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.ruta, self.filtros).status_code, (401, 403))

    def test_foto_limitada_a_productos_de_cliente_y_fecha(self):
        otro = Cliente.objects.create(razon_social='Otro cliente', nit='94003')
        self.assertEqual(self.client.get(self.ruta, {**self.filtros, 'cliente': otro.pk}).status_code, 404)
        self.assertEqual(self.client.get(self.ruta, {**self.filtros, 'fecha_pedidos': str(self.hoy + timedelta(days=1))}).status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/preparaciones/imagenes/{self.producto.pk + 9999}/', self.filtros).status_code, 404)
        self.producto.imagen = ''
        self.producto.save(update_fields=['imagen'])
        self.assertEqual(self.client.get(self.ruta, self.filtros).status_code, 404)
        productos = self.client.get('/api/v1/preparaciones/productos/', self.filtros).data
        self.assertIsNone(productos['results'][0]['imagen'])

    def test_fotos_y_categoria_se_conservan_al_reabrir_borrador_historico(self):
        preparacion = self.crear()
        respuesta = self.client.get(f'/api/v1/preparaciones/{preparacion.pk}/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        for fila in [*respuesta.data['lineas'], *respuesta.data['asignaciones']]:
            self.assertTrue(fila['producto_imagen'].startswith(self.ruta))
            self.assertEqual(fila['producto_categoria']['id'], self.categoria.pk)
        self.pedido_centro.estado = 'cancelado'
        self.pedido_centro.save()
        self.pedido_norte.estado = 'cancelado'
        self.pedido_norte.save()
        foto = self.client.get(respuesta.data['lineas'][0]['producto_imagen'])
        self.assertEqual(foto.status_code, 200)
        self.assertTrue(b''.join(foto.streaming_content))

    def test_categoria_filtra_productos_con_paginacion_fija_y_fotos_en_consolidado(self):
        categoria = CategoriaProducto.objects.create(nombre='Verduras')
        for indice in range(11):
            producto = Producto.objects.create(nombre=f'Verdura {indice:02}', categoria=categoria, unidad_medida=self.kg)
            presentacion = PresentacionProducto.objects.create(producto=producto, nombre='Caja', uso='pedido', columna_pedido='cajas')
            self.crear_detalle(self.pedido_centro, presentacion, 1, producto=producto)
        primera = self.client.get('/api/v1/preparaciones/productos/', {**self.filtros, 'categoria': categoria.pk}).data
        segunda = self.client.get('/api/v1/preparaciones/productos/', {**self.filtros, 'categoria': categoria.pk, 'pagina': 2}).data
        self.assertEqual(primera['count'], 11)
        self.assertEqual((len(primera['results']), len(segunda['results'])), (10, 1))
        self.assertTrue(all(fila['categoria']['id'] == categoria.pk and fila['imagen'] is None for fila in primera['results']))
        hoja = self.client.get('/api/v1/preparaciones/consolidado/', {**self.filtros, 'categoria': self.categoria.pk}).data
        self.assertEqual(hoja['count'], 1)
        self.assertTrue(hoja['results'][0]['imagen'].startswith(self.ruta))
