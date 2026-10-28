import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from decimal import Decimal
from datetime import timedelta
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework.exceptions import APIException, ValidationError
from usuarios.models import Usuario
from clientes.models import Cliente, Sucursal
from productos.models import Producto, PresentacionProducto
from pedidos.models import Pedido
from pedidos.servicios import cancelar_pedido, obtener_version
from catalogos.models import UnidadMedida
from inventario.models import Lote, MovimientoInventario
from inventario.consultas import lotes_con_saldo
from inventario.servicios import habilitar_unidad
from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion
from cajillas.servicios import registrar_movimiento as mover_cajillas
from cajillas.consultas import version_cajilla, pendiente_sucursal
from .tests import DatosPreparaciones
from .models import Preparacion
from .servicios import guardar_preparacion, confirmar_preparacion
from .consultas import avance_detalles


class PruebasIntegridadPreparacion(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def otra_recepcion(self, unidad=None):
        recepcion = guardar_recepcion(self.actor, {'compra': None, 'almacen': self.almacen.pk, 'fecha_recepcion': str(self.hoy), 'clave_operacion': str(uuid.uuid4()),
            'detalles': [{'producto': self.producto.pk, 'unidad_inventario': (unidad or self.kg).pk, 'cantidad_inventario': '20'}]})[0]
        confirmar_recepcion(self.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        return recepcion.detalles.get().lote

    def test_una_caja_puede_tener_aportes_de_dos_lotes_sin_duplicar_cant(self):
        otro = self.otra_recepcion()
        preparacion = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '6'}, {'lote': otro.pk, 'cantidad_utilizada': '4'}],
            asignaciones=[{'detalle_pedido': self.centro_cajas.pk, 'cantidad': 1, 'aportes': [{'lote': self.lote.pk, 'cantidad': '6'}, {'lote': otro.pk, 'cantidad': '4'}]}])
        self.confirmar(preparacion)
        self.assertEqual(avance_detalles([self.centro_cajas.pk])[self.centro_cajas.pk], 1)
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('194'))
        self.assertEqual(lotes_con_saldo().get(pk=otro.pk).saldo, Decimal('16'))

    def test_unidad_distinta_de_kg_exige_peso_medido_no_equivalencia(self):
        unidad = UnidadMedida.objects.create(nombre='Pieza', abreviatura='pz')
        habilitar_unidad(self.actor, self.producto.pk, {'unidad': unidad.pk})
        lote = self.otra_recepcion(unidad)
        datos = self.datos(lineas=[{'lote': lote.pk, 'cantidad_utilizada': '1'}],
            asignaciones=[{'detalle_pedido': self.centro_uni.pk, 'cantidad': 1, 'aportes': [{'lote': lote.pk, 'cantidad': '1'}]}])
        preparacion = guardar_preparacion(self.actor, datos)[0]
        with self.assertRaises(ValidationError):
            self.confirmar(preparacion)
        datos['asignaciones'][0]['aportes'][0]['peso_kg'] = '0.8'
        datos.pop('clave_operacion')
        datos['version'] = self.accion(preparacion)['version']
        preparacion = guardar_preparacion(self.actor, datos, preparacion)[0]
        self.confirmar(preparacion)
        aporte = preparacion.asignaciones.get().aportes.get()
        self.assertEqual(aporte.cantidad, Decimal('1'))
        self.assertEqual(aporte.peso_kg, Decimal('0.8'))

    def test_cajillas_previstas_confirmadas_no_crean_salida_de_cajillas(self):
        preparacion = self.confirmar(self.crear(cajillas=[{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 2}]))
        self.assertEqual(preparacion.cajillas.get().cantidad, 2)
        self.assertEqual(pendiente_sucursal(self.cajilla.pk, self.centro.pk), 0)

    def test_duplicar_detalle_para_sobrepreparar_se_rechaza(self):
        with self.assertRaises(ValidationError):
            self.crear(asignaciones=[self.asignacion(self.centro_cajas, 1, '10'), self.asignacion(self.centro_cajas, 1, '10')])

    def test_lote_que_vence_antes_de_fecha_del_pedido_se_rechaza(self):
        self.pedido_centro.fecha_requerida = self.hoy + timedelta(days=1)
        self.pedido_centro.save()
        self.lote.fecha_vencimiento = self.hoy
        self.lote.save()
        preparacion = self.crear(fecha_pedidos=str(self.hoy + timedelta(days=1)), lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '20'}],
            asignaciones=[self.asignacion(self.centro_cajas, 2, '20')])
        with self.assertRaises(ValidationError):
            self.confirmar(preparacion)

    def test_detalle_retirado_de_pedido_no_rompe_borrador_y_no_se_confirma(self):
        preparacion = self.crear()
        self.centro_cajas.delete()
        self.assertIsNone(preparacion.asignaciones.get(sucursal=self.centro).detalle_pedido_id)
        with self.assertRaises(ValidationError):
            self.confirmar(preparacion)

    def test_creacion_idempotente_y_edicion_con_version(self):
        datos = self.datos()
        primera, _ = guardar_preparacion(self.actor, datos)
        segunda, creada = guardar_preparacion(self.actor, datos)
        self.assertEqual(primera.pk, segunda.pk)
        self.assertFalse(creada)
        self.assertEqual(Preparacion.objects.count(), 1)

    def test_matriz_pagina_ambos_ejes_y_total_incluye_sucursales_ocultas(self):
        from rest_framework.test import APIClient
        cliente = APIClient()
        cliente.force_authenticate(self.actor)
        for indice in range(11):
            sucursal = Sucursal.objects.create(cliente=self.cliente, nombre=f'Sucursal {indice}', direccion='Calle')
            pedido = self.crear_pedido(sucursal)
            self.crear_detalle(pedido, self.cajas, 1)
            producto = Producto.objects.create(nombre=f'Producto {indice}', categoria=self.categoria, unidad_medida=self.kg)
            presentacion = PresentacionProducto.objects.create(producto=producto, nombre='Caja', uso='pedido', columna_pedido='cajas')
            self.crear_detalle(pedido, presentacion, 1, producto)
        filtros = {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy)}
        hoja = cliente.get('/api/v1/preparaciones/consolidado/', filtros)
        self.assertEqual(hoja.status_code, 200, hoja.data)
        self.assertEqual(len(hoja.data['results']), 10)
        self.assertEqual(len(hoja.data['sucursales']['results']), 10)
        self.assertEqual(hoja.data['sucursales']['count'], 13)
        self.assertEqual(next(fila for fila in hoja.data['results'] if fila['id'] == self.producto.pk)['cajas'], 16)
        otra = cliente.get('/api/v1/preparaciones/consolidado/', {**filtros, 'pagina': 2, 'pagina_sucursales': 2, 'version_hoja': hoja.data['version_hoja']})
        self.assertEqual(len(otra.data['results']), 2)
        self.assertEqual(len(otra.data['sucursales']['results']), 3)


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaPreparacion(DatosPreparaciones, TransactionTestCase):
    def setUp(self):
        self.preparar_datos()

    def ejecutar(self, trabajo):
        barrera = Barrier(2)
        def proceso(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    trabajo(actor, indice)
                    return 'aceptado'
                except APIException:
                    return 'rechazado'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            return list(ejecutor.map(proceso, [0, 1]))

    def test_dos_preparaciones_no_completan_dos_veces_los_pedidos(self):
        preparaciones = [self.crear(), self.crear()]
        def confirmar(actor, indice):
            preparacion = Preparacion.objects.get(pk=preparaciones[indice].pk)
            confirmar_preparacion(actor, preparacion, self.accion(preparacion))
        self.assertCountEqual(self.ejecutar(confirmar), ['aceptado', 'rechazado'])
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('150'))

    def test_reintentos_de_confirmacion_no_duplican_movimiento(self):
        preparacion = self.crear()
        datos = self.accion(preparacion)
        def confirmar(actor, indice):
            confirmar_preparacion(actor, Preparacion.objects.get(pk=preparacion.pk), datos)
        self.assertEqual(self.ejecutar(confirmar), ['aceptado', 'aceptado'])
        self.assertEqual(MovimientoInventario.objects.filter(tipo='salida_preparacion').count(), 1)

    def test_confirmacion_y_cancelacion_pedido_no_dejan_salida_invalida(self):
        preparacion = self.crear()
        def trabajo(actor, indice):
            if indice == 0:
                confirmar_preparacion(actor, Preparacion.objects.get(pk=preparacion.pk), self.accion(preparacion))
            else:
                pedido = Pedido.objects.get(pk=self.pedido_centro.pk)
                cancelar_pedido(actor, pedido, {'version': obtener_version(pedido), 'motivo': 'Revisión'})
        self.assertCountEqual(self.ejecutar(trabajo), ['aceptado', 'rechazado'])
        self.pedido_centro.refresh_from_db()
        preparacion.refresh_from_db()
        self.assertFalse(self.pedido_centro.estado == 'cancelado' and preparacion.estado == 'confirmada')

    def test_cajillas_y_preparacion_comparten_orden_de_bloqueo(self):
        preparacion = self.crear()
        clave = uuid.uuid4()
        version = version_cajilla(self.cajilla)
        def trabajo(actor, indice):
            if indice == 0:
                confirmar_preparacion(actor, Preparacion.objects.get(pk=preparacion.pk), self.accion(preparacion))
            else:
                mover_cajillas(actor, self.cajilla.pk, {'tipo': 'salida', 'cantidad': 10, 'almacen': self.almacen.pk, 'sucursal': self.centro.pk, 'clave_operacion': str(clave), 'version': version})
        self.assertEqual(self.ejecutar(trabajo), ['aceptado', 'aceptado'])
        self.assertEqual(pendiente_sucursal(self.cajilla.pk, self.centro.pk), 10)

    def test_clientes_distintos_comparten_saldo_fisico_del_lote(self):
        cliente = Cliente.objects.create(razon_social='Otro cliente', nit='94009')
        sucursal = Sucursal.objects.create(cliente=cliente, nombre='Otra', direccion='Avenida')
        detalle = self.crear_detalle(self.crear_pedido(sucursal), self.cajas, 1)
        primera = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '120'}], asignaciones=[self.asignacion(self.centro_cajas, 1, '120')])
        segunda = self.crear(cliente=cliente.pk, lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '120'}], asignaciones=[self.asignacion(detalle, 1, '120')])
        def confirmar(actor, indice):
            preparacion = Preparacion.objects.get(pk=[primera.pk, segunda.pk][indice])
            confirmar_preparacion(actor, preparacion, self.accion(preparacion))
        self.assertCountEqual(self.ejecutar(confirmar), ['aceptado', 'rechazado'])
        self.assertEqual(lotes_con_saldo().get(pk=self.lote.pk).saldo, Decimal('80'))
