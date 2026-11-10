# Preparación de pedidos

La pantalla `/preparaciones` inicia en un listado con **una fila por cliente y
fecha requerida**, que reúne todos los pedidos de sus sucursales y todas las
preparaciones de esa jornada, incluso si se trabajó en varias tandas o almacenes.
La fecha filtra qué pedidos se atenderán; la fecha de creación y el responsable
de la preparación son automáticos.

`GET /api/v1/preparaciones/jornadas/` agrupa en el servidor antes de paginar de
10 en 10. Admite `buscar` por cliente, `cliente`, `fecha_pedidos` y `estado`
(`pendiente`, `parcial`, `preparado`, `sin_pedidos`). Cuenta pedidos activos,
sucursales y productos distintos. El avance se calcula con asignaciones
confirmadas y pendientes por detalle; CANT/UNI permanecen independientes. Un
borrador o una cancelación no aumenta el avance. Incluye grupos históricos sin
pedidos activos como consulta, sin presentarlos como preparados. El endpoint
original de preparaciones conserva su contrato y muestra las operaciones dentro
del grupo, con su almacén, responsable, versión y permisos.

La acción «Preparar pedidos» abre la elección de jornada, inicialmente hoy.
Cada fila ofrece Preparar, Continuar o Ver grupo según estado y permisos. Con
varios borradores se abre el grupo para elegir; nunca se selecciona uno de forma
arbitraria. «Ver grupo» reúne sus borradores, confirmaciones y cancelaciones; una
nueva tanda mantiene ese cliente y fecha. Los enlaces anteriores con cliente y
fecha abren ahora este grupo. Después de confirmar se vuelve al listado y se
renueva el avance; salir con cambios exige descartarlos y se bloquea durante el
guardado. El listado conserva sus filtros al abrir y volver de la jornada
integrada, cancela respuestas anteriores y respeta movimiento reducido.

## Hoja y flujo de trabajo

La hoja presenta productos por filas, sucursales por columnas y totales del
cliente. **CANT (cajas) y UNI (unidades) permanecen independientes**. Los
totales incluyen todas las sucursales, aunque algunas estén en otra página.
Se puede consultar lo solicitado originalmente o lo pendiente, buscar productos
y filtrar por las categorías reales del catálogo. Productos y sucursales se
paginan por separado, siempre de 10 en 10.

La vista «Preparar pedidos» muestra los productos de la jornada al elegir cliente y día.
Fecha requerida, cliente y almacén comparten una cabecera compacta; pedidos,
sucursales y productos se resumen en una línea. No se limita la captura al filtro
de categoría del consolidado. Si solo existe un almacén activo, se selecciona
automáticamente. La hoja mantiene una lista con foto,
solicitado CANT/UNI, pendiente y la acción «Preparar» o «Continuar».
La lista inicia con todos los productos y ofrece el filtro «Solo pendientes»,
además de búsqueda y categoría. No muestra pestañas ni estados de guardado por
producto: un único indicador general junto a las acciones de guardado del pie
distingue guardado, cambios sin guardar, guardando y conflicto. Al abrir el
panel, el estado se mantiene en su pie, sin una fila flotante sobre la lista.
El código acompaña al título de edición, o al contexto de la hoja integrada.
Guardar un borrador
mantiene las cantidades pendientes hasta la confirmación.
La paginación sigue siendo de diez productos y sus controles aparecen solo
cuando hay más de una página. El resumen de cajillas cerrado ocupa una línea
y muestra la suma prevista de cajillas, en lugar de contar filas de colores.
«Preparar» abre el producto en un panel lateral derecho y mantiene la lista
visible. En móvil el panel ocupa el ancho disponible. Los lotes y cajillas se
presentan en columnas cuando hay espacio, con cantidades y saldos compactos.

El panel muestra un selector de sucursales y una sola ficha activa. Cada ficha
conserva sus filas de pedidos, CANT/UNI y aportes de lotes separados, y un único
editor de cajillas para ese producto y destino, compartido entre sus pedidos.
«Siguiente sucursal» y «Sucursal anterior» cambian de destino sin guardar ni
confirmar. Se conservan también la cantidad manual de nuevas cajillas y la
elección de agregar otro color mientras se navega entre sucursales del producto.
«Ver anotados» permite consultar y corregir destinos que ya no aparecen entre
los pendientes; sus etiquetas describen el borrador, no una confirmación.

