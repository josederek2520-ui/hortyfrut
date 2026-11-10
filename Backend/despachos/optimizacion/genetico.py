"""TSP asimétrico cerrado con DEAP y aleatoriedad aislada por ejecución.

El nodo 0 es el almacén. Los individuos contienen índices 1..n de la matriz,
nunca identificadores de la base de datos. Los operadores OX, torneo e intercambio
usan un Random local; no cambian el estado aleatorio global ni necesitan Django.
Referencias y decisiones: investigacion/rutas/README.md.
"""
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation
from random import Random

from deap import base, tools


VERSION_ALGORITMO = 'genetico-hortyfru-1'


@dataclass(frozen=True)
class ParametrosGenetico:
    poblacion: int = 100
    generaciones: int = 160
    probabilidad_cruce: float = 0.85
    probabilidad_mutacion: float = 0.35
    elite: int = 2
    torneo: int = 3


class AptitudTiempo(base.Fitness):
    # Pesos enteros para conservar los costes Decimal sin convertirlos a float.
    weights = (-1,)


class IndividuoRuta(list):
    def __init__(self, valores=()):
        super().__init__(valores)
        self.fitness = AptitudTiempo()


def validar_matriz(matriz):
    if not isinstance(matriz, (list, tuple)) or not 1 <= len(matriz) <= 500:
        raise ValueError('La matriz debe contener entre 1 y 500 puntos, incluido el almacén.')
    cantidad = len(matriz)
    resultado = []
    for indice, fila in enumerate(matriz):
        if not isinstance(fila, (list, tuple)) or len(fila) != cantidad:
            raise ValueError('La matriz debe ser cuadrada y estar completa.')
        nueva = []
        for columna, valor in enumerate(fila):
            if isinstance(valor, bool) or not isinstance(valor, (str, int, float, Decimal)):
                raise ValueError('Cada tiempo debe ser un número no negativo.')
            try:
                numero = Decimal(str(valor))
            except InvalidOperation:
                raise ValueError('Hay un tiempo inválido en la matriz.') from None
            if not numero.is_finite() or numero < 0 or numero >= Decimal('1000000000000'):
                raise ValueError('Hay un tiempo fuera del rango admitido.')
            if indice == columna and numero != 0:
                raise ValueError('La diagonal de la matriz debe ser cero.')
            nueva.append(numero)
        resultado.append(tuple(nueva))
    return tuple(resultado)


def validar_orden(orden, cantidad):
    if (not isinstance(orden, (list, tuple)) or len(orden) != cantidad - 1
            or any(type(indice) is not int for indice in orden)
            or set(orden) != set(range(1, cantidad))):
        raise ValueError('El orden debe incluir cada sucursal exactamente una vez.')
    return list(orden)


def costo_recorrido(matriz, orden):
    recorrido = [0, *orden, 0]
    return sum((matriz[origen][destino] for origen, destino in zip(recorrido, recorrido[1:])), Decimal(0))


def vecino_mas_cercano(matriz):
    pendientes = set(range(1, len(matriz)))
    orden, actual = [], 0
    while pendientes:
        siguiente = min(pendientes, key=lambda indice: (matriz[actual][indice], indice))
        orden.append(siguiente)
        pendientes.remove(siguiente)
        actual = siguiente
    return orden


def cruzar_ordenado(primero, segundo, azar):
    """Cruce OX de permutaciones con generador explícito, basado en DEAP cxOrdered."""
    if len(primero) < 2:
        return primero, segundo
    inicio, fin = sorted(azar.sample(range(len(primero)), 2))
    def descendiente(propio, ajeno):
        resultado = [None] * len(propio)
        resultado[inicio:fin + 1] = propio[inicio:fin + 1]
        conservados = set(propio[inicio:fin + 1])
        posiciones = [*range(fin + 1, len(propio)), *range(inicio)]
        valores = [valor for valor in [*ajeno[fin + 1:], *ajeno[:fin + 1]] if valor not in conservados]
        for posicion, valor in zip(posiciones, valores):
            resultado[posicion] = valor
        return resultado
    anterior = list(primero)
    primero[:] = descendiente(primero, segundo)
    segundo[:] = descendiente(segundo, anterior)
    return primero, segundo


def intercambiar(individuo, azar):
    if len(individuo) > 1:
        primero, segundo = azar.sample(range(len(individuo)), 2)
        individuo[primero], individuo[segundo] = individuo[segundo], individuo[primero]
    return individuo,


def seleccionar_torneo(poblacion, cantidad, tamano, azar):
    return [max((azar.choice(poblacion) for _ in range(tamano)), key=lambda individuo: individuo.fitness)
            for _ in range(cantidad)]


