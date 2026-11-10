# Despachos

## Chofer en la web

`POST /api/v1/chofer/acceso/` abre un acceso del navegador con sesión Django y
CSRF. `/api/v1/chofer/mis-viajes/` reutiliza los contratos y servicios de la API
móvil con alcance propio y páginas de diez; `vista=en_curso|historial` agrupa antes
de paginar. La sección `/mis-viajes` incorpora mapa amplio y acciones del chofer.
La administración conserva preparación, envío y consulta. No se entrega un Bearer
al JavaScript y las rutas móviles existentes siguen independientes. Cerrar la
sesión web revoca solo su acceso asociado. No hay migraciones nuevas.
Ver [adaptación web](../../documentacion/adaptacion_chofer_web.md).

## Optimización: etapa 6

El [seguimiento GPS de etapa 7](../../documentacion/etapa_siete_movil.md) añade
sesiones ligadas al acceso móvil, recepción idempotente de lotes/puntos y
consulta propia paginada. Solo captura autorizada en primer plano, sin cambiar
la ruta, versión del despacho, inventario ni cajillas. La migración 0007 crea
sus tablas; finalizar el viaje y revocar el acceso cierran sus seguimientos.

El chofer solicita `optimizar-ruta/` con versión y UUID; DEAP ordena todas las
paradas usando `OSRM Table` y `OSRM Route` devuelve el trazado final. La solicitud
se persiste, Celery/Redis ejecutan el trabajo en Docker y la confirmación del
chofer aplica el orden. `optimizacion.estado` informa progreso conservando los
estados de ruta anteriores. Cada tramo usa el color de su destino y geometría
exacta de pasos OSRM; los planes históricos conservan su evidencia.

Ver [informe de etapa 6](../../documentacion/etapa_seis_movil.md) y
[evaluación académica](../../investigacion/rutas/README.md). El cálculo no incluye
tráfico, descarga ni GPS, ni vuelve a mover productos o cajillas.

## Flujo vigente: asignación web y recorrido del chofer

La administración web alista carga confirmada, asigna vehículo, chofer y cajillas, envía y consulta el avance. El chofer ordena y opera el recorrido desde Mis viajes en el navegador o desde la app Android conservada. Ambos accesos usan los mismos servicios con alcance propio, permiso de operar, versión y UUID. El envío ya no fija planes nuevos: se fijan al iniciar el viaje. La confirmación aplica el orden sobre las paradas existentes sin recrear carga ni movimientos. Los planes históricos fijados se conservan. Despachos administrativo ofrece enviar y cancelar, sin acciones del recorrido; los endpoints administrativos anteriores permanecen por compatibilidad. Ver `documentacion/recorrido_chofer.md`.

## Descarga por pedido: etapa 3

El chofer usa `POST /api/v1/movil/mis-despachos/{id}/descargar-pedido/` con
`version`, `clave_operacion`, `parada`, `pedido` y `cargas_comprobadas` (todas
las filas transportadas de ese pedido, sin duplicados). Se valida alcance por
Usuario, permiso propio, llegada previa y siguiente parada dentro de la
transacción existente. La carga conserva fecha y responsable de descarga.

Los endpoints `pedidos/` y `productos-pedido/` están disponibles tanto bajo
`movil/mis-despachos/{id}/` como bajo `despachos/{id}/` para el seguimiento web,
con filtros de parada/pedido y páginas de diez mediante `pagina`.
El último pedido completa la parada y entrega sus cajillas por color una sola
vez. Se conserva el endpoint administrativo anterior; el móvil anterior exige
usar la confirmación por pedido si quedan varios pendientes. No se modifica
inventario de productos ni se declara entregado todo el pedido comercial.

La migración 0003 conserva la fecha conocida de las descargas anteriores y deja
su responsable por pedido vacío. La web identifica estos casos como registros
anteriores por sucursal. Ver `documentacion/etapa_tres_movil.md`.

## Envío al chofer y API móvil: etapa 2

`POST /api/v1/despachos/{id}/enviar/` exige `enviar_despacho`, versión y UUID de
operación. Valida capacidad y carga preparada; registra fecha, actor y versiones
en la auditoría. El envío no inicia el recorrido ni mueve existencias. El borrador
enviado se presenta como «Pendiente de salida» y conserva la carga/transporte.

`/api/v1/movil/mis-despachos/` expone solo viajes enviados al Usuario autenticado
y sus viajes anteriores ya iniciados/finalizados. Sus acciones reutilizan el
servicio con alcance de chofer, permiso propio y comprobación del destinatario
dentro de la transacción. No conceden administración global. La descarga sigue
siendo por parada hasta la etapa 3.