`GET /api/v1/preparaciones/sucursales-producto/` exige cliente, fecha y producto,
agrupa sucursales antes de paginar de diez y conserva nombres históricos. Un
destino no se repite por tener varios pedidos o líneas CANT/UNI. La consulta de
`necesidades/` admite `sucursal` y la filtra antes de paginar sus diez filas; las
consultas anteriores sin ese filtro conservan su respuesta. El selector y los
pedidos tienen paginaciones independientes. Ambas lecturas conservan permisos
y auditoría HTTP de Preparaciones; no escriben cantidades ni movimientos.

Las cantidades, mediciones y planes por color siguen en el documento completo.
«Guardar producto» guarda el mismo borrador completo y cierra solo tras el éxito;
no guarda únicamente la sucursal visible. Los errores revelan la sucursal y la
página de sus filas o cajillas. Las consultas cancelan y descartan respuestas
tardías de otro destino. La revisión y confirmación conservan sus reglas.

La revisión agrupa primero las sucursales y luego sus productos, en páginas de
diez por nivel. Cada producto reúne cantidades de la misma columna y presentación;
CANT, UNI y presentaciones diferentes permanecen separadas. El peso real suma
exactamente los aportes en kg y las mediciones de peso de las otras unidades;
si falta una medición o su lote, muestra peso pendiente sin inventar un total.
Las cajillas aparecen una sola vez por producto/destino, aunque existan varios
pedidos. Los planes históricos sin producto se muestran aparte en su sucursal.
«Ver trazabilidad» conserva códigos de pedido, cantidades y aportes de cada lote,
con diez asignaciones por página. La consulta del consumo del almacén conserva
total usado, asignado, descarte, aprovechable y motivo; se abre inicialmente cuando
hay separación por calidad. Los controles de paginación aparecen solo si hacen
falta. La cabecera y el pie de confirmación quedan fijos dentro del diálogo, con
resumen del documento completo, foco en errores y regreso a la preparación.
Estos agrupamientos son de consulta: no cambian el documento, su versión, la
clave de operación, la confirmación ni los movimientos o previsiones.

No se rellenan cantidades atendidas, mediciones ni lotes. El consolidado y su impresión se
consultan con «Ver resumen de pedidos» sin cerrar ni reemplazar la captura.

Si una medición supera el saldo del lote, el panel indica cuánto hay disponible
para esa asignación y cuánto falta. La disponibilidad descuenta las otras
sucursales, descarte y aprovechable del documento. Para kg, «Completar con otro
lote» abre una revisión: propone usar lo disponible del origen y permite elegir
otros lotes del mismo producto, unidad y almacén hasta completar la cantidad.
El selector de lotes filtra `unidad` antes de paginar de diez y conserva la
consulta POST de consumos y exclusiones; las consultas sin filtro mantienen su
contrato. Los productos, unidades habilitadas y saldos se revalidan en los
servicios existentes al guardar o confirmar según la operación.

La revisión no modifica el documento hasta «Aplicar reparto» y se puede cancelar.
Admite varios lotes y decimales exactos de hasta tres posiciones, sin convertir
cajas en kg. Solo reparte la cantidad del aporte elegido; conserva los otros
aportes, sucursales, CANT/UNI, separaciones y cajillas. Si cambian las cantidades,
el contexto o el almacén durante la revisión, obliga a revisar otra vez. Los
límites de veinte aportes y quinientas líneas permanecen. Si el origen queda
sin aporte, se retira únicamente cuando no lo utiliza otra asignación ni conserva
separación por calidad. El total anotado en kg se muestra por unidad, sin sumar
unidades distintas ni inferir pesos de otras mediciones.

Esta distribución es una ayuda de captura solicitada y confirmada por el usuario,
sin reservas ni movimientos. El guardado y la confirmación siguen usando versión,
UUID, autorización, auditoría y control de saldos de Preparaciones. Para otras
unidades se mantiene el aviso y la distribución manual, con sus pesos medidos.

1. Elegir un producto por su foto y nombre, con búsqueda y filtro de categoría.
2. Anotar «Preparar ahora» por sucursal. Debajo de sus cantidades aparecen los
   lotes utilizados como filas compactas, con saldo, vencimiento conocido y
   medición física en su unidad; admite varios lotes por cantidad atendida.
   El primer lote se elige explícitamente con «Elegir lote»; después el mismo
   botón pasa a «Agregar lote adicional». Se muestran solo lotes con saldo libre
   tras restar todo lo anotado en la hoja, incluidas otras sucursales, descarte y
   otro uso. Los lotes ya elegidos permanecen visibles aunque su saldo llegue a
   cero; se excluyen del selector de esa asignación para evitar duplicados.
