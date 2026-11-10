# Evaluación reproducible del genético de HortyFru

El algoritmo de producción está en `Backend/despachos/optimizacion/genetico.py`.
Este directorio lo importa directamente. No existe una segunda implementación
del genético en el cuaderno y no se necesita Django ni PostgreSQL para evaluarlo.

## Modelo y decisiones

- TSP asimétrico cerrado. La matriz contiene el almacén en el índice 0; los
  individuos permutan los índices 1..n y la evaluación añade salida y retorno.
- Se minimiza el costo dirigido total. En producción el costo es tiempo estimado
  de conducción de OSRM, en segundos, sin tráfico ni tiempos de descarga.
- DEAP aporta `Fitness`, `Toolbox`, copia de individuos, selección de élite y
  `HallOfFame`. Torneo, OX e intercambio usan `random.Random` local para que dos
  solicitudes no compartan ni alteren el estado aleatorio global.
- El cruce sigue OX documentado en DEAP, adaptado a índices 1..n y generador local.
  La élite se copia explícitamente a cada generación; `HallOfFame` solo la registra.
- La población incluye orden actual, vecino más cercano y órdenes aleatorios.
  Esta inicialización se registra y se considera al interpretar la comparación.
- Calibración: dos matrices sintéticas separadas (semillas 7731/7732), cinco semillas
  de ejecución y tres configuraciones. Se eligió población 100, generaciones 160,
  cruce 0.85, mutación 0.35, élite 2 y torneo 3 por el costo relativo promedio de
  este conjunto. No se afirma que sean parámetros universalmente mejores.
- La evaluación final utiliza otras matrices. No se ajustan parámetros mirando
  estos resultados. La misma semilla, matriz, versiones y presupuesto fijo de
  generaciones permiten repetir el cálculo; el tiempo de pared depende del equipo.

## Matrices y evidencia

`matrices/` contiene una instancia pequeña con óptimo comprobable por enumeración,
gr17 de TSPLIB y casos asimétricos sintéticos de 10, 20, 40 y 80 sucursales.
Los sintéticos no son mediciones de La Paz. gr17 conserva sus costos originales;
no se presentan como segundos. Su archivo registra URL inmutable y SHA-256.

En `resultados/` se guardaron:

- `calibracion.json`: datos y configuraciones previas a la evaluación.
- `ejecuciones.csv`: 180 ejecuciones del genético, referencias y costos verificables.
- `resumen.json`: parámetros, versiones, semillas, huellas y estadísticas por caso.
- `historiales.json`: mejor costo, promedio, diversidad y evaluaciones por generación.
- `convergencia.png` y `convergencia.pdf`: curvas por ejecución y su mediana.
- `prueba_integral.json`: comprobación API → Celery/Redis → OSRM real → confirmación
  → salida → descargas con reintentos → cierre, en PostgreSQL separado.

Resultados medidos: el caso pequeño alcanzó su óptimo en 30/30 ejecuciones; gr17
alcanzó 2085 en 16/30, con promedio 2089.03 y mediana 2085. Los casos mayores no
tienen un óptimo certificado en este experimento. OR-Tools es una referencia
heurística; se le asigna un presupuesto de búsqueda aproximado igual al tiempo
medido del genético y se registra también su tiempo total. No se anuncia que el
genético siempre supera las referencias ni que certifica el óptimo global.

El costo estimado del recorrido y el tiempo real de cálculo son métricas separadas.
El tiempo de orden actual y vecino más cercano no se instrumentó y se deja vacío;
no se representa una medición ausente como cero. El archivo
`resultados/entorno_completo.lock.txt` conserva las versiones instaladas durante
la evaluación local.
Cada solución se comprueba contra una suma independiente de sus tramos y debe
contener todos los destinos una sola vez. Los errores e instancias sin conexión
no se sustituyen por tiempos cero ni distancias en línea recta.

## Ejecutar desde Git Bash

Desde la raíz del proyecto, con las dependencias autorizadas instaladas:

```bash
./Backend/.venv/Scripts/python.exe investigacion/rutas/evaluar_genetico.py --calibrar
./Backend/.venv/Scripts/python.exe investigacion/rutas/evaluar_genetico.py --repeticiones 30
```

El cuaderno `demostracion_genetico.ipynb` abre en Jupyter o Colab. En Colab se
prepara una copia del código y las matrices, se selecciona su raíz en la primera
celda y se instalan los requisitos de este directorio. Se utiliza CPU. El cuaderno
no requiere credenciales ni una conexión a la base real; los experimentos operan
sobre los JSON. El OSRM local de la computadora no es el localhost de Colab.

Para repetir una evaluación sin sobrescribir la evidencia entregada:

```bash
./Backend/.venv/Scripts/python.exe investigacion/rutas/evaluar_genetico.py \
  --repeticiones 30 --salida investigacion/rutas/resultados_nueva_ejecucion
```

## Referencias

- [DEAP: Toolbox y Fitness](https://deap.readthedocs.io/en/master/api/base.html)
- [DEAP: operadores, OX y HallOfFame](https://deap.readthedocs.io/en/master/api/tools.html)
- [Ejemplo TSP del proyecto DEAP](https://github.com/DEAP/deap/blob/master/examples/ga/tsp.py)
- [TSPLIB, instancias y soluciones de referencia](https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/)
- [OSRM: servicios Table y Route](https://project-osrm.org/docs/v26.6.1/http)
- [OR-Tools: TSP y límites de optimalidad](https://developers.google.com/optimization/routing/tsp)

La contribución de HortyFru es la adaptación, evaluación, validación e integración
con la operación del despacho; los operadores y herramientas reutilizados se
reconocen mediante estas referencias.
