import uuid
from decimal import Decimal

from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import MovimientoInventario
from .capacidad import comprobar_capacidad
from .models import OperacionDespacho
from .servicios import ejecutar_accion, version_despacho
from .tests import DatosDespachos


def carga_medida(*pesos):
    return {'peso_kg': str(sum((Decimal(peso) for peso in pesos), Decimal('0'))),
            'aportes': [{'peso_kg': peso} for peso in pesos]}


class PruebasComparacionCapacidad(SimpleTestCase):
    def test_dos_toneladas_y_1500_kg_sin_equivalencias_de_cajas(self):
        carga = {**carga_medida('1000', '500'), 'columna': 'cajas', 'cantidad': 999}
        resultado = comprobar_capacidad('2000.000', [carga])
        self.assertEqual(resultado, {'estado': 'apta', 'capacidad_kg': '2000.000',
                                     'peso_kg': '1500', 'margen_kg': '500.000'})

    def test_comparacion_decimal_exacta_y_limite_inclusivo(self):
        self.assertEqual(comprobar_capacidad('0.300', [carga_medida('0.1', '0.2')])['estado'], 'apta')
        resultado = comprobar_capacidad('0.300', [carga_medida('0.301')])
        self.assertEqual((resultado['estado'], resultado['margen_kg']), ('excedida', '-0.001'))

    def test_suma_todas_las_asignaciones_sin_limitar_a_una_pagina(self):
        self.assertEqual(comprobar_capacidad('10', [carga_medida('1')] * 11)['estado'], 'excedida')

    def test_capacidad_ausente_invalida_o_cero_no_es_capacidad_verificada(self):
        for capacidad in (None, '', '0', '-1', 'NaN', 'Infinity', True):
            with self.subTest(capacidad=capacidad):
                self.assertEqual(comprobar_capacidad(capacidad, [carga_medida('5')])['estado'], 'sin_capacidad')

    def test_faltantes_o_pesos_inconsistentes_no_se_convierten_en_cero(self):
        for carga in ({'peso_kg': '10', 'aportes': []},
                      {'peso_kg': '10', 'aportes': [{'peso_kg': None}]},
                      {'peso_kg': '0', 'aportes': [{'peso_kg': '0'}]},
                      {'peso_kg': 'NaN', 'aportes': [{'peso_kg': 'NaN'}]},
                      {'peso_kg': '10', 'aportes': [{'peso_kg': '5'}]}):
            with self.subTest(carga=carga):
                resultado = comprobar_capacidad('2000', [carga_medida('1'), carga])
                self.assertEqual(resultado['estado'], 'peso_incompleto')
                self.assertIsNone(resultado['peso_kg'])

    def test_sin_carga_no_presenta_un_peso_medido(self):
        self.assertEqual(comprobar_capacidad('2000', [])['estado'], 'sin_carga')


class PruebasCapacidadViaje(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()

    def cambiar_capacidad(self, capacidad):
        self.vehiculo.capacidad_kg = capacidad
        self.vehiculo.save(update_fields=['capacidad_kg'])

    def test_borrador_sin_capacidad_se_guarda_y_salida_se_bloquea_sin_movimientos(self):
        self.cambiar_capacidad(None)
        despacho = self.crear_despacho()
        anteriores = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), RegistroActividad.objects.count())
        with self.assertRaises(ValidationError) as error:
            self.operar(despacho, 'iniciar')
        self.assertEqual(error.exception.detail['capacidad'].code, 'sin_capacidad')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'borrador')
        self.assertIsNone(despacho.salida_en)
        self.assertFalse(OperacionDespacho.objects.filter(despacho=despacho).exists())
        self.assertEqual(anteriores, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), RegistroActividad.objects.count()))

    def test_capacidad_se_revalida_con_el_valor_actual_antes_de_salir(self):
        despacho = self.crear_despacho()
        self.cambiar_capacidad('49.999')
        respuesta = self.client.post(f'/api/v1/despachos/{despacho.pk}/iniciar/', {
            'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}, format='json')
        self.assertEqual(respuesta.status_code, 400, respuesta.data)
        self.assertIn('capacidad', respuesta.data['errors'])
        self.assertFalse(MovimientoCajilla.objects.filter(despacho=despacho).exists())
        self.cambiar_capacidad('50.000')
        productos = MovimientoInventario.objects.count()
        self.operar(despacho, 'iniciar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'en_ruta')
        self.assertEqual(MovimientoInventario.objects.count(), productos)

    def test_detalle_expone_capacidad_actual_y_estado_sin_exigir_permiso_vehiculos(self):
        from django.contrib.auth.models import Permission
        despacho = self.crear_despacho()
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
        self.client.force_authenticate(self.lector)
        respuesta = self.client.get(f'/api/v1/despachos/{despacho.pk}/')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['vehiculo_capacidad_kg'], '1000.000')
        self.assertEqual(respuesta.data['comprobacion_capacidad']['estado'], 'apta')
        self.cambiar_capacidad(None)
        respuesta = self.client.get(f'/api/v1/despachos/{despacho.pk}/')
        self.assertEqual(respuesta.data['comprobacion_capacidad']['estado'], 'sin_capacidad')
        self.assertEqual(self.client.get('/api/v1/vehiculos/').status_code, 403)

    def test_reintento_de_salida_ya_aplicada_no_revalida_ni_duplica(self):
        despacho = self.crear_despacho()
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}
        ejecutar_accion(self.actor, despacho, 'iniciar', datos)
        self.cambiar_capacidad(None)
        ejecutar_accion(self.actor, despacho, 'iniciar', datos)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='carga').count(), 1)
        self.assertEqual(OperacionDespacho.objects.filter(despacho=despacho, accion='iniciar').count(), 1)

    def test_coordenadas_pendientes_no_bloquean_la_salida_manual(self):
        self.assertIsNone(self.almacen.latitud)
        self.assertIsNone(self.centro.latitud)
        despacho = self.crear_despacho()
        self.operar(despacho, 'iniciar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'en_ruta')
