# Etapa 5: mapas y recorridos por carretera

Implementación inicial del 1 de noviembre; flujo actualizado el 3 de noviembre de 2026. Validación de campo pendiente. El [procedimiento vigente del chofer](recorrido_chofer.md) sustituye la planificación desde la administración.

## Qué se implementó

- Android usa MapLibre Native. La web usa React Leaflet y MapLibre. Ambas muestran la misma geometría guardada en Django.
- OpenFreeMap proporciona el mapa base con datos de OpenStreetMap y OpenMapTiles. Se conservan sus atribuciones. No se incorpora Google Maps SDK ni una clave con facturación.
- OSRM funciona en Docker en esta computadora, con cartografía de Bolivia descargada de Geofabrik y comprobada con su suma MD5. La imagen del motor está fijada por digest.
- El cálculo respeta el orden de sucursales del despacho e incluye el regreso al mismo almacén. Devuelve kilómetros y tiempo estimado de conducción **sin tráfico en vivo**. No añade tiempos de descarga.
- El mapa del chofer permite ordenar, calcular, confirmar e iniciar su propio recorrido. Conserva cabecera compacta, encuadre, paradas numeradas y tarjeta contraíble. «Ver entregas» abre las acciones existentes de llegada y descarga.
- Cuenta → Apariencia permite elegir **Claro** u **Oscuro**. La elección se guarda en el celular y no depende del tema del sistema. El mapa ofrece también un botón de sol/luna.

## Flujo administrativo

1. Completar y confirmar las coordenadas del **acceso real** del almacén y de cada sucursal. No colocar puntos aproximados para conseguir que el cálculo pase.
2. Crear o editar un despacho en borrador. Elegir la carga, el transporte y el orden de sucursales.
3. Abrir **Revisión**, comprobar carga y transporte y pulsar **Enviar al chofer**. Enviar valida capacidad y no registra salida física.
4. En el celular, abrir **Preparar recorrido**, ordenar las paradas y pulsar **Calcular recorrido**.
5. Revisar el trazado y los accesos y pulsar **Usar recorrido**.
6. Iniciar el viaje desde la app. La salida fija el plan confirmado y mueve cajillas a tránsito. La web consulta el recorrido y las entregas.

Cambiar las ubicaciones durante la preparación del recorrido deja obsoleto el plan y exige recalcular. El chofer confirma el orden antes de salir; la salida fija puntos y geometría. Los planes históricos ya fijados conservan su evidencia y los viajes sin plan mantienen la alternativa manual.

Los viajes anteriores ya iniciados no reciben ubicaciones ni planes inventados. Para probar el flujo nuevo, enviar un borrador al chofer y preparar el recorrido desde su celular antes de salir.

## Encender todo desde Git Bash

Primero iniciar Docker Desktop. Si está cerrado y su CLI está disponible:

```bash
docker desktop start --detach
```

Preparar o iniciar OSRM desde la raíz del proyecto. La primera preparación descarga los datos de Bolivia y procesa la cartografía; las siguientes reutilizan los archivos verificados:

```bash
cd /c/Proyectos/Universidad/hortyfru
./Backend/.venv/Scripts/python.exe infraestructura/rutas/preparar_osrm.py
```

Los datos ya quedaron preparados en esta computadora. Para arrancarlos después basta:

```bash
cd /c/Proyectos/Universidad/hortyfru
docker compose -f infraestructura/rutas/compose.yaml up -d
docker compose -f infraestructura/rutas/compose.yaml ps
```

Terminal 1, Django:

```bash
cd /c/Proyectos/Universidad/hortyfru/Backend
DEBUG=True ALLOWED_HOSTS=localhost,127.0.0.1,192.168.0.4 \
  ./.venv/Scripts/python.exe manage.py runserver 0.0.0.0:8000
```

Terminal 2, administración web:

```bash
cd /c/Proyectos/Universidad/hortyfru/Frontend
npm run dev
```

Terminal 3, aplicación móvil:

```bash
cd /c/Proyectos/Universidad/hortyfru/Movil
npm start -- --lan --clear
```

Estos comandos de desarrollo usan la IP configurada actualmente, `192.168.0.4`. Si la computadora cambia de IP, actualizar `EXPO_PUBLIC_API_URL` en `Movil/.env` y el host permitido de Django. El celular debe poder alcanzar esa computadora; para este ensayo en LAN, conectar ambos a la misma red y permitir los puertos de desarrollo en el firewall cuando corresponda.

## Instalar la actualización Android

Archivo: [`hortyfru-chofer-etapa5.apk`](../Movil/dist/apk/hortyfru-chofer-etapa5.apk), versión **0.2.0**, código **2**, Android arm64. Abrirlo manualmente en el teléfono e instalar como actualización. Su firma coincide con la del APK anterior; no hace falta desinstalar la aplicación.

El APK anterior y Expo Go no contienen la biblioteca nativa nueva de mapas. Este APK de desarrollo necesita Metro y una API accesible; no es todavía el APK autónomo de distribución.