El acceso móvil por dispositivo está en `usuarios/autenticacion_movil.py` y
`usuarios/vistas_moviles.py`. Aplicar migraciones y `preparar_acceso_movil` agrega
los permisos a los roles operativos existentes con auditoría, sin asignar usuarios.
Ver `documentacion/etapa_dos_movil.md` para credenciales, rutas y despliegue HTTPS.

Pantallas `/despachos`, `/despachos/nuevo`, `/despachos/{id}` y
`/despachos/{id}/editar`. La hoja usa tres pasos:

1. **Carga:** almacén y fecha de reparto, seguidos de carga agrupada por cliente
   y sucursal. La fecha requerida del pedido es un filtro independiente y opcional.
   Marcar una sucursal reúne todas sus páginas; **Ver productos** permite ajustar
   asignaciones completas.
2. **Transporte:** vehículo, usuario chofer y cajillas por destino; el chofer prepara el orden desde la app.
3. **Revisión:** guarda primero el borrador y usa la versión devuelta para enviar.

Los pasos y su contenido comparten una sola tarjeta, sin repetir el título de
la etapa. La etapa activa usa un fondo suave naranja en Carga, azul en Transporte
y verde en Revisión, sin subrayado. Las etapas anteriores conservan una marca
de avance y las futuras mantienen las mismas reglas de navegación. La cabecera
reúne volver y el título, sin migas ni explicación repetidas. El resumen de
destinos, cantidades, peso y cajillas se muestra una sola vez en el pie; capacidad
y contexto de transporte permanecen en sus etapas. Se conservan teclado, foco,
contraste, modo oscuro y reducción de movimiento.

La selección se conserva entre pasos, filtros y páginas. No se aplica una selección
parcial si falla una página o cambia la disponibilidad. La consulta por sucursal
devuelve una versión del conjunto completo de asignaciones; el frontend compara
conteo y versión en cada página y puede cancelar la consulta sin cambiar la carga.
Guardar vuelve a validar la disponibilidad en la transacción existente.

La carga de cada sucursal se muestra en una fila blanca compacta, con cliente,
sucursal, número de pedidos, productos, cajas/unidades y peso.
La selección completa cambia el fondo de toda la fila a verde suave; la parcial
usa un tono más tenue y conserva la casilla intermedia, sin borde lateral verde.
«Ver pedidos» despliega códigos, fechas requeridas y selección por pedido; la dirección queda
en ese detalle. Plegar conserva la carga elegida y retira la consulta del detalle.
Se puede incluir la carga
disponible de un pedido o de toda la sucursal. Ver productos permite ajustar las
asignaciones de ese pedido conservando los lotes de cada cantidad preparada.
Pedidos para filtra por la fecha requerida; sin fecha consulta todas las fechas.
No se repite el filtro en una explicación adicional. Filtrar no modifica
selecciones: una advertencia permite volver
a ver toda la carga elegida si incluye pedidos de otras fechas. La fecha elegida
se conserva al cambiar de paso; es independiente de la fecha de reparto.
Las respuestas anteriores se ocultan al cambiar filtros o páginas.

Los borradores conservan el contrato obligatorio de almacén, fecha, vehículo y
chofer. Guardar borrador se muestra cuando el transporte es válido; su servicio
y validaciones se conservan. Crear, editar e
iniciar conservan permisos separados. El resumen compacto presenta solo datos y
cantidades elegidos, sin un panel lateral vacío; la capacidad se muestra en t.
Almacén, vehículo y chofer usan desplegables anclados sin búsqueda ni modal,
con páginas de 10, teclado y animación breve. Los pasos y listas respetan movimiento
reducido. El aviso de inventario aparece en Revisión y volver al listado protege
los cambios sin guardar.

La entrada principal es el listado **En curso / Historial**. Los estados vacíos son
compactos y no repiten Nuevo despacho cuando ya existe historial. El detalle
conserva la carga histórica, los lotes, la ruta y las operaciones autorizadas.
La aplicación del chofer utiliza las operaciones existentes; la etapa 7 incorpora GPS autorizado en primer plano. Segundo plano y supervisión web siguen en etapas posteriores.
No se incorporan incidencias ni retornos de carga nuevos.

