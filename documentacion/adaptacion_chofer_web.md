# Recorrido del chofer en la web

**Guía dinámica, 9 de noviembre:** el camino pendiente acompaña al GPS real y
puede recalcularse hasta el siguiente destino sin cambiar el plan aprobado.
Detalle y comprobación física en [Guía dinámica del chofer](guia_dinamica_chofer.md).

**Caminos alternativos, 4 de noviembre:** antes de iniciar un viaje enviado, el
chofer puede comparar caminos por tramo, ver las opciones reales de OSRM sobre
el mapa principal y elegir una. La elección conserva el orden de sucursales y
crea una propuesta que requiere **Usar recorrido**. Incluye el regreso al almacén;
no incorpora tráfico en vivo. Ver [uso y controles](alternativas_recorrido_web.md).

**Mapa y revisión de descarga, 4 de noviembre:** durante el viaje, el mapa conserva
los iconos y colores de todas las sucursales. Al completar todos los pedidos de
una sucursal, su icono muestra una marca de entregada y se oculta solo su tramo.
Llegada y descarga parcial mantienen el tramo visible. La siguiente sucursal se
destaca; después de la última descarga queda únicamente la línea real del regreso
al almacén, junto con los iconos de las sucursales entregadas. El encuadre conserva
esos iconos como referencia. El regreso ya formaba parte del plan. El botón **Ver recorrido completo**
(icono de recorrido, junto a los controles del mapa) permite recuperar la vista
íntegra. El historial conserva todo. Los planes antiguos sin geometría por tramo
mantienen su línea completa; no se inventan trazados ni se cambia el plan guardado.

La revisión de cada pedido muestra la foto actual del catálogo, cantidad y peso
compactos y los colores/cantidades de cajillas previstas en Preparación. Esta
previsión se comparte entre los pedidos del mismo producto, preparación y sucursal;
no se presenta como reparto físico por pedido ni cambia las cajillas del despacho.
Las previsiones históricas sin producto no se atribuyen a uno supuesto. Si no hay
foto se conserva el icono de respaldo. **Ver trazabilidad** despliega preparación
y lotes, evitando repetir cantidades y pesos iguales. La revisión sigue exigiendo
comprobar todas las filas entre páginas de diez antes de confirmar.

La imagen se sirve por `GET /api/v1/chofer/mis-viajes/{viaje}/imagenes/{producto}/`,
con sesión y acceso vigente del chofer, permiso de consulta y pertenencia del
producto a la carga de ese viaje. No exige administrar el catálogo ni publica
archivos multimedia generales. Las consultas y las fotos no generan movimientos.

Comprobación técnica: 604 pruebas de backend, 206 web y cinco de pasarela
correctas; TypeScript, ESLint y compilación pública de producción correctos. Se
verifican llegada, descarga parcial/completa, regreso, consulta íntegra, geometría
histórica, privacidad de fotos y previsiones sin producto. La comprobación HTTP
con Next de producción conserva la navegación sin redirecciones adicionales. No
se cambiaron operaciones ni se descargaron pedidos en la base habitual durante
las pruebas. La revisión visual del cambio en el teléfono sigue siendo manual.

Para probar en el teléfono: abrir un viaje, registrar llegada y verificar que el
destino permanece; descargar uno de varios pedidos y comprobar lo mismo. Al
completar la sucursal debe desaparecer solo su tramo, conservarse su icono y color
con marca de entregada y destacarse la siguiente. Tras la última descarga debe
quedar solo la línea de regreso, con todos los iconos visibles; abrir **Ver
recorrido completo** debe recuperar todos los tramos. En la revisión comprobar fotos,
cajillas, trazabilidad y que no se pueda confirmar con filas sin revisar. Estas
acciones sí operan sobre el viaje: usar datos destinados a una prueba física.

**Navegación adaptable, 4 de noviembre:** el listado de Mis viajes utiliza el
sidebar y la barra superior del sistema. En el celular muestra menú lateral,
marca y opciones de cuenta/tema; en escritorio aprovecha el ancho disponible.
El cierre de sesión conserva la parada local inmediata del GPS. Al abrir un viaje,
el mapa mantiene su pantalla completa. El proveedor del chofer sigue siendo el
mismo entre listado y mapa; los permisos y las operaciones no cambian.
Pasaron 194 pruebas web, TypeScript, ESLint del cambio y compilación de Next.
La comprobación visual en el teléfono se mantiene manual.

