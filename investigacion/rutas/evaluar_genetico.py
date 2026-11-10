"""Experimentos del mismo módulo que ejecuta Django. No escribe en la base de datos."""
import argparse
import csv
import hashlib
import importlib.metadata
import itertools
import json
import math
import platform
import random
import statistics
import sys
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path
from time import perf_counter

raiz = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(raiz / 'Backend'))
from despachos.optimizacion.genetico import (ParametrosGenetico, VERSION_ALGORITMO,
    optimizar_recorrido, validar_matriz, costo_recorrido, vecino_mas_cercano)


def leer_caso(archivo):
    datos = json.loads(archivo.read_text(encoding='utf-8'))
    matriz = validar_matriz(datos['matriz'])
    datos['huella_matriz'] = hashlib.sha256(json.dumps(datos['matriz'], separators=(',', ':')).encode()).hexdigest()
    return datos, matriz


def resolver_referencia(matriz, presupuesto_ms):
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    gestor = pywrapcp.RoutingIndexManager(len(matriz), 1, 0)
    modelo = pywrapcp.RoutingModel(gestor)
    enteros = []
    for fila in matriz:
        nueva = []
        for valor in fila:
            escalado = valor * 1000000
            if escalado != escalado.to_integral_value():
                raise ValueError('La comparación requiere costos representables exactamente en micro-unidades.')
            nueva.append(int(escalado))
        enteros.append(nueva)
    def costo(origen, destino):
        return enteros[gestor.IndexToNode(origen)][gestor.IndexToNode(destino)]
    indice = modelo.RegisterTransitCallback(costo)
    modelo.SetArcCostEvaluatorOfAllVehicles(indice)
    parametros = pywrapcp.DefaultRoutingSearchParameters()
    parametros.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    parametros.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    parametros.time_limit.FromMilliseconds(max(1, presupuesto_ms))
    solucion = modelo.SolveWithParameters(parametros)
    if not solucion:
        return None
    orden, actual = [], modelo.Start(0)
    while not modelo.IsEnd(actual):
        nodo = gestor.IndexToNode(actual)
        if nodo:
            orden.append(nodo)
        actual = solucion.Value(modelo.NextVar(actual))
    if sorted(orden) != list(range(1, len(matriz))):
        raise AssertionError('La referencia devolvió una ruta incompleta.')
    return orden


def entorno():
    return {'python': sys.version, 'plataforma': platform.platform(), 'algoritmo': VERSION_ALGORITMO,
            'paquetes': {nombre: importlib.metadata.version(nombre) for nombre in ('deap', 'numpy', 'matplotlib', 'ortools')}}


def ejecutar_experimentos(carpeta_matrices, carpeta_resultados, repeticiones=30, parametros=None):
    parametros = parametros or ParametrosGenetico()
    carpeta_resultados.mkdir(parents=True, exist_ok=True)
    filas, historias, resumenes = [], {}, []
    for archivo in sorted(carpeta_matrices.glob('*.json')):
        caso, matriz = leer_caso(archivo)
        optimo = Decimal(str(caso['optimo'])) if caso.get('optimo') is not None else None
        if len(matriz) <= 9:
            exacto = min(costo_recorrido(matriz, orden) for orden in itertools.permutations(range(1, len(matriz))))
            if optimo is not None and optimo != exacto:
                raise AssertionError('El óptimo declarado no coincide con la enumeración exhaustiva.')
            optimo = exacto
        costos, tiempos = [], []
        historias[caso['nombre']] = []
        for semilla in range(repeticiones):
            inicio = perf_counter()
            resultado = optimizar_recorrido(caso['matriz'], semilla=semilla, parametros=parametros, unidad=caso['unidad'])
            tiempo = perf_counter() - inicio
            orden = resultado['orden']
            if sorted(orden) != list(range(1, len(matriz))) or Decimal(resultado['costo']) != costo_recorrido(matriz, orden):
                raise AssertionError('El genético devolvió una ruta o costo inválidos.')
            costo_genetico = Decimal(resultado['costo'])
            costos.append(float(costo_genetico))
            tiempos.append(tiempo)
            historias[caso['nombre']].append({'semilla': semilla, 'historial': resultado['historial']})
            metodos = [('genetico', orden, tiempo, semilla)]
            if semilla == 0:
                metodos.extend([('orden_actual', list(range(1, len(matriz))), None, ''),
                                ('vecino_mas_cercano', vecino_mas_cercano(matriz), None, '')])
            inicio_referencia = perf_counter()
            referencia = resolver_referencia(matriz, math.ceil(tiempo * 1000))
            if referencia:
                metodos.append(('or_tools', referencia, perf_counter() - inicio_referencia, ''))
            for metodo, recorrido, duracion, semilla_metodo in metodos:
                costo = costo_recorrido(matriz, recorrido)
                filas.append({'caso': caso['nombre'], 'sucursales': len(matriz) - 1, 'metodo': metodo,
                    'semilla': semilla_metodo, 'repeticion': semilla, 'unidad': caso['unidad'], 'costo': str(costo),
                    'tiempo_calculo_s': f'{duracion:.6f}' if duracion is not None else '', 'optimo_conocido': str(optimo) if optimo is not None else '',
                    'brecha_porcentaje': str((costo - optimo) * 100 / optimo) if optimo else '',
                    'orden': json.dumps([0, *recorrido, 0]), 'huella_matriz': caso['huella_matriz']})
        resumenes.append({'caso': caso['nombre'], 'tipo': caso['tipo'], 'unidad': caso['unidad'],
            'sucursales': len(matriz) - 1, 'repeticiones': repeticiones, 'mejor': min(costos),
            'promedio': statistics.mean(costos), 'mediana': statistics.median(costos),
            'desviacion': statistics.stdev(costos) if len(costos) > 1 else 0,
            'tiempo_mediano_s': statistics.median(tiempos), 'optimo': str(optimo) if optimo is not None else None,
            'aciertos_optimo': sum(Decimal(str(costo)) == optimo for costo in costos) if optimo is not None else None,
            'huella_matriz': caso['huella_matriz']})
        print(json.dumps(resumenes[-1], ensure_ascii=False), flush=True)
    if not filas:
        raise ValueError('No hay matrices de evaluación.')
    with (carpeta_resultados / 'ejecuciones.csv').open('w', newline='', encoding='utf-8') as salida:
        escritor = csv.DictWriter(salida, fieldnames=list(filas[0]))
        escritor.writeheader()
        escritor.writerows(filas)
    reporte = {'entorno': entorno(), 'parametros': asdict(parametros), 'semillas': list(range(repeticiones)),
        'criterio': 'mismo_costo_dirigido_y_regreso; OR-Tools con presupuesto de búsqueda igual al tiempo del genético',
        'nota': 'OR-Tools es referencia heurística, no prueba de óptimo. Sintéticas y TSPLIB no son mediciones de La Paz.',
        'resumen': resumenes}
    (carpeta_resultados / 'resumen.json').write_text(json.dumps(reporte, indent=2, ensure_ascii=False), encoding='utf-8')
    (carpeta_resultados / 'historiales.json').write_text(json.dumps(historias, ensure_ascii=False), encoding='utf-8')
    graficar(historias, resumenes, carpeta_resultados)
    return reporte


