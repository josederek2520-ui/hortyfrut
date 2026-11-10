from copy import deepcopy
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from .rutas_osrm import consultar_matriz_osrm, consultar_osrm, ErrorCalculoRuta, validar_resultado
from .colores_ruta import colorear_puntos, colorear_tramos, contraste_blanco


class PruebasMatrizYTramos(SimpleTestCase):
    def puntos(self):
        return [{'longitud': '-68.14', 'latitud': '-16.50'}, {'longitud': '-68.12', 'latitud': '-16.49'}]

    def datos_matriz(self):
        acceso = {'location': [-68.14, -16.5], 'distance': 1}
        return {'code': 'Ok', 'durations': [[0, 40.5], [30.2, 0]],
                'sources': [acceso, acceso], 'destinations': [acceso, acceso], 'data_version': 'matriz-1'}

    def test_matriz_dirigida_completa_sin_estimaciones_inventadas(self):
        with patch('despachos.rutas_osrm.solicitar_datos_osrm', return_value=self.datos_matriz()) as consultar:
            resultado = consultar_matriz_osrm(self.puntos())
        self.assertEqual(resultado['duraciones_s'], [['0.00', '40.50'], ['30.20', '0.00']])
        self.assertEqual(consultar.call_args.args[1], 'table')
        self.assertEqual(consultar.call_args.args[2], {'annotations': 'duration'})

    def test_matriz_incompleta_desconectada_o_no_finita_se_rechaza(self):
        for matriz in ([[0, None], [1, 0]], [[0]], [[0, True], [1, 0]], [[0, -1], [1, 0]], [[0, float('nan')], [1, 0]]):
            datos = {**self.datos_matriz(), 'durations': matriz}
            with self.subTest(matriz=matriz), patch('despachos.rutas_osrm.solicitar_datos_osrm', return_value=datos):
                with self.assertRaises((ErrorCalculoRuta, ValidationError)):
                    consultar_matriz_osrm(self.puntos())

    def test_los_accesos_tambien_se_validan_en_la_matriz(self):
        datos = deepcopy(self.datos_matriz())
        datos['sources'][0]['distance'] = 99999
        with patch('despachos.rutas_osrm.solicitar_datos_osrm', return_value=datos):
            with self.assertRaises(ValidationError):
                consultar_matriz_osrm(self.puntos())

    def test_tramos_con_calle_repetida_conservan_geometria_exacta_por_pasos(self):
        primero, segundo, tercero = [-68.14, -16.5], [-68.12, -16.49], [-68.13, -16.48]
        pasos = lambda posiciones: [{'geometry': {'type': 'LineString', 'coordinates': posiciones}}]
        datos = {'code': 'Ok', 'waypoints': [{'location': primero, 'distance': 0}] * 3,
            'routes': [{'distance': 30, 'duration': 20,
                'geometry': {'type': 'LineString', 'coordinates': [primero, segundo, primero, tercero]},
                'legs': [{'distance': 10, 'duration': 8, 'steps': pasos([primero, segundo])},
                         {'distance': 20, 'duration': 12, 'steps': pasos([segundo, primero, tercero])}]}]}
        resultado = validar_resultado(datos, 3)
        self.assertEqual(resultado['tramos'][0]['geometria']['coordinates'], [primero, segundo])
        self.assertEqual(resultado['tramos'][1]['geometria']['coordinates'], [segundo, primero, tercero])
        self.assertEqual(resultado['geometria']['coordinates'], [primero, segundo, primero, tercero])

    def test_colores_permanecen_por_sucursal_y_los_tramos_usen_el_color_de_llegada(self):
        puntos = [{'tipo': 'almacen', 'sucursal': None, 'parada': None},
                  *[{'tipo': 'sucursal', 'sucursal': indice, 'parada': indice + 900} for indice in range(80)],
                  {'tipo': 'retorno', 'sucursal': None, 'parada': None}]
        colores = colorear_puntos(puntos)
        orden_inverso = colorear_puntos([puntos[0], *reversed(puntos[1:-1]), puntos[-1]])
        self.assertEqual({fila['sucursal']: fila['color'] for fila in colores},
                         {fila['sucursal']: fila['color'] for fila in orden_inverso})
        self.assertEqual(len({fila['color'] for fila in colores[1:-1]}), 80)
        for fila in colores:
            componentes = [int(fila['color'][indice:indice + 2], 16) / 255 for indice in (1, 3, 5)]
            self.assertGreaterEqual(contraste_blanco(componentes), 4.5)
        tramos = colorear_tramos([{'orden': indice} for indice in range(1, 82)], colores)
        self.assertEqual([tramo['color'] for tramo in tramos], [punto['color'] for punto in colores[1:]])
        self.assertEqual(tramos[-1]['color'], colores[0]['color'])
