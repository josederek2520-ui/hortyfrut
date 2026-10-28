# Compras

Compras permite revisar pedidos pendientes por fecha requerida y registrar los
productos adquiridos a sus proveedores. Los responsables se vinculan directamente
a Usuarios. No existe un módulo de Empleados.

## Dos fechas independientes

- **Pedidos para** (`fecha_pedidos`): día requerido en los pedidos que se desea
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
- `/compras/nuevo`: hoja unificada con fechas compactas, necesidades del día y
  tabla editable de compra. En escritorio amplio se muestran lado a lado; en
  móvil y tableta se alternan con los botones Necesidades del día / Mi compra.
- `/compras/{id}`: datos históricos, fechas, responsable, fecha de creación,
  productos, referencias y acciones permitidas.
- `/compras/{id}/editar`: hoja completa editable solo mientras está en borrador.

La consulta de pedidos tiene resumen por producto con CANT y UNI separadas, y
vista por sucursal con pedido, producto y cantidades. Todas sus páginas son de
10 registros. Excluye pedidos preparados/cancelados y destinos inactivos.
Un producto inactivo puede aparecer como necesidad histórica, pero no se agrega
a una línea nueva. Un aviso muestra cuántas compras ya están registradas para la
misma fecha y permite abrir su listado filtrado.

Se puede agregar un producto desde el resumen o desde el catálogo autorizado de
Compras, incluso si no hay pedidos pendientes para esa fecha. Las cantidades
solicitadas son referencia: no se copian automáticamente como cantidades compradas
ni se convierten cajas, unidades o pesos.

Cada línea admite producto, proveedor, presentación habilitada para compras o
unidad base, cantidad y precio unitario. Una compra puede tener varios proveedores
por producto. Las combinaciones completas producto/presentación/proveedor no se
duplican. La selección de catálogos usa diálogos con portal, búsqueda y paginación.

El borrador permite líneas incompletas, sin proveedor o con cantidad/precio cero,
y también permite guardar solo las fechas. La cantidad admite 3 decimales y el
precio 2. El servidor calcula cada subtotal con Decimal y redondeo ROUND_HALF_UP;
después suma los subtotales. La previsualización utiliza enteros escalados para
obtener el mismo redondeo, incluidos importes introducidos con coma decimal.
El total máximo es 999999999999.99 bolivianos y una hoja admite hasta 500 líneas.
Los formularios y detalles presentan 10 líneas por página.

Los selectores de la hoja se presentan como paneles anclados al campo, fuera de
la tabla y de las superficies con desenfoque. Admiten búsqueda, navegación con
flechas y Enter, cierre con Escape o al salir del panel y páginas de 10 opciones.
Proveedores consulta inicialmente la categoría del producto; Todos permite
elegir otros proveedores activos, incluidos los que no tienen categoría.
Cambiar el filtro conserva el proveedor ya seleccionado. Agregar producto permite
filtrar por categorías activas sin abandonar el panel. El filtro es una ayuda de
selección y no añade una restricción comercial al guardar una compra.
Los importes visibles usan Bs en español e inglés, conservando los separadores
numéricos del idioma y el cálculo exacto en centavos.

Las necesidades indican qué productos ya están en la compra. El icono de
duplicar permite añadir otra línea del producto para otro proveedor; no copia
cantidades ni precios. Las observaciones son opcionales y se despliegan a demanda.
La barra inferior conserva el total en bolivianos, los recuentos de productos y
proveedores, y las acciones según los permisos del usuario.

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
presentaciones y proveedores activos; cada cantidad y precio debe ser positivo.
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
| `/api/v1/compras/categorias/` | Categorías activas para filtrar productos. |
| `/api/v1/compras/proveedores/` | Proveedores activos para el selector. |
| `/api/v1/compras/presentaciones/` | Presentaciones de compras del `producto` seleccionado. |

Los listados y selectores usan `pagina` y tamaño fijo 10, incluso si se envían
otros parámetros de tamaño. El listado admite `buscar`, `estado`, `fecha_pedidos`
y `fecha_compra`. Necesidades admite `fecha_pedidos`, `vista` y `buscar` por producto.
Productos admite `categoria`. Proveedores acepta `producto` para filtrar por su
categoría, `todos=true` para consultar todos los activos y `categoria` como filtro
explícito. Devuelve `categoria_producto` como contexto y la categoría de cada
proveedor. Sin `producto`, conserva la consulta general compatible con los otros
módulos. Todos estos selectores exigen Ver compras y conservan auditoría HTTP.

POST recibe `fecha_pedidos`, `fecha_compra`, `observaciones`, `detalles` y
`clave_operacion` UUID. Cada detalle recibe `producto`, `presentacion` (ID o null),
`proveedor` (ID o null), `cantidad` y `precio_unitario`. Los totales, responsable,
estado y fechas automáticas no se aceptan desde el cliente.

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