3. Si corresponde, elegir el color de las cajillas. La cantidad sugerida toma
   las cajas anotadas para preparar en ese producto/sucursal y resta cajillas ya
   anotadas. Es editable y no incorpora UNI ni mediciones físicas. Elegir el color
   anota la previsión directamente; «Otro color» permite repartirla. CANT y UNI
   del mismo producto/destino comparten una sola previsión, sin equivalencias.
   La separación por calidad sigue disponible por lote.
4. «Revisar preparación» guarda primero el borrador y abre el resumen con fotos.
   La confirmación expresa se realiza desde la misma hoja, usando la versión
   devuelta por el servidor y una clave idempotente.

La lista de productos y cada sección usan páginas de 10, conservando lo anotado
al cambiar de producto o página. «Pendientes», «Todos» y «Anotados» permiten
consultar el origen sin modificar el documento. Cerrar el panel conserva
filtros, página y documento; «Anterior» y «Siguiente» recorren los productos,
también entre páginas de 10, sin guardar ni confirmar automáticamente. Volver
durante una carga cancela ese salto y recupera la página anterior; respuestas
tardías no abren otro producto. Lista y panel usan el mismo documento en
escritorio y móvil. «Guardar producto» guarda el borrador y cierra el panel
solo después del éxito. Escape y el fondo no cierran durante el guardado.
La gestión general de lotes y separación por calidad se
despliega cuando hace falta y se abre al detectar errores en esa sección.
El resumen
CANT/UNI y las acciones permanecen accesibles abajo. Los errores se buscan en
todo el documento y llevan al producto y página que corresponden. Al salir,
cambiar de almacén o quitar un lote utilizado se pide confirmar los cambios.
«Guardar borrador» admite mediciones incompletas; en la vista integrada conserva
la hoja abierta y su versión. Revisar exige completar las mediciones y guarda
primero el borrador antes de confirmar. Cambiar de fecha o cliente pide descartar
si hay cambios sin guardar y se bloquea durante un guardado; los documentos ya
guardados no cambian su cliente ni fecha. Consultar el resumen o cambiar a
Preparaciones registradas conserva montada la hoja. Los usuarios sin permiso de
crear conservan el acceso de consulta al consolidado y al historial.
Crear, editar y confirmar mantienen permisos independientes.

Las referencias ya consultadas se conservan para la vista Anotados; si no se
conoce una cantidad solicitada o pendiente se muestra un guion, sin inventar
ceros. «Datos anotados» y los totales «Anotado» describen el borrador; el pendiente
confirmado solo cambia al confirmar la preparación. Durante un salto de producto
se bloquea su captura y las acciones de guardar/revisar para evitar escribir
en una fila mientras llega el siguiente producto.

Las preparaciones pueden ser **parciales**. Un pedido cambia a `preparado`
únicamente cuando todas sus líneas CANT/UNI están atendidas por preparaciones
confirmadas. Mientras quede cantidad pendiente permanece `pendiente`. No hay
conversiones automáticas entre cajas, unidades, kg o presentaciones. Una CANT
puede recibir aportes de varios lotes sin contarse más de una vez.

La impresión `/preparaciones/hoja` carga todos los productos y sucursales del
filtro, mediante páginas de 10. Las agrupa por categoría, distribuye columnas
en bloques para papel A4 horizontal y mantiene el total del cliente. Una versión
opaca de la hoja permite detectar cambios mientras se reúnen sus páginas; si
cambia el origen se pide recargar antes de imprimir una hoja inconsistente.

## Inventario y calidad

Los borradores no reservan ni descuentan existencias. Al confirmar se vuelve a
validar la disponibilidad, el vencimiento hasta la fecha requerida, las referencias
activas y los pendientes actuales de cada pedido. Por cada lote debe cumplirse:

`cantidad_utilizada = suma de aportes medidos + merma + aprovechable`

La interfaz calcula esta suma con milésimas enteras; el servidor la comprueba con
`Decimal`. Cada aporte conserva la unidad del lote y el peso real en kg. Para
lotes en kg ambos coinciden; en otras unidades el peso se registra por separado
antes de confirmar. CANT/UNI expresa el avance del pedido, no una medición del lote.

La confirmación crea un movimiento `salida_preparacion` por toda la cantidad
utilizada. Si hay aprovechable, crea otro lote con `calidad=aprovechable`,
`estado=bloqueado` y `lote_origen`, junto con una `entrada_aprovechable`. Este
material conserva su existencia física y trazabilidad, pero no puede desbloquearse
para atender pedidos. La merma sale del inventario. Cualquier separación requiere
un motivo. Los movimientos, lotes, avance y evidencia de auditoría se guardan en
la misma transacción.

