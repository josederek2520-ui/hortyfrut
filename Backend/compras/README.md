# Compras

Compras permite revisar pedidos pendientes por fecha requerida y registrar los
productos adquiridos a sus proveedores. Los responsables se vinculan directamente
a Usuarios. No existe un módulo de Empleados.

## Dos fechas independientes

- **Pedidos con entrega el** (`fecha_pedidos`): día requerido en los pedidos que se desea
  atender. Al seleccionarlo se consultan automáticamente los pendientes de esa
  fecha; no se filtra por la fecha en que se crearon.
- **Fecha de compra** (`fecha_compra`): día de adquisición, inicialmente hoy en
  America/La_Paz. Admite hoy o fechas anteriores. No se exige que sea igual o
  anterior a la fecha requerida: permite registrar compras para pedidos atrasados.

Ambos campos son obligatorios y usan el componente compartido CampoFecha, con
idioma activo, calendario fuera de las superficies con desenfoque y valores ISO
en la API. Modificar la fecha de pedidos actualiza la consulta y conserva las
líneas de compra que el usuario ya introdujo.

## Pantallas

- `/compras`: listado, búsqueda, filtros independientes por ambas fechas y estado,
  contadores y páginas de 10 registros. Admite `?fecha_pedidos=AAAA-MM-DD`.
- `/compras/nuevo`: hoja con fechas compactas y tabla editable a todo el ancho.
  Las necesidades se consultan opcionalmente en escritorio y se alternan con
  Mi compra en móvil. La tabla separa producto y proveedor en columnas y alinea
  selectores, cantidades e importes a la misma altura, con encabezados compartidos.
  Una única acción «Agregar producto» abre el modal de selección y captura.
- `/compras/{id}`: datos históricos, fechas, responsable, fecha de creación,
  productos, referencias y acciones permitidas.
- `/compras/{id}/editar`: hoja completa editable solo mientras está en borrador.

La consulta de pedidos tiene resumen por producto con CANT y UNI separadas, y
vista por sucursal con pedido, producto y cantidades. Todas sus páginas son de
10 registros. Excluye pedidos preparados/cancelados y destinos inactivos.
Un producto inactivo puede aparecer como necesidad histórica, pero no se agrega
a una línea nueva. Un aviso muestra cuántas compras ya están registradas para la
misma fecha y permite abrir su listado filtrado.

El modal abre inicialmente los productos de los pedidos pendientes de la fecha
«Pedidos con entrega el», con fotos y cantidades solicitadas. Permite buscar, filtrar por
categoría y consultar todo el catálogo autorizado de Compras, incluso sin pedidos.
Al elegir un producto se muestra la referencia solicitada y se pueden completar
la unidad base o presentación activa para compra/ambos, cantidad, proveedor y
total pagado por el producto. Estos datos pueden completarse después en la hoja. Las vistas «Elegir
producto» y «Completar producto» comparten un modal de altura estable, con entrada
breve y transiciones de opacidad/desplazamiento cancelables; movimiento reducido
usa solo opacidad. El pie conserva el total pagado y la acción de agregar, o confirmación
y «Ver compra» con el número de productos distintos. Agregar vuelve a la lista
sin cerrar el modal. Volver a la lista conserva búsqueda, origen, categoría,
página válida, posición y datos manuales durante esa sesión. Las cantidades
solicitadas son referencia: no se copian automáticamente como cantidades compradas
ni se convierten cajas, unidades o pesos.

El estado vacío ofrece «Agregar primer producto»; revisar requiere al menos una
línea y guardar borrador conserva sus permisos y validación independiente. Las
etiquetas de ambas fechas aparecen encima de sus campos y mantienen sus límites.

La tabla también muestra «Solicitado», cajas y unidades debajo del nombre del producto,
alineado con el espacio de «Otro proveedor». Es una consulta por la fecha elegida
y los productos de la página visible (hasta 10), independiente de los datos de la
compra. Cambiar «Pedidos para» renueva la referencia sin alterar cantidades,
presentaciones, proveedores o importes; también funciona al abrir un borrador.
Las filas con distintos proveedores comparten la misma referencia del producto,
sin multiplicarla ni descontar compras. Sin pedidos se indica expresamente;
la carga y los errores de consulta no se presentan como cantidades cero. El modal
y las referencias de la hoja usan nombres legibles («1 caja», «3 unidades») y
omiten medidas no solicitadas sin sumar ni convertir CANT/UNI.

Las fotos del catálogo aparecen en necesidades, selector de productos, líneas,
revisión y detalle. Se consultan con permiso de Compras, sin exigir administrar
Productos, y muestran un icono de respaldo si no existe una imagen o falla su
carga. Son las fotos actuales del catálogo; no se alteran los textos ni los
importes históricos de la compra. La consulta de fotos permite también productos
inactivos para conservar el acceso desde compras anteriores.

