import uuid
from django.test import TestCase
from rest_framework.test import APIClient
from inventario.models import Lote, MovimientoInventario
from inventario.consultas import lotes_con_saldo
from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion
from .tests import DatosPreparaciones
from .models import Preparacion
from catalogos.models import UnidadMedida
from inventario.servicios import habilitar_unidad


class PruebasSeleccionLotes(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.lector)
        self.ruta = f'/api/v1/preparaciones/lotes/?cliente={self.cliente.pk}&fecha_pedidos={self.hoy}&almacen={self.almacen.pk}&producto={self.producto.pk}'

    def test_lote_compartido_muestra_solo_el_saldo_libre_del_documento(self):
        respuesta = self.client.post(self.ruta, {'consumos': [{'lote': self.lote.pk, 'cantidad': '199'}]}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['saldo'], '200.000')
        self.assertEqual(respuesta.data['results'][0]['disponible_preparacion'], '1.000')
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 403)

    def test_agotados_y_seleccionados_no_se_ofrecen_y_consultar_no_reserva(self):
        movimientos = MovimientoInventario.objects.count()
        for datos in ({'consumos': [{'lote': self.lote.pk, 'cantidad': '200'}]}, {'consumos': [{'lote': self.lote.pk, 'cantidad': '201'}]}, {'excluir': [self.lote.pk]}):
            with self.subTest(datos=datos):
                respuesta = self.client.post(self.ruta, datos, format='json')
                self.assertEqual(respuesta.status_code, 200, respuesta.data)
                self.assertEqual(respuesta.data['count'], 0)
        self.assertEqual(MovimientoInventario.objects.count(), movimientos)
        self.assertEqual(Preparacion.objects.count(), 0)
        self.assertEqual(lotes_con_saldo(self.almacen.pk).get(pk=self.lote.pk).saldo, 200)
        self.assertEqual(self.client.get(self.ruta).data['count'], 1)

    def test_la_disponibilidad_actual_del_servidor_prevalece_sobre_la_prevision(self):
        # La salida confirmada de otra preparación ya redujo el saldo real.
        self.confirmar(self.crear())
        respuesta = self.client.post(self.ruta, {'consumos': [{'lote': self.lote.pk, 'cantidad': '150'}]}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 0)
        respuesta = self.client.post(self.ruta, {'consumos': [{'lote': self.lote.pk, 'cantidad': '149.5'}]}, format='json')
        self.assertEqual(respuesta.data['results'][0]['disponible_preparacion'], '0.500')

    def test_excluye_antes_de_paginar_de_diez_sin_dejar_paginas_vacias(self):
        nuevos = []
        for _ in range(11):
            recepcion, _ = guardar_recepcion(self.actor, {'compra': None, 'almacen': self.almacen.pk, 'fecha_recepcion': str(self.hoy), 'clave_operacion': str(uuid.uuid4()),
                'detalles': [{'producto': self.producto.pk, 'unidad_inventario': self.kg.pk, 'cantidad_inventario': '1'}]})
            confirmar_recepcion(self.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
            nuevos.append(Lote.objects.order_by('-pk').first().pk)
        todos = self.client.get(self.ruta).data
        self.assertEqual(todos['count'], 12)
        self.assertEqual(len(todos['results']), 10)
        consumos = [{'lote': self.lote.pk, 'cantidad': '200'}] + [{'lote': identificador, 'cantidad': '1'} for identificador in nuevos[:-1]]
        respuesta = self.client.post(self.ruta, {'consumos': consumos}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['id'], nuevos[-1])

    def test_valida_estructura_cantidades_y_permisos_de_consulta(self):
        for datos in ({'consumos': [{'lote': self.lote.pk, 'cantidad': '-1'}]}, {'consumos': [{'lote': self.lote.pk, 'cantidad': '0.0001'}]},
                      {'consumos': [{'lote': self.lote.pk, 'cantidad': '1'}] * 2}, {'excluir': [self.lote.pk] * 21}, {'reservar': True}):
            with self.subTest(datos=datos):
                self.assertEqual(self.client.post(self.ruta, datos, format='json').status_code, 400)
        self.lector.user_permissions.clear()
        self.client.force_authenticate(type(self.lector).objects.get(pk=self.lector.pk))
        self.assertEqual(self.client.post(self.ruta, {}, format='json').status_code, 403)

    def test_completar_filtra_unidad_antes_de_paginar_y_conserva_consultas_sin_filtro(self):
        otra_unidad = UnidadMedida.objects.create(nombre='Unidad adicional', abreviatura='uni')
        habilitar_unidad(self.actor, self.producto.pk, {'unidad': otra_unidad.pk})
        for _ in range(11):
            recepcion, _ = guardar_recepcion(self.actor, {'compra': None, 'almacen': self.almacen.pk, 'fecha_recepcion': str(self.hoy), 'clave_operacion': str(uuid.uuid4()),
                'detalles': [{'producto': self.producto.pk, 'unidad_inventario': otra_unidad.pk, 'cantidad_inventario': '1', 'peso_kg': '1'}]})
            confirmar_recepcion(self.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        movimientos = MovimientoInventario.objects.count()
        consulta = self.ruta + f'&unidad={self.kg.pk}'
        respuesta = self.client.post(consulta, {'consumos': [{'lote': self.lote.pk, 'cantidad': '198'}]}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['id'], self.lote.pk)
        self.assertEqual(respuesta.data['results'][0]['disponible_preparacion'], '2.000')
        alternativas = self.client.get(self.ruta + f'&unidad={otra_unidad.pk}')
        self.assertEqual((alternativas.data['count'], len(alternativas.data['results'])), (11, 10))
        self.assertTrue(all(fila['unidad'] == otra_unidad.pk for fila in alternativas.data['results']))
        self.assertEqual(len(self.client.get(self.ruta + f'&unidad={otra_unidad.pk}&pagina=2').data['results']), 1)
        self.assertEqual(self.client.get(self.ruta).data['count'], 12)
        self.assertEqual(self.client.get(self.ruta + '&unidad=0').status_code, 400)
        self.assertEqual(MovimientoInventario.objects.count(), movimientos)
