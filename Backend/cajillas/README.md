# Cajillas por color y cantidad

Pantallas: `/cajillas`, `/cajillas/nuevo`, `/cajillas/{id}` y
`/cajillas/{id}/movimiento?tipo=ingreso|salida|devolucion`.

Se registra cada **color** una sola vez, con una cantidad inicial entera
(puede ser cero). La creación y los movimientos conservan fecha automática
y usuario responsable. No se configuran tipos, capacidades, pesos ni
equivalencias; este inventario de recipientes es independiente de las
cantidades CANT/UNI de los pedidos y del inventario de productos.

## Control

- **Inicial:** al registrar un color con cantidad positiva se crea una entrada
  inicial al almacén elegido, en la misma transacción.
- **Ingreso:** agrega nuevas cajillas de ese color a un almacén y al total.
- **Salida:** resta del almacén y registra el pendiente de una sucursal activa.
- **Devolución:** suma al almacén receptor y reduce el pendiente de la sucursal.
  Puede ser parcial, recibirse en otro almacén y proceder de una sucursal o
  cliente inactivos. Así se pueden recuperar los recipientes que siguen fuera.

Con 100 verdes, una salida de 30 y una devolución de 20 producen 90 en almacenes,
10 en sucursales y 100 en total. Las existencias por almacén y los pendientes
por sucursal se calculan **desde los movimientos**, sin campos de saldo
editables. Los registros de movimiento son inmutables, positivos y enteros.
Solo los almacenes activos reciben nuevos movimientos; sus saldos históricos
siguen visibles si se desactivan.

No se pueden sacar más cajillas que las disponibles en el almacén ni devolver
más que las pendientes de ese color y sucursal. Los movimientos afectan a un
único color; la sucursal es obligatoria en salida/devolución y se omite en
ingresos. El total se conserva durante salidas y devoluciones. Este bloque no
incluye ajustes por pérdida/rotura ni automatiza movimientos desde despachos.

## API y permisos

Prefijo `/api/v1/`. Todos los listados y selectores usan `pagina`, fija de **10**.

| Ruta | Operación |
| --- | --- |
| `cajillas/` | GET colores/saldos; POST color y existencias iniciales |
| `cajillas/{id}/` | GET ficha, saldos y versión |
| `cajillas/resumen/` | GET total, en almacenes, en sucursales y cantidad de colores |
| `cajillas/{id}/movimientos/` | POST ingreso, salida o devolución |
| `cajillas/movimientos/` | GET historial paginado |
| `cajillas/{id}/saldos-almacenes/` | GET almacenes con saldo positivo |
| `cajillas/{id}/saldos-sucursales/` | GET pendientes por sucursal |
| `cajillas/almacenes/` | GET selector de almacenes activos |
| `cajillas/sucursales/` | GET selector de sucursales para salida o devolución |

El historial admite `buscar`, `cajilla`, `tipo`, `fecha` ISO (día de Bolivia),
`almacen` y `sucursal`. Los colores admiten `buscar`. Los selectores admiten
`buscar`. `saldos-almacenes/?operacion=salida` devuelve solo almacenes activos
con saldo positivo. `sucursales/?operacion=devolucion&cajilla={id}` devuelve
sucursales con pendiente, incluso inactivas; `sucursal={id}` permite localizar
una al iniciar una devolución. Las opciones de salida requieren sucursal y
cliente activos. Se expone solo la información necesaria para esta operación,
sin conceder permisos administrativos sobre Clientes o Almacenes.

Crear color recibe `color`, `cantidad_inicial`, `almacen` (obligatorio cuando
la cantidad inicial es positiva) y `clave_operacion` UUID. Con cantidad cero,
`almacen` se normaliza a `null` y no se crea movimiento. Los colores se
normalizan y son únicos sin distinguir mayúsculas.

Crear un movimiento recibe:

```json
{
  "tipo": "salida",
  "cantidad": 30,
  "almacen": 1,
  "sucursal": 2,
  "observaciones": "Entrega de cajillas vacías",
  "version": "version opaca del color",
  "clave_operacion": "d93061a4-a621-407e-aed6-0809627570a4"
}
```

Los identificadores son ilustrativos. En ingreso, `sucursal` es `null`.
Cada cantidad positiva admite hasta 2147483647 por movimiento. El servidor
asigna fecha y responsable y rechaza campos adicionales. No se admiten PATCH,
DELETE, saldos directos, movimientos iniciales desde el formulario general ni
fechas manuales. Las respuestas devuelven el movimiento y los saldos del color.

Se exige `cajillas.view_cajilla` y el permiso específico de crear color,
registrar ingreso, salida o devolución. Crear existencias iniciales positivas
exige además el permiso de ingreso: el permiso de crear color por sí solo
permite únicamente registrarlo con cero cajillas. La sesión publica
`permisos_cajillas` y el catálogo de Roles contiene las cinco acciones.
`preparar_roles` crea **Administrador de cajillas** si falta, sin ampliar grupos
anteriores ni asignar usuarios.

## Transacciones y auditoría

`crear_cajilla` y `registrar_movimiento` aplican validaciones y permisos fuera
de HTTP. Cada operación y su evidencia central son atómicas; la capa HTTP
registra consultas y rechazos. Las operaciones tienen UUID y huella de sus
datos: un reintento válido devuelve el resultado anterior sin duplicarlo;
reutilizar la clave con otros datos o cuenta devuelve 409.

Las salidas y devoluciones bloquean Cliente → Sucursal antes de Color → Almacén,
en el mismo orden que los procesos de pedidos y preparación. Los ingresos
bloquean Color → Almacén. Todos bloquean la fila del color antes de recalcular
saldos, aunque usen distintos almacenes/sucursales. La versión
opaca cambia con el último movimiento: una pantalla desactualizada recibe 409
y debe revisar saldos. El cliente puede conservar cantidad y observaciones al
recargar, pero debe volver a elegir almacén y sucursal. Se mantienen el orden
de bloqueo y las restricciones de PostgreSQL.

Preparaciones puede guardar una previsión de cajillas por color y sucursal.
No genera movimientos ni reserva cantidades. El despacho futuro debe registrar
las cajillas efectivamente enviadas con las validaciones de este módulo.

Las pruebas incluyen el flujo HTTP, saldos por almacén/sucursal, permisos,
colores duplicados, cantidades inválidas, referencias inactivas, paginación,
reintentos y concurrencia real de salidas/devoluciones, además de la reversión
completa cuando falla la auditoría.
