# Pedidos por sucursal

La hoja registra cajas y unidades sueltas como cantidades enteras independientes.
No convierte cajas a unidades, no descuenta inventario y no recibe mercancía.
Preparaciones registra el consumo físico y el avance; la recepción de la
sucursal corresponderá a Entregas.

## Hoja de pedido

La cabecera muestra Sucursal (cliente y sucursal juntos), Responsable, Fecha
requerida de entrega y Fecha del pedido. No repite el campo Cliente. La sucursal,
responsable y fecha del pedido son de solo lectura; la fecha requerida conserva
el calendario compartido y sus validaciones.

Una sucursal activa asignada a la cuenta se carga automáticamente, incluso
cuando la cuenta tiene permisos globales. Si solo existe un destino autorizado,
también se carga directamente. Si hay varios, el destino se elige antes de abrir
la hoja, únicamente entre los autorizados, y permanece fijo dentro del pedido.
Sin destino activo se muestra cómo obtener la asignación; no se elige una
sucursal arbitraria. La asignación se administra en Clientes → Sucursales.

Observaciones ya no aparece ni se envía desde creación, edición o detalle de
Pedidos. Se conserva el campo histórico de la API por compatibilidad con clientes
anteriores. Omitirlo al editar conserva las notas previas; no borra datos existentes.
Las claves de traducción antiguas permanecen por compatibilidad con pestañas
abiertas, sin volver a mostrar esos campos en la interfaz actual.
La cancelación conserva responsable, fecha y evidencia de auditoría sin solicitar
motivo. Los motivos anteriores se conservan como datos históricos.

## Listado y cancelación

La vista principal `/pedidos` reúne el listado, los filtros, los contadores y las
acciones Editar y Cancelar, según permisos y estado. No hay una pantalla de
detalle independiente: las URLs anteriores `/pedidos/{id}` redirigen al listado.
Al guardar o editar se regresa al listado con la notificación correspondiente.
La hoja conserva «Ver resumen» antes de guardar.

Cancelar abre una confirmación con el código del pedido y las opciones Volver y
Sí, cancelar pedido, sin formulario de motivo. Envía únicamente `version`.
La operación conserva datos e historial, actualiza listado y contadores, evita
doble envío y exige revisar el listado si cambió la versión o el alcance de la cuenta.
La API de detalle se mantiene para edición, integraciones y compatibilidad.

## Configuración

1. En Productos → Presentaciones, asignar «Cajas (CANT)» o «Unidades (UNI)» a las presentaciones para pedidos. Solo se admite una por columna y producto, incluyendo las inactivas. No se configuran equivalencias.
2. Crear o usar un rol con Ver pedidos y Crear pedidos, y opcionalmente Editar pedidos y Cancelar pedidos.
3. En Clientes → ficha del cliente → editar sucursal, asignar su encargado de pedidos. Esta asignación requiere el permiso independiente `clientes.asignar_encargado`, además del acceso y edición de sucursales.
4. El encargado verá únicamente las sucursales asignadas. La empresa puede recibir Ver pedidos de todas las sucursales y/o Gestionar pedidos de todas las sucursales. El alcance global no sustituye los permisos de cada acción.

`python manage.py preparar_roles` crea los roles faltantes sin ampliar los ya existentes ni asignarlos automáticamente a cuentas. Nunca se generan productos, sucursales ni pedidos de ejemplo en producción.

## Contrato y consistencia

- `/api/v1/pedidos/`: listado, POST y detalle/PATCH. Listados y selectores usan `pagina`, siempre 10 registros.
- POST exige `clave_operacion` UUID. Un reintento idéntico del mismo actor devuelve el pedido original. Otra carga con la misma clave produce 409.
- PATCH recibe la hoja completa: `fecha_requerida`, `detalles` y `version`. La sucursal es inmutable. Cada detalle contiene `producto`, `presentacion`, `columna` y `cantidad`. El campo legado `observaciones` sigue siendo opcional para clientes anteriores.
- `POST /pedidos/{id}/cancelar/` exige `version`. Acepta `motivo` opcional por compatibilidad; al omitirlo guarda una cadena vacía, sin inventar un motivo. Conserva el pedido y sus detalles. Solo un pendiente sin cantidades preparadas confirmadas admite edición o cancelación.
- Metadatos autorizados: `sucursales/`, `categorias/`, `catalogo/`, `imagenes/{producto}/`. No requieren permisos de administración de Productos o Clientes.
- `sucursales/` conserva su lista paginada fija de 10 y agrega `sucursal_asignada`, una opción o `null`. La asignación única se resuelve independientemente de la búsqueda y de la página, sin ampliar el alcance autorizado ni exponer datos personales de la cuenta.
- Un detalle histórico sin cambios puede conservarse aunque su catálogo se inactive; modificarlo exige referencias activas y correctamente asignadas. Los nombres y el destino conservan su fotografía histórica.
- Las escrituras bloquean cliente, sucursal, pedido y referencias en orden estable. Se revalida el alcance después del bloqueo. La reasignación de una sucursal revoca el acceso anterior.
- Los servicios centrales `guardar_pedido` y `cancelar_pedido` validan permisos, versión, estado y datos también fuera de HTTP; registran auditoría en la misma transacción. Si falla la evidencia, se revierte la escritura.
- No hay endpoints para eliminar pedidos, recibir cantidades ni modificar manualmente el estado a preparado.

Preparaciones bloquea el pedido, comprueba el pendiente y registra su avance
y la salida de inventario en una transacción. Un pedido con cantidades preparadas
confirmadas no admite edición ni cancelación ordinaria. Las futuras entregas
referenciarán los detalles conservados sin alterar lo solicitado.