Las cajillas son **previsión**, sin reserva, préstamo ni movimiento en este
módulo. Sus saldos visibles son informativos. El futuro despacho deberá comprobar
y registrar las cajillas efectivamente enviadas; los productos ya consumidos por
la preparación no se deben descontar otra vez.

La cabecera de edición reúne la flecha de volver, el título y el código en una
fila adaptable, sin migas ni explicación repetidas. Debajo resume cliente, fecha
y almacén en una línea que se adapta al ancho, sin tarjeta propia. «Cambiar»
despliega los controles existentes y conserva la protección de cambios. La hoja
integrada conserva su título externo y presenta el código en el contexto.
La hoja no captura notas; las observaciones históricas
se conservan al guardar mediante el contrato existente. Los lotes aparecen al anotar
una cantidad o cuando ya hay aportes. Las entradas y los desplegables usan
movimiento breve, respetando la reducción de movimiento.
El panel usa un fondo gris neutro y una ficha blanca, con equivalentes en carbón
para el modo oscuro. La sucursal seleccionada se distingue por el subrayado naranja
y el nombre en negrita. Los aportes de lotes y las previsiones de cajillas usan filas
con divisores suaves; la medición en kg se alinea con el lote cuando hay ancho.
El selector de cajillas muestra el nombre del color con un punto reconocible;
los nombres sin correspondencia visual conservan el icono de cajilla. Estos cambios
de presentación mantienen cantidades, validaciones, reparto y guardado.

Los ceros decimales finales se ocultan sin redondear ni cambiar la precisión de
las mediciones reales: 1.000 se muestra como 1 y 5.400 como 5.4. Los saldos de
lotes y cajillas son actuales del almacén; la proyección resta todos los aportes,
separaciones o previsiones del documento, incluidas otras sucursales/productos.
Las cajillas en tránsito ya no se muestran disponibles. El borrador no reserva
existencias y los saldos reales se verifican al confirmar o despachar.

«Resumen de cajillas» se deriva de las previsiones de cada producto/sucursal:
permite regresar al producto para cambiarlas sin pedir otro total. Se conservan
los planes históricos sin producto y se identifican como tales; no se reparten
automáticamente entre productos. Despachos recibe la previsión del producto de
cada carga y suma por sucursal/color sin duplicar un plan repetido en CANT/UNI.

## API

Prefijo `/api/v1/preparaciones/`. Listados y selectores usan `pagina`, fija de
**10**; la hoja añade `pagina_sucursales`, también fija de 10.

La consulta `lotes/` conserva GET y admite POST de solo lectura con `consumos`
(`lote`, `cantidad`, una fila por lote y hasta 500) y `excluir` (hasta 20 lotes ya
seleccionados en una asignación). El contexto, búsqueda y página siguen en la
URL. El servidor calcula `disponible_preparacion` desde el saldo actual menos
esos consumos y filtra antes de paginar; `saldo` conserva su significado anterior.
Esta consulta requiere ver Preparaciones, no crear, y no guarda ni reserva stock.

| Ruta relativa | Operación |
| --- | --- |
| raíz | GET historial; POST crear borrador |
| `{id}/` | GET detalle; PATCH reemplazar documento de un borrador |
| `{id}/confirmar/` | POST confirmar el borrador guardado |
| `{id}/cancelar/` | POST cancelar un borrador, con motivo |
| `consolidado/` | GET hoja por cliente y fecha requerida |
| `clientes/` | GET clientes con pedidos, filtrables por fecha |
| `categorias/` | GET categorías de los pedidos del cliente y fecha |
| `productos/` | GET productos con pendientes del cliente y fecha |
| `imagenes/{producto_id}/` | GET foto del catálogo con permiso operativo y contexto de cliente/fecha |
| `necesidades/` | GET líneas pendientes con solicitado, preparado y restante |
| `lotes/` | GET lotes elegibles para cliente, fecha, producto y almacén |
| `almacenes/` | GET almacenes activos |
| `sucursales/` | GET sucursales activas con pedidos del cliente y fecha |
| `colores/` | GET colores y saldo informativo del almacén |