Cada línea admite producto, proveedor, presentación habilitada para compras o
unidad base, cantidad y total pagado en Bs por toda esa cantidad. El modal incorpora cada producto una sola
vez. «Otro proveedor», debajo del selector de proveedor de cada fila, permite
añadir otra línea del mismo producto y presentación con proveedor, cantidad y
total vacíos. Lleva a su página y enfoca el nuevo selector, respetando los permisos
de edición y el límite de 500 líneas. Cada fila conserva sus datos independientes;
las combinaciones completas producto/presentación/proveedor no se duplican.
Conserva las líneas históricas y la compatibilidad de la API.

El borrador permite líneas incompletas, sin proveedor o con cantidad/importe cero,
y también permite guardar solo las fechas. La cantidad admite 3 decimales y el
importe 2. `importe_total` conserva directamente el total manual de cada línea en
`subtotal`; no lo divide ni multiplica por la cantidad. Cambiar cajas o presentación
no cambia el importe. El servidor suma con Decimal y el frontend con centavos
enteros, incluidos importes introducidos con coma decimal. El total de la compra
se calcula en el servidor; no se admite un total global enviado por el cliente.
Los contratos anteriores con `precio_unitario` sin `importe_total` siguen
calculando cantidad por precio con ROUND_HALF_UP. Una edición anterior con los
mismos valores monetarios conserva el importe persistido. Registrar usa siempre
los subtotales guardados, también para 3 cajas pagadas en 100,00 Bs. No se calcula
ni inventa un precio individual; el campo legado se conserva por compatibilidad.
El total máximo es 999999999999.99 bolivianos y una hoja admite hasta 500 líneas.
Los formularios y detalles presentan 10 líneas por página.

Los selectores de presentación, proveedor y categoría se presentan como paneles anclados al campo, fuera de
la tabla y de las superficies con desenfoque. Admiten búsqueda, navegación con
flechas y Enter, cierre con Escape o al salir del panel y páginas de 10 opciones.
Proveedores consulta inicialmente la categoría del producto; Todos permite
elegir otros proveedores activos, incluidos los que no tienen categoría.
Cambiar el filtro conserva el proveedor ya seleccionado. Agregar producto permite
filtrar por categorías activas sin abandonar el panel. El filtro es una ayuda de
selección y no añade una restricción comercial al guardar una compra.
Los importes visibles usan Bs en español e inglés, conservando los separadores
numéricos del idioma y el cálculo exacto en centavos.

Las necesidades indican qué productos ya están en la compra. Los productos
agregados desaparecen del modal tanto en pedidos como en catálogo; se consideran
todas las páginas de la hoja, también al editar un borrador. Al eliminar su última
línea vuelven a estar disponibles. La exclusión se aplica antes de paginar en el
servidor; no modifica pedidos ni persiste un estado de ocultación. El modal permanece
abierto para agregar otros productos y conserva búsqueda, categoría y origen.
Debajo de «Pedidos con entrega el» se consulta la fecha seleccionada y se indica
si existen pedidos pendientes. El aviso distingue carga, resultado vacío y
error con reintento; descarta respuestas de fechas anteriores. No cambia los
productos elegidos ni la fecha de compra.

Compras no muestra Observaciones en creación, edición, revisión ni detalle.
El navegador omite ese campo al guardar; las notas históricas se conservan.
La API mantiene el campo legado y su huella de creación compatible, sin borrar
observaciones al editar si el cliente no las envía expresamente.
La barra inferior conserva el total en bolivianos, los recuentos de productos y
proveedores, y las acciones según los permisos del usuario.
Indica las líneas por completar y ofrece «Revisar compra» antes de la confirmación
de registro. Los importes de una fila incompleta se muestran sin fingir un importe
calculado; el total mantiene la suma exacta en centavos de los importes manuales.

Guardar borrador admite datos incompletos. Revisar y registrar valida todas las
líneas, incluidas las páginas no visibles, guarda primero el borrador y abre un
resumen de los datos devueltos por el servidor. Volver a la hoja conserva ese
borrador y su versión; confirmar registra desde el mismo flujo. La revisión tiene
paginación de 10 y conserva la clave de registro durante los reintentos. Un usuario
con permiso de crear y registrar, pero sin editar, puede confirmar el borrador
guardado y no puede modificarlo después de su creación.

## Estados y trazabilidad

`borrador -> registrada`, o cancelación autorizada con motivo.

Registrar exige al menos una línea y revalida productos, categorías, unidades,
presentaciones y proveedores activos; cada cantidad e importe pagado debe ser positivo.
Una compra registrada no admite edición. Cancelar conserva sus detalles,
importes, referencias, responsables e historial.

Las referencias guardan una fotografía de los pedidos pendientes que coinciden
con la fecha y los productos de la compra al guardar el borrador. Incluyen
identificadores originales y textos/cantidades de ese momento. No representan
asignación de cantidades compradas a pedidos, reservas ni cobertura automática.
Cambiar un pedido o catálogo después no reescribe la compra histórica.

Compras no cambia el estado ni las cantidades de los pedidos y no genera lotes
ni movimientos de inventario. El ingreso físico corresponde a Recepciones.
Las compras con recepciones activas no se pueden cancelar.

## API