def validar_parametros(parametros):
    enteros = (parametros.poblacion, parametros.generaciones, parametros.elite, parametros.torneo)
    if (any(type(valor) is not int for valor in enteros)
            or not 4 <= parametros.poblacion <= 500 or not 1 <= parametros.generaciones <= 1000
            or not 1 <= parametros.elite < parametros.poblacion or not 2 <= parametros.torneo <= parametros.poblacion):
        raise ValueError('Los parámetros del genético están fuera de los límites admitidos.')
    for valor in (parametros.probabilidad_cruce, parametros.probabilidad_mutacion):
        if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not 0 <= valor <= 1:
            raise ValueError('Las probabilidades deben estar entre cero y uno.')


def optimizar_recorrido(matriz, *, semilla=42, parametros=None, orden_inicial=None, unidad='segundos'):
    matriz = validar_matriz(matriz)
    parametros = parametros or ParametrosGenetico()
    validar_parametros(parametros)
    if unidad not in ('segundos', 'costo_original'):
        raise ValueError('La unidad debe ser segundos o costo_original.')
    if type(semilla) is not int or not 0 <= semilla <= 4294967295:
        raise ValueError('La semilla debe ser un entero entre 0 y 4294967295.')
    orden_inicial = validar_orden(list(range(1, len(matriz))) if orden_inicial is None else orden_inicial, len(matriz))
    azar = Random(semilla)
    caja = base.Toolbox()
    caja.register('evaluar', lambda individuo: (costo_recorrido(matriz, individuo),))
    caja.register('seleccionar', seleccionar_torneo, tamano=parametros.torneo, azar=azar)
    caja.register('cruzar', cruzar_ordenado, azar=azar)
    caja.register('mutar', intercambiar, azar=azar)
    poblacion = [IndividuoRuta(orden_inicial), IndividuoRuta(vecino_mas_cercano(matriz))]
    poblacion.extend(IndividuoRuta(azar.sample(orden_inicial, len(orden_inicial))) for _ in range(parametros.poblacion - 2))
    mejores = tools.HallOfFame(1)
    historial, evaluaciones = [], 0
    generaciones = parametros.generaciones if len(orden_inicial) > 1 else 0
    for generacion in range(generaciones + 1):
        for individuo in poblacion:
            if not individuo.fitness.valid:
                individuo.fitness.values = caja.evaluar(individuo)
                evaluaciones += 1
        mejores.update(poblacion)
        costos = [individuo.fitness.values[0] for individuo in poblacion]
        historial.append({'generacion': generacion, 'mejor': str(min(costos)), 'promedio': str(sum(costos) / len(costos)),
                          **({'mejor_s': str(min(costos)), 'promedio_s': str(sum(costos) / len(costos))} if unidad == 'segundos' else {}),
                          'evaluaciones': evaluaciones,
                          'diversidad': len({tuple(individuo) for individuo in poblacion})})
        if generacion == generaciones:
            break
        # HallOfFame registra; esta copia explícita de la élite es lo que preserva los mejores.
        elite = [caja.clone(individuo) for individuo in tools.selBest(poblacion, parametros.elite)]
        descendientes = [caja.clone(individuo) for individuo in caja.seleccionar(poblacion, len(poblacion) - len(elite))]
        for primero, segundo in zip(descendientes[::2], descendientes[1::2]):
            if azar.random() < parametros.probabilidad_cruce:
                caja.cruzar(primero, segundo)
                del primero.fitness.values
                del segundo.fitness.values
        for individuo in descendientes:
            if azar.random() < parametros.probabilidad_mutacion:
                caja.mutar(individuo)
                del individuo.fitness.values
        poblacion = elite + descendientes
    mejor = list(mejores[0])
    validar_orden(mejor, len(matriz))
    return {'algoritmo': VERSION_ALGORITMO, 'orden': mejor, 'costo': str(costo_recorrido(matriz, mejor)),
            'costo_inicial': str(costo_recorrido(matriz, orden_inicial)),
            **({'costo_s': str(costo_recorrido(matriz, mejor)), 'costo_inicial_s': str(costo_recorrido(matriz, orden_inicial))} if unidad == 'segundos' else {}),
            'unidad': unidad, 'semilla': semilla,
            'parametros': asdict(parametros), 'historial': historial, 'evaluaciones': evaluaciones,
            'inicializacion': 'orden_actual_vecino_y_aleatorios', 'objetivo': 'tiempo_conduccion_s' if unidad == 'segundos' else 'costo_matriz',
            'trafico_en_vivo': False}