La carga procede de asignaciones confirmadas de Preparaciones, incluidas
preparaciones parciales. Cada asignación viaja completa con todos sus aportes
de lotes. Se conservan pedido, preparación, producto, presentación, CANT/UNI,
cantidades físicas, unidad, peso y lotes. No se vuelve a mover inventario de
productos. Toda la carga pertenece a un almacén y cada sucursal forma una parada
con orden manual y dirección histórica.

Una asignación solo puede estar en un despacho activo, incluso en borrador.
Cancelar libera la carga y conserva el historial; finalizar mantiene la carga
utilizada. Los borradores no reservan cajillas ni productos. Las cajillas previstas
se incorporan automáticamente desde Preparaciones al elegir la carga. Se agrupan
por sucursal/color y cada previsión de preparación/producto/destino/color se suma
una sola vez, aunque figure en varios pedidos o páginas. Los planes históricos sin
producto también se conservan sin duplicarlos. No se convierten CANT/UNI en cajillas.

Transporte y Revisión reúnen destino, carga y cajillas previstas en filas de tres
columnas cuando hay ancho, y etiquetas apiladas en móvil. La dirección queda como
dato secundario; no se repite un título de cajillas por destino en escritorio.
Cada color conserva su nombre y un punto reconocible junto a la cantidad.
Indicaciones no se muestra ni se captura en las pantallas de Despachos. El campo
legado y los textos históricos se conservan exactamente al guardar, sin cambios
en la API. El pie distingue Salir al listado, con descarte protegido,
de Anterior al paso previo. La capacidad declarada sigue mostrándose en toneladas.

El wizard usa iconos por paso y muestra las cajillas como fichas compactas. «Ajustar cajillas»
habilita cambios manuales; «Usar previstas» restaura las cantidades automáticas de
la carga elegida. Los ajustes, incluida una lista manual vacía, persisten al reabrir.
El campo opcional `cajillas_automaticas` conserva ese modo; los clientes anteriores
que lo omiten mantienen el contrato manual. El guardado automático compara la
matriz visible con la previsión del backend y rechaza diferencias con 409.

La migración 0005 añade ese campo nullable sin cambiar cantidades anteriores. Solo
los borradores antiguos sin enviar y sin cajillas recuperan la previsión como valor
inicial. El detalle conserva `cajillas` como filas persistidas y añade
`cajillas_sugeridas`; consultar no escribe datos de negocio. El envío materializa
la selección automática en la misma transacción auditada y la congela, sin mover
existencias. Los viajes ya enviados, iniciados o históricos conservan sus datos.

Estados: `borrador`, `en_ruta`, `finalizado` y `cancelado`. Iniciar revalida carga,
chofer autorizado, vehículo, almacén y destinos activos. Vehículo y chofer solo
pueden tener un viaje en ruta. El chofer es un Usuario con `conducir_despacho`.
La fecha de reparto es planificada; salida y retorno son automáticos. Se registra
llegada antes de descarga, respetando el orden de paradas. La interfaz pide
comprobar cada producto descargado. Finalizar exige completar todas las paradas;
la posterior aceptación de pesos corresponde a Entregas.

Iniciar registra cajillas de tipo `carga`: almacén → tránsito. Descargar crea
`entrega`: tránsito → pendiente de sucursal. El total se conserva como almacenes
más tránsito y sucursales. Los movimientos enlazan el despacho y se auditan.
Las salidas y devoluciones manuales anteriores siguen disponibles. Las cajillas
entregadas se devuelven cuando llegan físicamente al almacén mediante el servicio
existente. No se incluyen recogidas en vehículo ni retornos de carga no descargada;
el cierre normal exige completar el recorrido.

| Ruta relativa a `/api/v1/despachos/` | Operación |
| --- | --- |
| raíz | GET historial; POST crear borrador |
| `{id}/` | GET documento; PATCH reemplazar borrador con versión |
| `resumen/` | Contadores por estado |
| `almacenes/`, `vehiculos/`, `choferes/`, `cajillas/` | Selectores operativos |
| `disponibles/` | Carga confirmada por almacén, fecha requerida y búsqueda |
| `{id}/iniciar/`, `{id}/cancelar/` | Operaciones del borrador |
| `{id}/llegar/`, `{id}/descargar/` | Avance por parada del mismo viaje |
| `{id}/finalizar/` | Cerrar un viaje con todas las descargas |