**Etapa 9, 4 de noviembre:** la [supervisión del administrador](etapa_nueve_web.md)
ya recibe GPS por WebSocket local. La captura web acepta mediciones nuevas cada
3 segundos, según disponibilidad del navegador y de la red. Se conservan el
almacén, las sucursales, la ruta y sus iconos; la prueba física sigue pendiente.

**Arranque GPS, 5 de noviembre:** se reutiliza la primera medición real obtenida
al solicitar permiso, en lugar de descartarla y esperar una segunda del navegador.
Solo se presenta y envía después de autorizar el seguimiento, revalidando
coordenadas, antigüedad de hasta 30 segundos y precisión de hasta 100 metros.
El observador se mantiene activo antes de enviar ese punto; las capturas siguientes
conservan el intervalo mínimo de 3 segundos. La espera HTTP de 2,1 segundos entre
lotes corresponde a la misma sesión y no demora el primer lote de otra sesión.
Detener, ocultar la pestaña o cambiar de cuenta descarta la lectura inicial pendiente.
Los lotes inciertos mantienen su UUID y cuerpo al reintentar. El mapa informa
«Buscando ubicación…» mientras espera una medición válida y no dibuja posiciones
supuestas. La supervisión recibe el primer punto mediante el canal existente;
no cambian rutas, descargas, inventario ni cajillas. La adquisición del GPS y la
red siguen determinando la demora real, que requiere comprobación en el teléfono.

**Actualización del 4 de noviembre:** se preparó un acceso HTTPS temporal con
Cloudflare, separado de la administración local. Se inicia y detiene con los
[comandos del túnel del chofer](../infraestructura/chofer_https/README.md).
El enlace vigente está en `.local/chofer_https/enlace.txt`. No requiere Metro ni
estar en la misma red; la computadora y los servicios deben permanecer encendidos.

3 de noviembre de 2026. Adaptación local de las etapas 1 a 6 y del GPS consentido
en primer plano de la etapa 7. Android se conserva mientras se valida esta alternativa
en el teléfono; no se eliminó `Movil/` ni se cambiaron sus contratos.

## Uso

1. Iniciar sesión en la web con el Usuario autorizado como chofer. Una cuenta
   limitada entra en **Mis viajes** (`/mis-viajes`). Las cuentas con otros permisos
   también disponen del acceso en el menú, si tienen los permisos del chofer.
2. Elegir **En curso** o **Historial**. Los viajes propios y los estados se filtran
   en Django antes de paginar de diez en diez. Volver desde el mapa conserva la vista
   y la página mientras se mantiene abierta esta sección.
3. Abrir el viaje. El mapa ocupa el alto disponible del navegador, sin sidebar ni
   cabecera administrativa. La tarjeta inferior se puede contraer. Los botones
   permiten encuadrar el recorrido, centrar/seguir la medición real, cambiar el tema,
   solicitar pantalla completa y mantener la pantalla encendida cuando el navegador
   lo permite. Los modales siguen visibles en pantalla completa.
4. En **Ver viaje → Recorrido**, ordenar todas las paradas, incluso entre páginas;
   calcular ese orden u optimizar con DEAP. Revisar el resultado y elegir **Usar
   recorrido**. Calcular no aplica la propuesta; confirmar conserva los IDs de
   paradas y carga. Un cálculo activo bloquea la salida y permite cancelarlo.
5. **Iniciar viaje** confirma la salida real. Los planes pendientes u obsoletos
   requieren revisión. Cuando no existe plan, se conserva la alternativa manual
   con confirmación explícita y el orden operativo guardado.
6. Registrar la llegada; **Ver pedidos** abre la siguiente parada. Revisar cada
   pedido y marcar sus filas en todas las páginas antes de confirmar su descarga.
   Las cajillas se entregan una sola vez al completar la parada. No se vuelve a
   descontar inventario ni se cambia el estado global del pedido.
7. Tras completar las paradas, regresar al mismo almacén y finalizar.

## Ubicación y conexión

**Ubicación → Compartir mi ubicación** solicita permiso por separado de iniciar el
viaje. Solo se ofrece en viajes propios en ruta y con permiso de operar. El camión
y su círculo de precisión aparecen con una medición real válida; las mediciones
antiguas dejan de presentarse como posición actual. La captura se retira localmente
antes de esperar a la red al detener, ocultar la pestaña, intentar finalizar o salir.
Volver a la pestaña no vuelve a compartir automáticamente. Cambiar de cuenta o
cerrar sesión en otra pestaña retira también el estado local.