| Ruta | Función |
| --- | --- |
| `/api/v1/compras/` | GET paginado y POST de borrador. |
| `/api/v1/compras/{id}/` | GET y PATCH de la hoja completa. |
| `/api/v1/compras/{id}/registrar/` | POST para registrar. |
| `/api/v1/compras/{id}/cancelar/` | POST para cancelar con motivo. |
| `/api/v1/compras/resumen/` | Contadores por estado, respetando búsqueda y fechas. |
| `/api/v1/compras/necesidades/` | Pedidos pendientes de `fecha_pedidos`, con `vista=resumen` o `sucursales`. |
| `/api/v1/compras/productos/` | Productos activos autorizados para el selector. |
| `/api/v1/compras/imagenes/{producto_id}/` | Foto actual del catálogo con permiso de Compras. |
| `/api/v1/compras/categorias/` | Categorías activas para filtrar productos. |
| `/api/v1/compras/proveedores/` | Proveedores activos para el selector. |
| `/api/v1/compras/presentaciones/` | Presentaciones de compras del `producto` seleccionado. |

Los listados y selectores usan `pagina` y tamaño fijo 10, incluso si se envían
otros parámetros de tamaño. El listado admite `buscar`, `estado`, `fecha_pedidos`
y `fecha_compra`. Necesidades admite `fecha_pedidos`, `vista`, `buscar`, `categoria`
y `solo_disponibles=true` para omitir productos/categorías/unidades inactivos.
Necesidades también admite `productos`, hasta 500 identificadores separados por
coma para consultar referencias concretas antes de paginar, sin omitir productos
históricos inactivos por defecto.
Productos admite `categoria` y opcionalmente `fecha_pedidos` para incluir CANT/UNI
y número de pedidos pendientes por producto (cero si no fue solicitado).
Ambos admiten `excluir_productos`, hasta 500 identificadores separados por coma,
validados y excluidos antes de paginar. Proveedores acepta `producto` para filtrar por su
categoría, `todos=true` para consultar todos los activos y `categoria` como filtro
explícito. Devuelve `categoria_producto` como contexto y la categoría de cada
proveedor. Sin `producto`, conserva la consulta general compatible con los otros
módulos. Todos estos selectores exigen Ver compras y conservan auditoría HTTP.

POST recibe `fecha_pedidos`, `fecha_compra`, `observaciones`, `detalles` y
`clave_operacion` UUID. Cada detalle recibe `producto`, `presentacion` (ID o null),
`proveedor` (ID o null), `cantidad` e `importe_total` (opcional en el contrato,
predeterminado en la interfaz). Conserva `precio_unitario` para clientes anteriores;
si se envían ambos, manda `importe_total`. La respuesta conserva `subtotal` y
añade `importe_total` con el mismo valor. No requiere migración de datos: las
compras históricas muestran su subtotal persistido como total pagado. El total
global, responsable, estado y fechas automáticas no se aceptan desde el cliente.

PATCH exige `version` y la hoja completa, sin `clave_operacion`. Cada detalle
existente conserva su `id`. Se rechazan IDs ajenos/repetidos. Registrar recibe
`version` y `clave_operacion` UUID; cancelar añade `motivo` obligatorio.

Crear, registrar y cancelar reconocen reintentos del mismo actor con la misma
clave. Reutilizar una clave con otros datos o aplicar una versión antigua produce
conflicto. Los bloqueos y restricciones de base de datos impiden duplicados y
sobrescrituras durante operaciones simultáneas.

## Permisos y auditoría

Permisos independientes del modelo Compra: `view_compra`, `add_compra`,
`change_compra`, `registrar_compra` y `cancelar_compra`. Toda operación exige Ver
compras, además del permiso específico cuando escribe. No hay borrado ni PUT.

Ver compras permite consultar necesidades de todas las sucursales dentro de este
módulo central de abastecimiento y sus metadatos mínimos. No amplía los permisos
del módulo Pedidos ni concede administración de productos o proveedores.
La sesión expone `permisos_compras` y el menú respeta su permiso de consulta.

`guardar_compra`, `registrar_compra` y `cancelar_compra` validan permisos y datos
también fuera de HTTP. Sus cambios y evidencia se guardan en una misma transacción;
si falla la auditoría, toda la operación se revierte. La capa HTTP conserva
consultas y rechazos, con etiquetas en español e inglés.

La migración añade tres tablas y los cinco permisos. `preparar_roles` crea
Administrador de compras si falta; no amplía roles existentes ni asigna cuentas.

## Verificación

```bash
python manage.py test compras
python manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores compras
python manage.py check --database default
python manage.py makemigrations --check --dry-run
```

Desde Frontend:

```bash
node comprobaciones/compras.cjs
node --test pruebas/validaciones_compras.mjs
node --test pruebas/desplegables_compras.mjs
npm run build
```

Las pruebas cubren ambas fechas, selección por fecha requerida, CANT/UNI,
historial, permisos, validación de referencias, cálculo y límites monetarios,
idempotencia, auditoría y concurrencia en PostgreSQL.