El historial acepta `buscar`, `cliente`, `fecha_pedidos`, `almacen` y `estado`.
La hoja exige `cliente` y `fecha_pedidos`; admite `categoria`, `buscar`,
`vista=solicitado|pendiente` y `version_hoja`. Los selectores de necesidades,
productos y sucursales reutilizan ese contexto; necesidades admite `producto`.
Productos admite `categoria` y `solo_pendientes` (verdadero por defecto). Con
`solo_pendientes=false` consulta todos los productos de los pedidos no cancelados.
Devuelve foto, categoría, solicitado original y pendientes CANT/UNI separados,
incluidas las cantidades ya atendidas en otras líneas del mismo producto.
La hoja consolidada incluye `categoria_id` para conservar los filtros en la
selección inicial y el documento guardado también incluye fotos.
Las fotos exigen `cliente` y `fecha_pedidos`, y solo se sirven para productos de
sus pedidos no cancelados o de una preparación histórica de ese mismo contexto.
No requieren permisos de administración de Productos; su caché es privada.
Si falta el archivo o no pertenece al contexto se devuelve 404. La interfaz
reutiliza la imagen real del catálogo y muestra un icono cuando no está disponible.

Crear/editar recibe el documento completo: `cliente`, `fecha_pedidos`, `almacen`,
`observaciones`, `lineas`, `asignaciones` y `cajillas`. Cada línea identifica un
lote único y sus cantidades utilizadas/separadas. Cada asignación identifica
una línea de pedido única, su cantidad CANT/UNI atendida y `aportes` con `lote`,
`cantidad` y `peso_kg`. Las cajillas identifican `sucursal`, `producto`, `cajilla`
y cantidad entera. `producto` es opcional/nulo para conservar contratos y planes
históricos. Si se informa, debe estar asignado a esa sucursal en el documento y
tener cantidad preparada positiva al confirmar. El mismo producto/color/destino
no se repite; distintos productos pueden usar el mismo color. Se admiten hasta
500 filas de cada colección y 20 aportes por asignación.
Los errores anidados se devuelven como `asignaciones_0_aportes_0_cantidad`, etc.
Se rechazan campos adicionales y escrituras sobre campos controlados.

Crear exige `clave_operacion` UUID. Editar exige `version` opaca; el cliente y
fecha de un borrador guardado son inmutables. PATCH reemplaza sus colecciones:
los identificadores internos de filas no son un contrato estable de edición.
Confirmar recibe `version` y `clave_operacion`; cancelar añade `motivo`.
Los reintentos válidos de creación/confirmación/cancelación no duplican efectos.
Un conflicto de versión, estado o clave devuelve 409. Los documentos confirmados
son inmutables; solo se cancelan borradores, sin revertir inventario.

## Permisos, auditoría y concurrencia

Todos los accesos exigen `preparaciones.view_preparacion`; crear, editar,
confirmar y cancelar requieren además su permiso específico:
`add_preparacion`, `change_preparacion`, `confirmar_preparacion` o
`cancelar_preparacion`. Los permisos operativos abarcan los clientes y sucursales
del sistema y solo exponen los datos necesarios para preparar. No conceden acceso
administrativo a Clientes, Pedidos, Almacenes o Inventario. Los enlaces a estos
módulos respetan sus propios permisos.

La sesión expone `permisos_preparaciones` y el catálogo de Roles las cinco
acciones. `preparar_roles` crea **Administrador de preparaciones** si falta,
sin ampliar roles anteriores ni asignar usuarios.

Los servicios centrales `guardar_preparacion`, `confirmar_preparacion` y
`cancelar_preparacion` validan permisos también fuera de HTTP y conservan su
evidencia de auditoría atómicamente. El orden de bloqueo es Cliente → Sucursales
→ Pedidos → Preparación → Detalles de pedido → Productos → Categorías → Unidades
→ Almacén → Lotes, ordenados por clave dentro de cada grupo. Se recalculan
pendientes y saldos bajo bloqueo para evitar doble atención y saldo negativo,
incluso entre clientes que comparten un lote. Cajillas respeta el mismo orden
Cliente → Sucursal antes de bloquear color y almacén.

Un pedido con cantidades preparadas confirmadas ya no se puede editar ni
cancelar por el flujo ordinario. Los borradores toleran que se retire una línea
de pedido, conservando su referencia histórica; antes de guardar/confirmar se
debe retirar esa asignación obsoleta y revisar los pendientes.

## Verificación

```bash
# En Backend, con el entorno activado
python manage.py test preparaciones
python manage.py check --database default
python manage.py makemigrations --check --dry-run

# En Frontend
node --test pruebas/calculos_preparacion.mjs
npm run build
```

La suite cubre hoja por sucursal, ambos ejes de paginación, totales, permisos,
parciales, CANT/UNI sin equivalencias, varios lotes por caja, kg y otras unidades,
calidad, stock, vencimientos, cajillas sin movimientos, borradores obsoletos,
fotos con permisos y contexto, categorías, revisión de mediciones fuera de página,
idempotencia, auditoría y carreras reales con PostgreSQL.
