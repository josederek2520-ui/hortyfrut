import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from productos.models import Producto, PresentacionProducto
from inventario.models import Lote
from cajillas.models import MovimientoCajilla
from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion
from .tests import DatosPreparaciones
from .servicios import datos_documento, guardar_preparacion
from .consultas import version_preparacion


class PruebasCajillasProducto(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()
        cls.banana = Producto.objects.create(nombre='Banana', categoria=cls.categoria, unidad_medida=cls.kg)
        presentacion = PresentacionProducto.objects.create(producto=cls.banana, nombre='Caja', uso='ambos', columna_pedido='cajas')
        cls.banana_centro = cls.crear_detalle(cls.pedido_centro, presentacion, 2, producto=cls.banana)
        recepcion, _ = guardar_recepcion(cls.actor, {'compra': None, 'almacen': cls.almacen.pk, 'fecha_recepcion': str(cls.hoy),
            'clave_operacion': str(uuid.uuid4()), 'detalles': [{'producto': cls.banana.pk, 'unidad_inventario': cls.kg.pk, 'cantidad_inventario': '40'}]})
        confirmar_recepcion(cls.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        cls.lote_banana = Lote.objects.get(producto=cls.banana)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def plan(self, producto=None, cantidad=2, **cambios):
        return {'sucursal': self.centro.pk, 'producto': producto, 'cajilla': self.cajilla.pk, 'cantidad': cantidad, **cambios}

    def crear_dos_productos(self, **cambios):
        return self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '50'}, {'lote': self.lote_banana.pk, 'cantidad_utilizada': '20'}],
            asignaciones=[self.asignacion(self.centro_cajas, 2, '20'), self.asignacion(self.norte_cajas, 3, '30'),
                {'detalle_pedido': self.banana_centro.pk, 'cantidad': 2, 'aportes': [{'lote': self.lote_banana.pk, 'cantidad': '20'}]}], **cambios)

    def test_mismo_color_se_guarda_por_producto_sin_equivalencia_con_cant(self):
        preparacion = self.crear_dos_productos(cajillas=[self.plan(self.producto.pk, 7), self.plan(self.banana.pk, 3)])
        self.assertEqual(list(preparacion.cajillas.order_by('producto_id').values_list('producto_nombre', 'cantidad')), [('Papaya', 7), ('Banana', 3)])
        self.assertEqual([fila['producto'] for fila in datos_documento(preparacion)['cajillas']], [self.producto.pk, self.banana.pk])
        respuesta = self.client.get(f'/api/v1/preparaciones/{preparacion.pk}/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['cajillas'][1]['producto_nombre'], 'Banana')

    def test_rechaza_duplicado_del_mismo_producto_color_y_destino(self):
        with self.assertRaises(ValidationError) as contexto:
            self.crear(cajillas=[self.plan(self.producto.pk), self.plan(self.producto.pk)])
        self.assertIn('cajillas_1_cajilla', contexto.exception.detail)

    def test_borrador_informa_saldos_actuales_sin_reservar_ni_restar_previsiones(self):
        preparacion = self.crear(cajillas=[self.plan(self.producto.pk, 7)])
        respuesta = self.client.get(f'/api/v1/preparaciones/{preparacion.pk}/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['lineas'][0]['saldo_lote'], '200.000')
        self.assertEqual(respuesta.data['cajillas'][0]['saldo_almacen'], 100)

    def test_rechaza_producto_que_no_se_prepara_en_esa_sucursal(self):
        with self.assertRaises(ValidationError) as contexto:
            self.crear(cajillas=[self.plan(self.banana.pk)])
        self.assertIn('cajillas_0_producto', contexto.exception.detail)

    def test_confirmar_no_mueve_cajillas_y_desglosa_prevision_para_despacho(self):
        antes = MovimientoCajilla.objects.count()
        preparacion = self.confirmar(self.crear_dos_productos(cajillas=[self.plan(self.producto.pk, 7), self.plan(self.banana.pk, 3)]))
        self.assertEqual(MovimientoCajilla.objects.count(), antes)
        respuesta = self.client.get('/api/v1/despachos/disponibles/', {'almacen': self.almacen.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        filas = respuesta.data['results']
        papaya = next(fila for fila in filas if fila['producto'] == self.producto.pk and fila['sucursal'] == self.centro.pk)
        banana = next(fila for fila in filas if fila['producto'] == self.banana.pk)
        self.assertEqual([fila['cantidad'] for fila in papaya['cajillas_previstas']], [7])
        self.assertEqual([fila['cantidad'] for fila in banana['cajillas_previstas']], [3])
        self.assertEqual(preparacion.estado, 'confirmada')

    def test_planes_anteriores_sin_producto_se_conservan_al_editar_y_confirmar(self):
        preparacion = self.crear(cajillas=[{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 5}])
        datos = datos_documento(preparacion)
        self.assertIsNone(datos['cajillas'][0]['producto'])
        datos['version'] = version_preparacion(preparacion)
        guardada, _ = guardar_preparacion(self.actor, datos, instancia=preparacion)
        self.confirmar(guardada)
        self.assertEqual(guardada.cajillas.get().cantidad, 5)

    def test_rechaza_cajillas_de_producto_sin_cantidad_al_confirmar(self):
        preparacion = self.crear(asignaciones=[{'detalle_pedido': self.centro_cajas.pk, 'cantidad': 0, 'aportes': []}, self.asignacion(self.norte_cajas, 3, '50')],
            cajillas=[self.plan(self.producto.pk)])
        with self.assertRaises(ValidationError) as contexto:
            self.confirmar(preparacion)
        self.assertIn('cajillas_0_producto', contexto.exception.detail)
