"""La carga recupera las previsiones sin duplicarlas ni repetir inventario."""
import uuid
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import Lote, MovimientoInventario
from productos.models import Producto, PresentacionProducto
from preparaciones.models import AsignacionPreparacion, AportePreparacion, CajillaPrevista
from preparaciones.servicios import guardar_preparacion, confirmar_preparacion
from preparaciones.consultas import version_preparacion
from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion
from vehiculos.servicios import guardar_vehiculo

from .tests import DatosDespachos
from .models import Despacho, OperacionDespacho
from .carga_destinos import carga_disponible, version_carga_disponible
from .servicios import guardar_despacho, version_despacho, ejecutar_accion, ConflictoDespacho


class PruebasCajillasAutomaticas(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()
        cls.vehiculo = guardar_vehiculo(cls.actor, {'placa': 'CR-123', 'tipo': 'Camion', 'capacidad_kg': '1000'})
        cls.banana = Producto.objects.create(nombre='Banana', categoria=cls.categoria, unidad_medida=cls.kg)
        presentacion = PresentacionProducto.objects.create(producto=cls.banana, nombre='Caja', uso='ambos', columna_pedido='cajas')
        detalle = cls.crear_detalle(cls.pedido_centro, presentacion, 2, producto=cls.banana)
        recepcion, _ = guardar_recepcion(cls.actor, {'compra': None, 'almacen': cls.almacen.pk, 'fecha_recepcion': str(cls.hoy),
            'clave_operacion': str(uuid.uuid4()), 'detalles': [{'producto': cls.banana.pk, 'unidad_inventario': cls.kg.pk, 'cantidad_inventario': '20'}]})
        confirmar_recepcion(cls.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        lote_banana = Lote.objects.get(producto=cls.banana)
        cls.preparacion, _ = guardar_preparacion(cls.actor, {
            'cliente': cls.cliente.pk, 'fecha_pedidos': str(cls.hoy), 'almacen': cls.almacen.pk, 'clave_operacion': str(uuid.uuid4()),
            'lineas': [{'lote': cls.lote.pk, 'cantidad_utilizada': '50'}, {'lote': lote_banana.pk, 'cantidad_utilizada': '20'}],
            'asignaciones': [
                {'detalle_pedido': cls.centro_cajas.pk, 'cantidad': 2, 'aportes': [{'lote': cls.lote.pk, 'cantidad': '20'}]},
                {'detalle_pedido': cls.norte_cajas.pk, 'cantidad': 3, 'aportes': [{'lote': cls.lote.pk, 'cantidad': '30'}]},
                {'detalle_pedido': detalle.pk, 'cantidad': 2, 'aportes': [{'lote': lote_banana.pk, 'cantidad': '20'}]}],
            'cajillas': [
                {'producto': cls.producto.pk, 'sucursal': cls.centro.pk, 'cajilla': cls.cajilla.pk, 'cantidad': 7},
                {'producto': cls.banana.pk, 'sucursal': cls.centro.pk, 'cajilla': cls.cajilla.pk, 'cantidad': 3},
                {'producto': cls.producto.pk, 'sucursal': cls.norte.pk, 'cajilla': cls.cajilla.pk, 'cantidad': 5},
                {'sucursal': cls.centro.pk, 'cajilla': cls.cajilla.pk, 'cantidad': 1}]})
        confirmar_preparacion(cls.actor, cls.preparacion, {'version': version_preparacion(cls.preparacion), 'clave_operacion': str(uuid.uuid4())})
        cls.asignaciones = list(cls.preparacion.asignaciones.order_by('pk'))

    def previstas(self, centro=11, norte=5):
        return [{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': centro},
                {'sucursal': self.norte.pk, 'cajilla': self.cajilla.pk, 'cantidad': norte}]

    def legado(self):
        despacho = self.crear_despacho(cajillas=[])
        Despacho.objects.filter(pk=despacho.pk).update(cajillas_automaticas=None)
        despacho.refresh_from_db()
        return despacho

    def cantidades(self, despacho):
        return {fila.parada.sucursal_id: fila.cantidad for fila in despacho.cajillas.select_related('parada')}

    def test_reabrir_legado_recupera_previsiones_sin_escritura_ni_movimientos(self):
        despacho = self.legado()
        antes = (MovimientoCajilla.objects.count(), MovimientoInventario.objects.count(), RegistroActividad.objects.filter(origen='sistema').count(), despacho.actualizado_en)
        for _ in range(2):
            respuesta = self.client.get(f'/api/v1/despachos/{despacho.pk}/')
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            self.assertEqual([fila['cantidad'] for fila in respuesta.data['cajillas_sugeridas']], [11, 5])
            self.assertEqual(respuesta.data['cajillas'], [])
            for fila in respuesta.data['cargas']:
                self.assertTrue(fila['cajillas_previstas'])
                self.assertTrue(all(plan['producto_id'] in (None, fila['producto']) for plan in fila['cajillas_previstas']))
        despacho.refresh_from_db()
        self.assertEqual(antes, (MovimientoCajilla.objects.count(), MovimientoInventario.objects.count(), RegistroActividad.objects.filter(origen='sistema').count(), despacho.actualizado_en))
        self.assertIsNone(despacho.cajillas_automaticas)
        self.assertFalse(despacho.cajillas.exists())

    def test_guardar_automatico_reabrir_y_reintentar_uuid_conservan_matriz(self):
        datos = self.datos_despacho(cajillas_automaticas=True, cajillas=self.previstas())
        despacho, creado = guardar_despacho(self.actor, datos)
        repetido, nuevo = guardar_despacho(self.actor, datos)
        self.assertTrue(creado)
        self.assertFalse(nuevo)
        self.assertEqual(despacho.pk, repetido.pk)
        self.assertEqual(self.cantidades(despacho), {self.centro.pk: 11, self.norte.pk: 5})
        self.assertTrue(self.client.get(f'/api/v1/despachos/{despacho.pk}/').data['cajillas_automaticas'])

    def test_seleccionar_solo_un_producto_no_copia_los_demas_y_conserva_legado(self):
        asignacion = next(fila for fila in self.asignaciones if fila.sucursal_id == self.centro.pk and fila.producto_id == self.producto.pk)
        despacho = self.crear_despacho(asignaciones=[asignacion.pk], orden_sucursales=[self.centro.pk], cajillas_automaticas=True,
            cajillas=[{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 8}])
        self.assertEqual(self.cantidades(despacho), {self.centro.pk: 8})

    def test_muchos_pedidos_y_paginas_no_multiplican_prevision_compartida(self):
        for _ in range(11):
            pedido = self.crear_pedido(self.centro)
            detalle = self.crear_detalle(pedido, self.unidades, 1)
            fila = AsignacionPreparacion.objects.create(preparacion=self.preparacion, pedido=pedido, detalle_pedido=detalle,
                sucursal=self.centro, sucursal_nombre=self.centro.nombre, producto=self.producto, producto_nombre=self.producto.nombre,
                presentacion_nombre='Unidad', columna='unidades', cantidad_solicitada=1, cantidad=1)
            AportePreparacion.objects.create(asignacion=fila, linea=self.preparacion.lineas.get(producto=self.producto), cantidad='1', peso_kg='1')
        respuesta = self.client.get('/api/v1/despachos/disponibles/', {'almacen': self.almacen.pk, 'sucursal': self.centro.pk})
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(respuesta.data['count'], 13)
        despacho = self.crear_despacho(asignaciones=list(self.preparacion.asignaciones.values_list('pk', flat=True)),
            cajillas_automaticas=True, cajillas=self.previstas())
        self.assertEqual(self.cantidades(despacho), {self.centro.pk: 11, self.norte.pk: 5})

    def test_edicion_manual_incluso_vacia_se_conserva_al_reabrir_y_enviar(self):
        for cantidades in (self.previstas(4, 6), []):
            with self.subTest(cantidades=cantidades):
                despacho = self.crear_despacho(cajillas_automaticas=False, cajillas=cantidades)
                respuesta = self.client.get(f'/api/v1/despachos/{despacho.pk}/')
                self.assertFalse(respuesta.data['cajillas_automaticas'])
                self.operar(despacho, 'enviar')
                self.assertEqual(self.cantidades(despacho), {fila['sucursal']: fila['cantidad'] for fila in cantidades})
                self.operar(despacho, 'cancelar')

    def test_cliente_anterior_sin_bandera_conserva_guardado_y_uuid(self):
        datos = self.datos_despacho()
        despacho, _ = guardar_despacho(self.actor, datos)
        self.assertFalse(despacho.cajillas_automaticas)
        repetido, nuevo = guardar_despacho(self.actor, datos)
        self.assertEqual(despacho.pk, repetido.pk)
        self.assertFalse(nuevo)
        self.operar(despacho, 'enviar')
        self.assertEqual(self.cantidades(despacho), {self.centro.pk: 2, self.norte.pk: 3})

    def test_legado_con_cajillas_guardadas_conserva_sus_cantidades_manuales(self):
        despacho = self.crear_despacho(cajillas=self.previstas(4, 6))
        Despacho.objects.filter(pk=despacho.pk).update(cajillas_automaticas=None)
        respuesta = self.client.get(f'/api/v1/despachos/{despacho.pk}/')
        self.assertIsNone(respuesta.data['cajillas_automaticas'])
        self.assertEqual([fila['cantidad'] for fila in respuesta.data['cajillas']], [4, 6])
        self.operar(despacho, 'enviar')
        self.assertEqual(self.cantidades(despacho), {self.centro.pk: 4, self.norte.pk: 6})

    def test_matriz_desactualizada_se_rechaza_sin_crear_despacho(self):
        with self.assertRaises(ConflictoDespacho):
            self.crear_despacho(cajillas_automaticas=True, cajillas=self.previstas(10, 5))
        self.assertFalse(Despacho.objects.exists())

    def test_enviar_legado_materializa_una_vez_sin_mover_productos_o_cajillas(self):
        despacho = self.legado()
        antes = (MovimientoCajilla.objects.count(), MovimientoInventario.objects.count())
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}
        for _ in range(2):
            ejecutar_accion(self.actor, despacho, 'enviar', datos)
        despacho.refresh_from_db()
        self.assertTrue(despacho.cajillas_automaticas)
        self.assertEqual(self.cantidades(despacho), {self.centro.pk: 11, self.norte.pk: 5})
        self.assertEqual(antes, (MovimientoCajilla.objects.count(), MovimientoInventario.objects.count()))
        self.assertEqual(OperacionDespacho.objects.filter(accion='enviar').count(), 1)
        self.assertTrue(RegistroActividad.objects.filter(modulo='despachos', accion='enviar').exists())

    def test_iniciar_y_descargar_entregan_una_vez_sin_repetir_productos(self):
        despacho = self.legado()
        productos = MovimientoInventario.objects.count()
        self.operar(despacho, 'iniciar')
        self.assertEqual(MovimientoCajilla.objects.get(despacho=despacho, tipo='carga').cantidad, 16)
        parada = despacho.paradas.get(sucursal=self.centro)
        self.operar(despacho, 'llegar', parada=parada.pk)
        self.operar(despacho, 'descargar', parada=parada.pk)
        self.assertEqual(MovimientoCajilla.objects.get(despacho=despacho, tipo='entrega').cantidad, 11)
        self.assertEqual(MovimientoInventario.objects.count(), productos)

    def test_viajes_enviados_o_historicos_no_importan_previsiones(self):
        for estado, enviado in [('borrador', timezone.now()), ('en_ruta', None), ('finalizado', None), ('cancelado', None)]:
            with self.subTest(estado=estado):
                despacho = self.legado()
                Despacho.objects.filter(pk=despacho.pk).update(estado=estado, enviado_en=enviado,
                    salida_en=timezone.now() if estado in ('en_ruta', 'finalizado') else None,
                    retorno_en=timezone.now() if estado == 'finalizado' else None)
                despacho.refresh_from_db()
                respuesta = self.client.get(f'/api/v1/despachos/{despacho.pk}/')
                self.assertEqual(respuesta.data['cajillas_sugeridas'], [])
                self.assertTrue(all(not fila['cajillas_previstas'] for fila in respuesta.data['cargas']))
                despacho.cargas.update(activa=False)

    def test_fallo_auditoria_revierte_materializacion_y_envio(self):
        despacho = self.legado()
        with patch('despachos.servicios.registrar_actividad', side_effect=RuntimeError('Auditoria no disponible')):
            with self.assertRaises(RuntimeError):
                self.operar(despacho, 'enviar')
        despacho.refresh_from_db()
        self.assertIsNone(despacho.enviado_en)
        self.assertIsNone(despacho.cajillas_automaticas)
        self.assertFalse(despacho.cajillas.exists())
        self.assertFalse(OperacionDespacho.objects.exists())

    def test_version_disponibilidad_incluye_cajillas_y_rechaza_suma_desbordada(self):
        consulta = carga_disponible({'almacen': self.almacen.pk, 'sucursal': self.centro.pk})
        anterior = version_carga_disponible(consulta)
        CajillaPrevista.objects.filter(preparacion=self.preparacion, sucursal=self.centro, producto=self.producto).update(cantidad=2147483647)
        self.assertNotEqual(anterior, version_carga_disponible(consulta))
        with self.assertRaises(ValidationError):
            self.crear_despacho(cajillas_automaticas=True, cajillas=self.previstas())
        self.assertFalse(Despacho.objects.exists())