En el teléfono, GPS requiere **HTTPS y un certificado aceptado por el navegador**.
Una dirección `http://192.168...:3000` sirve para comprobar mapa y operaciones
manuales en desarrollo, pero no habilita la ubicación del navegador. `localhost`
en el teléfono sigue siendo el propio teléfono. No se configuró un despliegue
público ni certificados como parte de la adaptación inicial. La actualización
HTTPS del 4 de noviembre añade el túnel temporal documentado arriba.

El origen exacto usado desde el teléfono debe estar autorizado en la configuración
existente `CSRF_TRUSTED_ORIGINS` de Django, y su host en `ALLOWED_HOSTS` según el
proxy/despliegue. No se desactiva CSRF para permitir la prueba. Se mantiene
`DJANGO_API_URL` en Next.js apuntando al backend; el teléfono entra a Next.js y las
consultas pasan por el proxy `/api/v1/` existente.

El recorrido es un visor con ubicación; no incorpora guía por voz ni instrucciones
giro a giro. No hay GPS en segundo plano, cola persistente offline, mapas descargados
ni supervisión web en vivo nueva. Las operaciones inciertas retienen UUID y cuerpo
en memoria y ofrecen **Comprobar resultado**, bloqueando otras escrituras del viaje.
Cerrar o recargar el navegador puede perder ese estado en memoria. La protección
de salida avisa cuando existen operaciones pendientes o un orden local sin guardar.

## Arquitectura y compatibilidad

- React Leaflet/Leaflet y MapLibre GL muestran OpenFreeMap con datos de
  OpenStreetMap. Se conservan SVG canónicos, colores por sucursal, tramos reales de
  OSRM y línea global para planes históricos sin desglose.
- Django, PostgreSQL, OSRM y Celery/Redis/DEAP mantienen los servicios de negocio.
  La interfaz administrativa continúa preparando, enviando y consultando; las
  operaciones del chofer están en su sección propia.
- `POST /api/v1/chofer/acceso/` abre un acceso de navegador asociado a la sesión
  Django, con CSRF. Reutiliza internamente `SesionMovil` para mantener los controles
  existentes del GPS, con un dispositivo propio del navegador y vencimiento de
  doce horas. No entrega Bearer al JavaScript ni guarda credenciales en localStorage.
- `/api/v1/chofer/mis-viajes/` reutiliza los contratos y servicios de la API móvil,
  con autenticación de sesión y CSRF. `vista=en_curso|historial` solo agrupa el listado.
  Las rutas Bearer originales siguen independientes. Cerrar la sesión web revoca
  únicamente su acceso del chofer y cierra su seguimiento.
- Los módulos puros del cliente se adaptaron bajo `Frontend/src/lib/chofer`; la
  presentación usa componentes web. La captura utiliza `navigator.geolocation`.
  No se instalaron dependencias ni se requieren migraciones nuevas.

## Validación y retiro de Android

Las comprobaciones automatizadas usan PostgreSQL aislado y datos de prueba. Cubren
CSRF, permisos separados, viajes ajenos, paginación, rutas, conservación de carga,
descarga por pedido, reintentos, cierre de acceso/GPS y compatibilidad Bearer.
Las pruebas web cubren revisión entre páginas, solicitudes inciertas, respuestas
tardías, permisos/GPS del navegador, cartografía histórica y traducciones.

El menú móvil y los diálogos del recorrido comparten el bloqueo del desplazamiento.
Cerrar o desmontar varios paneles en cualquier orden restaura el estado original
cuando cierra el último, evitando que el historial de Mis viajes quede inmóvil.
Las pruebas cubren menú y diálogo superpuestos, panel con confirmación, reapertura
y limpieza repetida, además de conservar el foco y el bloqueo del fondo mientras
un diálogo sigue abierto.

Resultado: 570 pruebas del backend y 177 pruebas web correctas, TypeScript y
ESLint del alcance modificado correctos, compilación Next.js correcta y ninguna
migración nueva pendiente. No se ejecutaron operaciones de negocio en la base habitual.

La prueba visual y física en Android permanece manual, según las convenciones del
repositorio. Antes de retirar la app, verificar con el navegador y el entorno HTTPS
elegidos: sesión del chofer, mapa claro/oscuro, permiso y precisión real, seguimiento
de cámara, cambio de pestaña, pantalla completa, cálculo/confirmación y un reparto
completo. El retiro de `Movil/` queda pendiente de esa validación y de la decisión
del usuario.
