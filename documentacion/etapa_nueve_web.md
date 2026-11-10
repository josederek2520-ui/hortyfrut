# Etapa 9: supervisión en vivo desde la administración

4 de noviembre de 2026. Implementación técnica de la supervisión por despacho.
La validación física con el teléfono sigue pendiente. `Movil/` permanece disponible.

Actualización de la interfaz: la supervisión se trasladó al enlace lateral
**Seguimiento de camiones** (`/seguimiento-camiones`). Reúne viajes en ruta y
enviados pendientes de salida, sin limitar por fecha, con buscador y páginas de
10. Cada viaje seleccionado muestra su almacén, chofer, vehículo y mapa. Desde
Despachos, **Abrir seguimiento** lleva directamente al viaje; allí ya no se abre
un canal GPS incrustado. Los listados y la consulta requieren permiso de Despachos.

Se corrigieron los cuatro errores registrados: las traducciones de calcular,
aprobar y optimizar rutas, y la carga del worker de MapLibre. Next prepara una
copia del worker y su licencia de la versión instalada; los mapas administrativo
y del chofer fijan esa URL propia. Se conserva OpenFreeMap/OpenStreetMap y la
geometría OSRM. El comando `npm run dev` inicia también el servidor local del
canal mediante `predev`; el comando manual sigue disponible.
El diagnóstico del servidor Next quedó sin errores de configuración ni de sesión.
Se verificó por HTTP local y HTTPS externo que el worker responde como JavaScript
y coincide exactamente con el instalado. La inspección visual del mapa en el
navegador y la medición física del GPS siguen siendo comprobaciones manuales.

## Uso y prueba física

1. Mantener PostgreSQL, Redis, Django administrativo en 8000 y Next en 3000
   disponibles. Desde la raíz ejecutar:

   ```powershell
   node infraestructura/supervision/iniciar_supervision.mjs
   node infraestructura/chofer_https/iniciar_tunel.mjs
   ```

2. En la computadora entrar como administrador a **Seguimiento de camiones** y
   elegir un viaje actual. El mapa se abre automáticamente y permite consultar
   los destinos incluso sin un recorrido calculado. También se puede entrar
   desde **Despachos → Abrir seguimiento**.
3. En el teléfono abrir la dirección HTTPS que muestra el segundo comando,
   entrar con el chofer asignado y abrir el mismo viaje en **Mis viajes**.
   Revisar/confirmar el recorrido e iniciar según el flujo habitual. Usar un viaje
   previsto para pruebas: iniciar y descargar sí son operaciones reales.
4. Abrir **Ubicación → Compartir mi ubicación** y aceptar el permiso. Mantener
   la página visible. Solo aparece el camión cuando llega una medición GPS válida.
   Comprobar en la computadora el mismo almacén, ruta, colores y sucursales,
   el camión, el área de precisión y la hora de la medición.
5. Moverse con el teléfono de forma segura. La captura web acepta mediciones
   nuevas como máximo cada **3 segundos**. El navegador, la precisión y la red
   pueden espaciar las actualizaciones; no es una promesa de latencia exacta.
   El servidor comunica cada dato guardado sin recargar la página administrativa.
6. Probar **Ver recorrido**, **Seguir al chofer**, arrastrar el mapa y ampliarlo.
   Arrastrar desactiva el seguimiento de cámara. Las actualizaciones no deben
   reiniciar el encuadre elegido ni alterar el recorrido confirmado.
7. Dejar de compartir o cambiar de pestaña en el teléfono. La captura se detiene
   antes de esperar la respuesta. El administrador ve el estado y la última
   ubicación conocida; si no hay datos nuevos en 15 segundos, se informa que la
   medición está desactualizada. Volver al teléfono no reactiva el GPS sin consentimiento.
8. Interrumpir y recuperar la red del administrador: comprobar reconexión y último
   dato persistido. Ocultar su pestaña cierra solo su canal. Cerrar sesión o retirar
   su permiso administrativo impide seguir recibiendo ubicaciones. Comprobar claro,
   oscuro, teclado y pantalla pequeña manualmente.

## Flujo implementado

```text
GPS consentido del navegador del chofer
  → POST HTTPS existente → Django → PostgreSQL
  → aviso después del commit → Redis → Channels/Daphne
  → WebSocket local de Next → mapa del administrador
```

