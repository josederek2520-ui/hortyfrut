import itertools
import random
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from unittest import TestCase

from .optimizacion.genetico import (ParametrosGenetico, costo_recorrido, cruzar_ordenado,
    intercambiar, optimizar_recorrido, validar_matriz)


MATRIZ_PEQUENA = [[0, 12, 25, 18], [15, 0, 10, 22], [20, 14, 0, 9], [16, 19, 11, 0]]


class PruebasGenetico(TestCase):
    def test_costo_cerrado_y_asimetria_coinciden_con_suma_independiente(self):
        matriz = validar_matriz(MATRIZ_PEQUENA)
        self.assertEqual(costo_recorrido(matriz, [1, 2, 3]), 47)
        self.assertEqual(costo_recorrido(matriz, [3, 2, 1]), 58)
        self.assertNotEqual(matriz[1][0], matriz[0][1])

    def test_matriz_con_optimo_exhaustivo_y_elitismo_real(self):
        matriz = validar_matriz(MATRIZ_PEQUENA)
        optimo = min(costo_recorrido(matriz, orden) for orden in itertools.permutations(range(1, 4)))
        self.assertEqual(optimo, 47)
        for semilla in range(10):
            resultado = optimizar_recorrido(MATRIZ_PEQUENA, semilla=semilla, orden_inicial=[3, 2, 1])
            self.assertEqual(Decimal(resultado['costo_s']), optimo)
            mejoras = [Decimal(fila['mejor_s']) for fila in resultado['historial']]
            self.assertEqual(mejoras, sorted(mejoras, reverse=True))

    def test_cruce_y_mutacion_conservan_permutaciones_arbitrarias(self):
        azar = random.Random(123)
        for cantidad in range(2, 36):
            esperado = {indice * 7 for indice in range(cantidad)}
            for _ in range(20):
                primero, segundo = [azar.sample(sorted(esperado), cantidad) for _ in range(2)]
                cruzar_ordenado(primero, segundo, azar)
                intercambiar(primero, azar)
                self.assertEqual(set(primero), esperado)
                self.assertEqual(set(segundo), esperado)
                self.assertEqual(len(primero), cantidad)

    def test_misma_semilla_es_reproducible_aislada_y_concurrente(self):
        estado_aleatorio = random.getstate()
        esperado = optimizar_recorrido(MATRIZ_PEQUENA, semilla=45)
        with ThreadPoolExecutor(max_workers=3) as ejecutor:
            resultados = list(ejecutor.map(lambda _: optimizar_recorrido(MATRIZ_PEQUENA, semilla=45), range(6)))
        self.assertTrue(all(resultado == esperado for resultado in resultados))
        self.assertEqual(random.getstate(), estado_aleatorio)

    def test_todas_las_sucursales_incluidas_mas_alla_de_diez_y_sin_empeorar_orden_inicial(self):
        azar = random.Random(987)
        matriz = [[0 if origen == destino else azar.randrange(1, 900) for destino in range(26)] for origen in range(26)]
        resultado = optimizar_recorrido(matriz, parametros=ParametrosGenetico(poblacion=30, generaciones=25))
        self.assertEqual(sorted(resultado['orden']), list(range(1, 26)))
        self.assertLessEqual(Decimal(resultado['costo_s']), Decimal(resultado['costo_inicial_s']))
        self.assertEqual(Decimal(resultado['costo_s']), costo_recorrido(validar_matriz(matriz), resultado['orden']))

    def test_sin_sucursales_una_sucursal_y_pesos_decimales(self):
        vacio = optimizar_recorrido([[0]])
        self.assertEqual(vacio['orden'], [])
        self.assertEqual(Decimal(vacio['costo_s']), 0)
        unico = optimizar_recorrido([['0', '1.125'], ['2.250', '0']])
        self.assertEqual(unico['orden'], [1])
        self.assertEqual(Decimal(unico['costo_s']), Decimal('3.375'))

    def test_rechaza_matrices_incompletas_no_finitas_y_ordenes_invalidos(self):
        for matriz in ([], [[0, 1]], [[0, None], [1, 0]], [[0, True], [1, 0]], [[0, -1], [1, 0]],
                       [[0, float('nan')], [1, 0]], [[0, 'Infinity'], [1, 0]], [[1]], [[0, {}], [1, 0]]):
            with self.subTest(matriz=matriz), self.assertRaises(ValueError):
                optimizar_recorrido(matriz)
        for orden in ([1, 1, 2], [0, 1, 2], [1, 2], [True, 2, 3]):
            with self.subTest(orden=orden), self.assertRaises(ValueError):
                optimizar_recorrido(MATRIZ_PEQUENA, orden_inicial=orden)

    def test_parametros_y_semillas_fuera_de_limites_se_rechazan(self):
        for cambios in ({'poblacion': 1}, {'generaciones': 0}, {'elite': 100}, {'torneo': 1},
                        {'probabilidad_mutacion': float('nan')}, {'probabilidad_cruce': True}):
            with self.subTest(cambios=cambios), self.assertRaises(ValueError):
                optimizar_recorrido(MATRIZ_PEQUENA, parametros=ParametrosGenetico(**cambios))
        for semilla in (-1, True, 4294967296):
            with self.assertRaises(ValueError):
                optimizar_recorrido(MATRIZ_PEQUENA, semilla=semilla)
