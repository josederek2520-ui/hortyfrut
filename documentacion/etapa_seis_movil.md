# Etapa 6: optimización del recorrido con OSRM y DEAP

3 de noviembre de 2026. Implementación y comprobaciones técnicas completas;
el usuario confirmó en el teléfono la propuesta, todos los destinos con iconos y
colores, el retorno y el recorrido aprobado coincidente con la web.

## Flujo del chofer

La web reúne carga, pedidos, transporte y cajillas y envía el despacho. En el
celular, abrir **Preparar recorrido → Optimizar recorrido**. Durante el cálculo
se puede esperar o pulsar **Cancelar cálculo**. La app mantiene el mapa y consulta
el estado mientras la pantalla está activa. Una propuesta muestra kilómetros,
tiempo estimado y, cuando existe, la mejora respecto al orden anterior.

**Usar recorrido** confirma el orden sobre las paradas existentes. **Iniciar viaje**
fija el plan. Las flechas conservan el ajuste manual y **Calcular este orden**
permite revisar ese orden. La web consulta el recorrido y sus métricas, sin
controles de planificación ni de descarga física.

## Cálculo y persistencia

- `OSRM Table` obtiene una matriz dirigida completa de tiempos. Se validan
  tamaños, valores finitos, diagonal, accesos y conexiones; no hay rellenos cero
  ni distancias rectas para destinos desconectados.
- `genetico.py` usa DEAP con aleatoriedad local, torneo, cruce OX, intercambio y
  élite explícita. Cada solución contiene todas las sucursales una vez y vuelve
  al mismo almacén. La matriz se reutiliza durante todas las generaciones.
- El costo es tiempo estimado de conducción, sin tráfico ni descarga. La carga
  ya está asignada: el genético ordena paradas y no reparte pedidos entre vehículos.
- Se obtienen los trazados original y propuesto con `OSRM Route`. Si el trazado
  propuesto no reduce la duración, se conserva el orden original. Se distinguen
  costo de matriz, duración del trazado y tiempo de ejecución del algoritmo.
- `CalculoOptimizacion` conserva puntos, versión, UUID, semilla, parámetros,
  matriz, resultados y estados. Celery ejecuta el trabajo fuera de HTTP; Redis
  transporta los mensajes y PostgreSQL conserva los datos oficiales.
- Solicitar, cancelar, iniciar y completar el cálculo tienen auditoría central.
  La adopción vuelve a validar usuario, permiso, viaje, versión y coordenadas.
  Las llamadas a OSRM y las generaciones no mantienen bloqueos de negocio.
- Una solicitud repetida conserva UUID y cuerpo. Solo puede existir un cálculo
  activo por despacho. Los trabajos cancelados, vencidos, ajenos o desactualizados
  no adoptan planes. Los trabajos vencen a los cinco minutos y pueden solicitarse
  de nuevo. Los límites del trabajador son 55 s suaves y 65 s duros.
- Un cálculo activo bloquea la edición del recorrido y el inicio. Calcular no
  mueve inventario, carga, paradas ni cajillas. La confirmación aplica el orden;
  salida, descargas y cierre conservan sus transacciones existentes.

La migración `despachos.0006_calculooptimizacion` está aplicada. Se creó un respaldo
PostgreSQL antes de migrar y se comprobaron las huellas de los registros anteriores;
se conservan. Django añade el tipo de contenido correspondiente al modelo nuevo.

## API y compatibilidad

Rutas bajo `/api/v1/movil/mis-despachos/{id}/`:

| Ruta | Contrato |
| --- | --- |
| `POST optimizar-ruta/` | `version`, `clave_operacion`, `orden_paradas` completo opcional y `semilla` opcional; HTTP 202 |
| `POST cancelar-optimizacion/` | `version`, `clave_operacion`, `calculo` |
| `GET ruta/` | Conserva los estados anteriores del recorrido y añade `optimizacion.estado` y `puede_optimizar` |
| `POST aprobar-ruta/` | Conserva versión, UUID y plan; aplica únicamente el orden confirmado |

La consulta administrativa existente muestra la misma información. Las matrices,
parámetros completos e historiales de generaciones no se envían al celular. Los
clientes anteriores conservan los estados de ruta conocidos. Cambiar las entradas
o revocar permisos impide adoptar una propuesta antigua.