La API conserva versión, UUID, autorización propia, idempotencia y auditoría de
las etapas anteriores. La frecuencia mínima entre lotes del servidor permanece
en 2 segundos y su límite en 30 puntos por minuto. La captura de 3 segundos
produce como máximo unas 20 muestras por minuto en condiciones normales. Al
vaciar pendientes, el adaptador web espera al menos 2,1 segundos tras el acuse
anterior. La cola incierta conserva el mismo cuerpo en memoria.

Channels 4.3.2, channels_redis 4.3.0 y Daphne 4.2.3 están fijados en
`Backend/requirements-supervision.txt`. Redis distribuye avisos pequeños sin
coordenadas. El consumidor consulta PostgreSQL tras cada aviso y controla sesión
y permisos también cada 10 segundos, aunque el GPS esté detenido. Un fallo al
publicar un aviso no revierte una descarga ni una ubicación ya confirmadas.
El cliente vuelve a obtener el último estado al reconectarse, con espera creciente
y cinco intentos automáticos. No consulta toda la ficha cada 3 segundos: solo
la actualiza si cambió la versión del negocio.

El acceso al canal se obtiene mediante `POST despachos/{id}/acceso-supervision/`,
con sesión Django y CSRF. El identificador opaco dura 30 segundos, sirve una sola
vez para ese viaje y se envía en el primer mensaje, nunca en URL ni almacenamiento
del navegador. Se liga en el servidor a la sesión web; origen, cuenta activa,
hash de autenticación y permiso `despachos.view_despacho` se revalidan. El canal
`/ws/seguimiento/{id}/` solo admite lectura, con auditoría central de apertura y cierre.
También existe `GET despachos/{id}/supervision/`, protegido y sin caché.

El mapa reutiliza React Leaflet/MapLibre, OpenFreeMap/OpenStreetMap, geometría OSRM
y SVG canónicos. Incluye avance por sucursal, próximo destino, precisión, hora,
estado del canal y de GPS, última posición, reconexión, centrado opcional y ampliación.
Los planes históricos conservan su geometría global. No se recalcula la ruta por
moverse el camión, ni se simula movimiento entre mediciones. GPS no confirma
llegadas, descargas ni finalizaciones y no modifica inventario ni cajillas.

Cloudflare conserva su lista restringida para el chofer. No se publican el canal
administrativo, la API de supervisión ni el control local. La compilación pública
no contiene la regla de proxy WebSocket. No se añade offline, GPS en segundo plano,
tráfico en vivo ni navegación giro a giro. Android conserva su frecuencia anterior.

## Comprobaciones técnicas

```powershell
cd Backend
.venv/Scripts/python.exe manage.py test --settings=config.pruebas_aisladas --keepdb --noinput
cd ..
Backend/.venv/Scripts/python.exe herramientas/comprobar_supervision_red.py
cd Frontend
node --test pruebas/*.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Pasaron 588 pruebas del backend, 192 pruebas web, 3 de pasarela y la prueba
adicional con PostgreSQL y Redis
reales entre dos procesos: la API web del chofer guarda una medición de prueba
y el consumidor ASGI la recibe. Esta comprobación usa exclusivamente la base
aislada y un prefijo Redis temporal, sin vaciar Redis compartido. También se
verificó la conexión WebSocket a través de Next local y el rechazo de acceso
inexistente. Las pruebas web cubren 3 segundos, atrasos, permiso, reconexión,
datos antiguos y conservación de almacén, sucursal, ruta y camión.
TypeScript, ESLint del alcance y compilación normal y pública de Next.js correctos;
sin migraciones nuevas pendientes ni conflictos entre dependencias Python.
La comprobación HTTPS externa validó el formulario y sus 19 recursos, cookie CSRF
segura y rechazo de POST sin CSRF. Las rutas de supervisión, WebSocket y control
local devolvieron 404 desde el túnel; la administración local siguió respondiendo.
Los avisos tienen un límite de espera de 1,5 segundos para que una caída de Redis
no deje bloqueada la respuesta posterior al commit.

Las comprobaciones automatizadas no sustituyen la prueba visual/física anterior.
No se realizaron operaciones de recorrido en la base habitual.

Referencias: [capas de canales y Redis](https://channels.readthedocs.io/en/stable/topics/channel_layers.html),
[validación de origen](https://channels.readthedocs.io/en/stable/topics/security.html) y
[acciones después del commit](https://docs.djangoproject.com/en/5.2/topics/db/transactions/#performing-actions-after-commit).