def graficar(historias, resumenes, carpeta):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as grafica
    figura, ejes = grafica.subplots(len(resumenes), 1, figsize=(9, 3.1 * len(resumenes)), squeeze=False, layout='constrained')
    for eje, resumen in zip(ejes[:, 0], resumenes):
        series = [[float(fila['mejor']) for fila in ejecucion['historial']] for ejecucion in historias[resumen['caso']]]
        for serie in series:
            eje.plot(range(len(serie)), serie, color='#16803c', alpha=0.13, linewidth=0.9)
        medianas = [statistics.median(valores) for valores in zip(*series)]
        eje.plot(range(len(medianas)), medianas, color='#14532d', linewidth=2, label='Mediana de ejecuciones')
        if resumen['optimo'] is not None:
            eje.axhline(float(resumen['optimo']), color='#c2410c', linestyle='--', label='Óptimo conocido')
        nombre = ('Caso pequeño asimétrico' if resumen['caso'] == '01_pequena_asimetrica' else
                  'TSPLIB gr17 · 17 nodos' if resumen['tipo'] == 'tsplib_simetrica' else
                  f"Matriz sintética · {resumen['sucursales']} sucursales")
        eje.set(title=nombre, xlabel='Generación', ylabel='Tiempo sintético (s)' if resumen['unidad'] == 'segundos' else 'Costo original TSPLIB')
        eje.grid(alpha=0.2)
        eje.legend(fontsize=8)
    figura.savefig(carpeta / 'convergencia.png', dpi=180)
    figura.savefig(carpeta / 'convergencia.pdf')
    grafica.close(figura)


def calibrar(carpeta_resultados):
    """Conjunto separado del de evaluación; no adapta parámetros a casos finales."""
    configuraciones = [ParametrosGenetico(poblacion=60, generaciones=100, probabilidad_mutacion=0.20),
        ParametrosGenetico(probabilidad_mutacion=0.20),
        ParametrosGenetico(poblacion=100, generaciones=160, probabilidad_mutacion=0.35)]
    resultados = []
    for numero, parametros in enumerate(configuraciones):
        brechas, tiempos = [], []
        for tamano, semilla_matriz in ((13, 7731), (26, 7732)):
            azar = random.Random(semilla_matriz)
            matriz = [[0 if origen == destino else azar.randrange(60, 1200) for destino in range(tamano)] for origen in range(tamano)]
            for semilla in range(5):
                inicio = perf_counter()
                resultado = optimizar_recorrido(matriz, semilla=semilla, parametros=parametros)
                tiempos.append(perf_counter() - inicio)
                brechas.append(float(Decimal(resultado['costo']) / Decimal(resultado['costo_inicial'])))
        resultados.append({'configuracion': numero, 'parametros': asdict(parametros),
            'costo_relativo_promedio': statistics.mean(brechas), 'tiempo_mediano_s': statistics.median(tiempos)})
        print(json.dumps(resultados[-1]), flush=True)
    recomendado = min(resultados, key=lambda fila: (fila['costo_relativo_promedio'], fila['tiempo_mediano_s']))
    carpeta_resultados.mkdir(parents=True, exist_ok=True)
    (carpeta_resultados / 'calibracion.json').write_text(json.dumps({'entorno': entorno(),
        'matrices': [{'puntos': 13, 'semilla': 7731}, {'puntos': 26, 'semilla': 7732}],
        'semillas_ejecucion': list(range(5)), 'configuraciones': resultados, 'recomendado': recomendado}, indent=2), encoding='utf-8')
    return recomendado


def principal():
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument('--matrices', type=Path, default=Path(__file__).parent / 'matrices')
    argumentos.add_argument('--salida', type=Path, default=Path(__file__).parent / 'resultados')
    argumentos.add_argument('--repeticiones', type=int, default=30)
    argumentos.add_argument('--calibrar', action='store_true')
    valores = argumentos.parse_args()
    if valores.calibrar:
        calibrar(valores.salida)
    else:
        ejecutar_experimentos(valores.matrices, valores.salida, valores.repeticiones)


if __name__ == '__main__':
    principal()