SHA-256 del APK verificado: `6a57dd57a259cdf6d735d38e22fe0e252bb02eabd25593f81e0715233e2b76a8`.

Para regenerarlo sin abrir ni controlar el teléfono:

```bash
cd /c/Proyectos/Universidad/hortyfru/Movil
npm run compilar:android -- --salida dist/apk/hortyfru-chofer-etapa5.apk
```

## Contratos y protección de datos

| Operación | Endpoint bajo `/api/v1/` | Permiso y alcance |
| --- | --- | --- |
| Consultar en web | `GET despachos/{id}/ruta/` | Ver despachos |
| Calcular desde el celular | `POST movil/mis-despachos/{id}/calcular-ruta/` | Chofer propio, permiso de operar; recibido antes de salir; versión, UUID y todas las paradas |
| Confirmar desde el celular | `POST movil/mis-despachos/{id}/aprobar-ruta/` | Igual; exige el último plan vigente y su identificador |
| Consultar en celular | `GET movil/mis-despachos/{id}/ruta/` | Sesión móvil y viaje autorizado del propio chofer |

El cálculo no acepta geometría introducida por el cliente. Django consulta OSRM sin mantener bloqueos de negocio durante la llamada y vuelve a comprobar autorización, versión y ubicaciones al guardar. Se conserva el documento completo, aunque haya más de diez sucursales; esto no cambia la paginación de los listados.

`PlanRutaDespacho` conserva puntos utilizados, geometría, tramos, métricas, versión del plan, UUID, responsables y fechas de cálculo, aprobación y fijación. Los cambios tienen auditoría central y transacciones. Los reintentos mantienen UUID y cuerpo; los conflictos no generan planes parciales ni repiten movimientos.

El teléfono consulta Django para leer el plan y OpenFreeMap para visualizar el mapa. No recibe credenciales de PostgreSQL ni necesita acceder al puerto de OSRM. El puerto `5000` de OSRM está publicado solo en `127.0.0.1`.

## Comprobaciones realizadas

- Suite del backend: **496 pruebas** correctas en PostgreSQL aislado. Tras reforzar la concurrencia, **13 pruebas específicas de rutas** correctas, incluida una adicional entre dos despachos con el mismo UUID.
- Frontend: **154 pruebas**, compilación Next.js y controles de tipos/código de los componentes modificados.
- Móvil: **19 pruebas**, TypeScript completo y lógica; exportaciones Android/web y compilación nativa del APK.
- OSRM real: consulta técnica de ida y retorno con tres puntos, dos tramos y 153 coordenadas de geometría. No se guardaron esos puntos en los datos de negocio.
- Migración `despachos.0004_plan_ruta_carretera` aplicada a la base habitual. Se conservaron los conteos de usuarios, pedidos, preparaciones, lotes, movimientos, despachos, cargas, paradas y cajillas. No se creó un plan ni una operación de reparto real.
- Firma del APK comprobada y coincidente con la anterior. No se automatizó el teléfono ni el navegador.

La auditoría npm tiene avisos abiertos en dependencias existentes: **13 moderados en móvil**, sin altos ni críticos después de sus parches compatibles, y 18 en web al revisar, incluido uno crítico en Next.js. Las cuatro bibliotecas nuevas de mapas web no presentan avisos directos en esa revisión. No se hizo una actualización masiva del frontend para resolverlos; deben revisarse antes de una distribución pública.

## Qué queda por comprobar en el teléfono

1. Revisar los accesos reales de las coordenadas registradas de Almacén Central, Miraflores y Satelite.
2. Abrir un despacho recibido, preparar y confirmar su recorrido en el celular y comparar el resultado con el seguimiento web.
3. Contraer y expandir la tarjeta; encuadrar el recorrido; probar letra grande, claro/oscuro y movimiento reducido. Cerrar y abrir la app para comprobar que conserva el tema elegido.
4. Registrar salida, llegada y descarga por pedido con el flujo habitual. Verificar el próximo destino y el retorno sin duplicar cajillas ni productos.
5. Probar errores: mapa sin conexión, OSRM detenido, falta de coordenadas y cambio concurrente. Deben mostrarse sin confirmar operaciones desconocidas ni perder el despacho.

## Límites de esta etapa

OSRM utiliza un perfil de conducción estático; no certifica restricciones de camiones, altura, tonelaje o accesos particulares. El administrador revisa la ruta antes de aprobarla. «Abrir navegación» abre Google Maps por URL pública, sin SDK ni clave, hacia el destino guardado y advierte que esa aplicación puede calcular un recorrido diferente.

No se implementan tráfico en vivo, navegación giro a giro dentro de HortyFru, seguimiento GPS, recálculo desde la posición del chofer, optimización del orden ni almacenamiento sin conexión. Corresponden a sus etapas respectivas. Los permisos Android de ubicación están excluidos explícitamente del APK de esta etapa; mostrar el plan no requiere acceder al GPS. El mapa base necesita Internet y OSRM necesita estar encendido para **calcular**; consultar un plan ya guardado no vuelve a llamar al motor.
