# Etapa 7: ubicación GPS autorizada en primer plano

3 de noviembre de 2026. Implementación y comprobaciones técnicas listas.
La prueba de señal y permisos en el teléfono real queda a cargo del usuario.
La etapa 6 recibió su confirmación visual: propuesta, destinos/colores y recorrido
confirmado coincidente entre móvil y web.

## Qué incluye

- `expo-location` 58.0.20 obtiene ubicaciones con permiso explícito. Se mantiene
  MapLibre, sin añadir otro SDK de mapas.
- Compartir y detener son acciones separadas de iniciar/finalizar el reparto.
  Solo se puede abrir seguimiento de un viaje propio en ruta con permiso de operar.
- El mapa muestra `recursos/mapas/camion.svg` únicamente cuando hay una medición
  GPS válida. El área alrededor representa la precisión informada por Android.
  No se coloca el camión en el almacén ni se simula su movimiento por la ruta.
- Los controles están en el mapa y en el detalle del viaje. Muestran búsqueda de
  señal, captura activa, precisión/hora, errores y confirmaciones pendientes.
  Centrar mi ubicación mueve la cámara cuando el chofer lo solicita.
- Cambiar a otra app o bloquear la pantalla detiene localmente la captura y
  solicita cerrar el seguimiento. Volver a HortyFru no lo reactiva por sí solo.
- Dejar de compartir, intentar finalizar y cerrar sesión detienen el observador
  local antes de esperar a la red. Expirar o cambiar de cuenta limpia el estado.
  Una suscripción o respuesta tardía no vuelve a activar una captura detenida.

## Datos y autorización

PostgreSQL guarda `SesionSeguimiento`, `LotePosiciones` y `PosicionSeguimiento`.
Cada seguimiento referencia el despacho, usuario y sesión Bearer del dispositivo,
con fecha inicial, vencimiento y cierre. Solo existe uno abierto por despacho.
Otro dispositivo no puede enviar ni cerrar ese seguimiento; la revocación del
acceso y la finalización del viaje lo cierran también en el backend.

Cada medición conserva UUID, latitud, longitud, precisión, hora de captura y hora
de recepción. Velocidad y rumbo son opcionales; valores ausentes no se inventan.
El acceso y el alcance se revalidan en el servicio, además de la capa HTTP.
Se conserva la auditoría central de aperturas, cierres y conteos de recepción;
no se copian coordenadas ni credenciales a los cambios de auditoría.

Se solicita un intervalo de 10 segundos y 5 metros a Android; el sistema puede
entregar actualizaciones con otra frecuencia. El coordinador limita las muestras
aceptadas a una cada 10 segundos y descarta lecturas antiguas o con precisión
superior a 100 metros. La UI explica cuándo se necesita mejor precisión.
La API comprueba límites de coordenadas, precisión, velocidad, rumbo y fechas;
acepta hasta 30 puntos por lote/minuto y limita los lotes nuevos a uno cada dos
segundos. Un reintento idéntico devuelve el resultado anterior sin duplicar puntos.

Los puntos tardíos válidos pueden conservarse en el historial, pero no desplazan
una posición con captura más reciente. Las posiciones nuevas se rechazan después
del cierre; un reintento de un lote ya confirmado puede comprobarse sin reabrirlo.
La ubicación no cambia la versión del despacho, su plan, productos ni cajillas.
Llegadas, descargas y finalización siguen siendo operaciones explícitas.

## API del chofer

Bajo `/api/v1/movil/mis-despachos/{id}/`, con Bearer del dispositivo:

| Acción | Cuerpo / resultado |
| --- | --- |
| `GET seguimiento/` | Sesión del dispositivo, última posición y posibilidad de iniciar. |
| `POST iniciar-seguimiento/` | `clave_operacion` UUID y `version` vigente. La clave identifica el seguimiento. |
| `POST enviar-posiciones/` | `sesion`, `clave_operacion` del lote y `posiciones` con UUID por punto. |
| `POST detener-seguimiento/` | `sesion` y `motivo`; cierre idempotente y terminal. |
| `GET posiciones-seguimiento/` | Historial propio con páginas fijas de 10, filtrado antes de paginar. |

