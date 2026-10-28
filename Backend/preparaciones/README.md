# Preparación de pedidos

La pantalla `/preparaciones` reúne los pedidos no cancelados de un **cliente**
y una **fecha requerida**. La fecha filtra qué pedidos se atenderán; la fecha
de creación y el responsable de la preparación son automáticos.

## Hoja y flujo de trabajo

La hoja presenta productos por filas, sucursales por columnas y totales del
cliente. **CANT (cajas) y UNI (unidades) permanecen independientes**. Los
totales incluyen todas las sucursales, aunque algunas estén en otra página.
Se puede consultar lo solicitado originalmente o lo pendiente, buscar productos
y filtrar por las categorías reales del catálogo. Productos y sucursales se
paginan por separado, siempre de 10 en 10.

«Preparar» abre una hoja de trabajo para ese cliente y día, sin limitarla al
filtro de categoría del consolidado. El cliente y la fecha permanecen visibles;
si solo existe un almacén activo, se selecciona automáticamente.

1. Elegir un producto por su foto y nombre, con búsqueda y filtro de categoría.
2. Elegir de qué lote sale y anotar «Preparar ahora» por sucursal. «Cantidad real
   usada» registra aparte la medición física; admite varios lotes por fila.
3. Si corresponde, desplegar la separación por calidad o las cajillas previstas.
4. «Revisar preparación» guarda primero el borrador y abre el resumen con fotos.
   La confirmación expresa se realiza desde la misma hoja, usando la versión
   devuelta por el servidor y una clave idempotente.

La lista de productos y cada sección usan páginas de 10, conservando lo anotado
al cambiar de producto o página. «En esta hoja» permite volver a los productos
ya incluidos. En pantallas pequeñas se alternan Productos y Preparar; el resumen
CANT/UNI y las acciones permanecen accesibles abajo. Los errores se buscan en
todo el documento y llevan al producto y página que corresponden. Al salir,
cambiar de almacén o quitar un lote utilizado se pide confirmar los cambios.
«Guardar borrador» admite mediciones incompletas; revisar exige completarlas.
Crear, editar y confirmar mantienen permisos independientes.

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

## API

Prefijo `/api/v1/preparaciones/`. Listados y selectores usan `pagina`, fija de
**10**; la hoja añade `pagina_sucursales`, también fija de 10.

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
Productos admite `categoria` y devuelve foto, categoría y pendientes CANT/UNI
separados. La hoja consolidada y el documento guardado también incluyen fotos.
Las fotos exigen `cliente` y `fecha_pedidos`, y solo se sirven para productos de
sus pedidos no cancelados o de una preparación histórica de ese mismo contexto.
No requieren permisos de administración de Productos; su caché es privada.
Si falta el archivo o no pertenece al contexto se devuelve 404. La interfaz
reutiliza la imagen real del catálogo y muestra un icono cuando no está disponible.

Crear/editar recibe el documento completo: `cliente`, `fecha_pedidos`, `almacen`,
`observaciones`, `lineas`, `asignaciones` y `cajillas`. Cada línea identifica un
lote único y sus cantidades utilizadas/separadas. Cada asignación identifica
una línea de pedido única, su cantidad CANT/UNI atendida y `aportes` con `lote`,
`cantidad` y `peso_kg`. Las cajillas identifican `sucursal`, `cajilla` y cantidad
entera. Se admiten hasta 500 filas de cada colección y 20 aportes por asignación.
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