## Iconos y colores

Los SVG aportados están en `recursos/mapas/`, con adaptadores para Android y web.
Cada sucursal tiene un color estable dentro del viaje, independiente del orden,
compartido entre pin, número y tramo que llega a ella. El almacén y retorno usan
verde. Los números y nombres permiten identificar destinos además del color.
Los colores admiten texto blanco con contraste mínimo 4.5:1.

Cada tramo nuevo conserva la geometría exacta de los pasos de OSRM. Los recorridos
históricos sin ese desglose mantienen su línea global: no se reconstruyen tramos
por cercanía ni se cambian sus coordenadas guardadas. Recalcular antes de salir
permite obtener el desglose nuevo. Los colores no representan congestión.

## Encender desde Git Bash

Con Docker Desktop y PostgreSQL funcionando, desde la raíz:

```bash
docker compose -f infraestructura/rutas/compose.yaml up -d
docker compose -f infraestructura/optimizacion/compose.yaml up -d --build
docker compose -f infraestructura/optimizacion/compose.yaml ps
```

Se conservan los comandos de Django, Next.js y Metro de la [etapa 5](etapa_cinco_movil.md).
Para recargar el JavaScript del celular:

```bash
cd Movil
npm start -- --lan --clear
```

No se añadieron bibliotecas nativas: se utiliza `react-native-svg` ya incluido en
el APK de desarrollo. Ese APK sigue requiriendo Metro. El equipo y el teléfono
deben poder comunicarse con la API configurada.

El trabajador Linux conecta a PostgreSQL del equipo mediante `host.docker.internal`
y a OSRM mediante la red existente `rutas_default`. Redis se publica solo en
`127.0.0.1:6379`. Python y Redis usan imágenes fijadas por digest. La imagen no
incorpora `.env`; los datos de conexión se suministran al ejecutar el contenedor.

Configuración documentada en `Backend/.env.example`: `OPTIMIZACION_HABILITADA`,
`CELERY_BROKER_URL`, `COLA_OPTIMIZACION` y `OSRM_SERVIDORES_INTERNOS`. Los servidores
HTTP adicionales solo se admiten cuando se declaran explícitamente como internos.
El límite actual de OSRM es 100 puntos, contando origen y retorno; superar el
límite rechaza el cálculo completo en lugar de omitir destinos.

Para una instalación nueva, instalar los requisitos y aplicar migraciones antes
de iniciar los servicios. En esta computadora esas operaciones ya se completaron.

## Evaluación y pruebas

El [cuaderno](../investigacion/rutas/demostracion_genetico.ipynb) y el
[procedimiento reproducible](../investigacion/rutas/README.md) usan el mismo módulo
Python de producción. Se ejecutaron 30 calibraciones y 180 ejecuciones finales
del genético en seis matrices, con referencias fuera del flujo de la app.

El caso pequeño alcanzó su óptimo en 30/30 ejecuciones. gr17 alcanzó 2085 en 16/30,
con promedio 2089.03. Se reporta la variabilidad; no se promete óptimo global.
Los CSV, resúmenes, huellas y gráficas PNG/PDF están en `investigacion/rutas/resultados/`.

La prueba integral utilizó PostgreSQL separado, sesión Bearer de un chofer limitado,
Celery y Redis reales, OSRM real y la API completa: optimizar, confirmar, iniciar,
llegar, descargar por pedido con reintentos y finalizar. Conservó los movimientos
de productos y no duplicó cajillas. No se crearon ni iniciaron viajes de negocio
en la base habitual para estas pruebas. No se automatizó el teléfono ni el navegador.

Comprobaciones finales: 545 pruebas de backend, 163 web y 33 móviles correctas;
TypeScript, ESLint de los componentes web modificados, compilación Next.js y
exportaciones Android/web correctas. La migración no deja cambios pendientes y
las dependencias instaladas pasan `pip check`.

## Próxima etapa

La [etapa 7](etapa_siete_movil.md) implementa GPS autorizado en primer plano;
su prueba física queda pendiente. El historial de tiempos propios y el
tráfico por horario quedan para trabajos posteriores; esta etapa utiliza tiempos
estáticos de OSRM y no requiere Google Maps ni una API comercial de tráfico.