Reutilizar una clave con otro viaje, dispositivo o contenido da conflicto.
La misma clave de inicio jamás reactiva una sesión ya terminada.
Al negar permisos, el reparto manual sigue disponible.

## Reintentos y límites de esta etapa

Ante una respuesta incierta se conserva el UUID y cuerpo del inicio/lote/cierre
en memoria, se detiene la captura y se muestra **Comprobar envío y detener**.
Comprobarlo no vuelve a encender el GPS. La cola está acotada a 30 mediciones;
esta etapa no garantiza conservar pendientes si Android termina el proceso.
SQLite, recuperación tras cierre y seguimiento en segundo plano corresponden a
la etapa 8. Un registro abierto en el servidor no demuestra que el teléfono
esté enviando: la hora de la última recepción es una evidencia independiente.

La supervisión en vivo del administrador, WebSockets y Channels siguen en la
etapa 9. Guardar puntos GPS no incorpora tráfico ni recalcula automáticamente
la ruta de la etapa 6. Los mapas completos sin conexión siguen siendo otro alcance.

## APK y prueba manual

Instalar en el teléfono `Movil/dist/apk/hortyfru-chofer-etapa7-desarrollo.apk`:
Android arm64, paquete `com.hortyfru.chofer`, versión 0.3.0 y código 3.
El APK anterior se conserva. Tiene permisos de ubicación aproximada y precisa;
no solicita ubicación en segundo plano. Se comprobaron manifiesto y firma v2.

SHA-256 del APK:
`fbb298935cd0996ed57c388c83fd425ecefc3dac2642481edb37701cc6b691af`.

Sigue siendo un cliente de desarrollo que requiere Metro y acceso al backend.
Con los servicios habituales encendidos, en Git Bash:

```bash
cd /c/Proyectos/Universidad/hortyfru/Movil
npm start -- --lan --clear
```

1. Abrir un despacho enviado, confirmar el recorrido e iniciar el viaje.
2. Pulsar Compartir ubicación, aceptar el aviso y autorizar ubicación precisa
   mientras se usa la app. Activar el GPS del teléfono y la hora automática.
3. Con buena señal, comprobar camión, área de precisión y hora. Caminar unos
   metros en un lugar seguro y comprobar que cambia la medición.
4. Pulsar Centrar mi ubicación y comprobar el encuadre.
5. Dejar de compartir: desaparece la posición local activa. Volver a compartir
   exige una nueva acción del usuario.
6. Cambiar de app o bloquear la pantalla: al volver el seguimiento sigue detenido.
7. Negar el permiso: aparece la explicación y las operaciones manuales siguen
   disponibles. La prueba con mala señal debe mostrar el estado correspondiente.

## Validación y base de datos

La migración `despachos.0007_seguimiento_gps` se aplicó con respaldo PostgreSQL
previo y comprobación de huellas de todas las filas anteriores. Solo se añadieron
tablas, la migración y los tres tipos de contenido nuevos; no se crearon viajes
ni posiciones GPS de negocio para las pruebas.
Respaldo y verificación: `.backups/seguimiento_etapa7_20261104_010309_UTC/`.

Pasaron 559 pruebas en la suite completa de backend antes de añadir la prueba
de concurrencia, y después las 15 pruebas específicas del GPS, incluida la recepción
simultánea del mismo lote con dos conexiones PostgreSQL. Pasaron las 49 pruebas
móviles, incluidos permisos, cambio de cuenta, cuerpos estables de reintento y
respuestas/suscripciones tardías. Se generó el APK con Gradle correctamente.
También pasaron TypeScript completo/de lógica, las 163 pruebas de la web,
`manage.py check`, ausencia de migraciones pendientes y exportaciones Android/web.
Los registros de ejecución están en `.backups/`.

La comprobación en línea de Expo recomendó nuevas versiones de seis dependencias
ya existentes. Se conservaron las versiones fijadas de la base que el usuario
había probado; Expo Location coincide con la versión del SDK 58.0.22 instalado.
La consulta local coincide con su manifiesto de módulos, aunque Expo advierte
que su comprobación offline no sustituye la validación en línea. Estas
actualizaciones recomendadas quedan pendientes de una revisión separada.

La aceptación física de señal, permisos y presentación del camión sigue pendiente
de la prueba en el teléfono. No se automatizó el escritorio ni el dispositivo.