Listados y selectores usan `pagina` fija de 10. El listado admite `buscar`,
`estado`, `fecha` de reparto y `vista=activos|historial`. La vista En curso incluye
borradores y viajes en ruta de cualquier fecha y prioriza los que están en ruta;
Historial incluye finalizados y cancelados. La agrupación se aplica antes de
paginar. Sin `vista`, la API conserva el listado completo y su orden anterior.
`resumen/` mantiene contadores por búsqueda y fecha, sin limitarse a una vista o
estado, y añade `hay_carga_disponible`. La lista expone `siguiente_destino` con el
cliente y sucursal históricos de la primera parada no descargada, o `null` cuando
el recorrido termina o se cancela. Son consultas de lectura y no cambian saldos.
Disponibles exige `almacen`, admite `sucursal` y `pedido` para consultar o
seleccionar su carga completa entre p?ginas con `version_carga`, y admite `despacho`
para incluir las asignaciones del propio borrador durante la edición. El documento
completo no es un listado; la interfaz pagina sus secciones por separado.

La pantalla principal usa En curso/Historial con contadores compactos, filtros
visibles y acciones según estado y permisos. Distingue primera creación, falta
de carga, filtros sin coincidencias y ausencia de viajes en cada vista. No muestra
paginación sin filas. Las respuestas de filtros anteriores se descartan y las
entradas visuales respetan movimiento reducido.

Crear recibe `almacen`, `vehiculo`, `chofer`, `fecha_reparto`, `observaciones`,
`asignaciones`, `orden_sucursales`, `cajillas` y `clave_operacion` UUID. Cada cajilla
contiene `sucursal`, `cajilla` y `cantidad` entera positiva. Editar usa el mismo
documento con `version`. Las acciones reciben `version` y `clave_operacion`;
llegar/descargar añaden `parada`.

Ver, crear, editar, iniciar, registrar recorrido, finalizar y cancelar son permisos
independientes, comprobados también fuera de HTTP. Los selectores exponen datos
operativos con permiso de Despachos, sin exigir administrar los catálogos.
`preparar_roles` crea Administrador de despachos y Chofer de despachos si faltan,
sin cambiar roles previos ni asignar usuarios. El rol de chofer habilita su
asignación; no concede acceso al panel administrativo de viajes.

Las operaciones y la auditoría son atómicas, con versión e idempotencia. Una clave
repetida válida devuelve el resultado previo; reutilizarla para otros datos,
acciones o cuentas genera conflicto. Las restricciones de PostgreSQL protegen
carga y transporte. Los bloqueos de chofer/vehículo permiten referencias FK de
auditoría; clientes/sucursales preceden a colores y almacén, igual que en Cajillas.
Las pruebas cubren concurrencia real y reversión ante fallos de auditoría.

## Capacidad y ubicaciones: etapa 1

La interfaz presenta una barra de ocupación por peso que se recalcula al cambiar
el vehículo o la carga: capacidad en t, peso en kg, porcentaje y disponibilidad
o exceso. Sus colores son verde, naranja desde el 80 % y rojo al superar el
límite. El umbral naranja es solo informativo y no modifica autorización,
validación ni capacidad declarada. El cálculo visual conserva decimales exactos
y redondea únicamente el porcentaje a dos decimales; muestra «Menos del» o «Más
del» cuando ese redondeo ocultaría una carga mínima o cruzaría el 100 %.
Un exceso de un gramo sigue visible como kg excedidos. Sin capacidad o pesos
completos se muestra la causa y no un porcentaje supuesto. La barra limita su
longitud visual al 100 %, pero conserva el exceso real en texto y accesibilidad.
No se introducen reservas, conversiones de cajas/unidades, movimientos ni
cambios del contrato `comprobacion_capacidad` por consultar este indicador.

`capacidad.py` compara con Decimal la capacidad actual del vehículo y el peso
real medido de todos los aportes de la carga, sin convertir CANT/UNI ni limitarse
a una página. Los pesos ausentes o inconsistentes no cuentan como cero.
`iniciar_viaje` aplica la validación con el vehículo bloqueado antes de generar
movimientos. Capacidad ausente o insuficiente y peso incompleto bloquean la
salida; guardar el borrador sigue permitido. La futura publicación debe
reutilizar esta comprobación. Los reintentos confirmados conservan idempotencia.

El detalle añade `vehiculo_capacidad_kg` y `comprobacion_capacidad`, de solo
lectura y consultables con el permiso de Despachos. La comprobación usa la
capacidad actual; no representa una capacidad histórica congelada. La interfaz
mantiene toneladas y muestra el motivo de bloqueo. Las ubicaciones pendientes
se identifican en Almacenes y Sucursales sin impedir el despacho manual actual.
No hay migraciones nuevas. Ver `documentacion/etapa_uno_movil.md` para los datos
reales que debe completar el usuario antes de calcular rutas.
