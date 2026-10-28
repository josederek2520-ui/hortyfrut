# Inventario: unidades, lotes y movimientos

Las entradas se generan al confirmar [Recepciones](../recepciones/README.md)
y las salidas al confirmar [Preparaciones](../preparaciones/README.md). La
separación de aprovechable en Preparaciones conserva ese material en un lote
independiente bloqueado, mediante otro ingreso.
El inventario no almacena un campo editable `stock_actual`: el saldo procede
de la suma de movimientos registrados por lote, unidad y almacén. Cada línea
conserva su unidad; nunca se suman kg y unidades como un total común.

## Códigos de lote

Los lotes nuevos de recepciones y separaciones aprovechables usan
`LDDMMAA-NN`: por ejemplo, `L281026-01`. La fecha es `fecha_ingreso`, no la
fecha en que se digitó el registro. El consecutivo se comparte entre almacenes
y productos, empieza en 01 para cada fecha y continúa con 100, 101, etc.
El código completo queda almacenado, es único y no se vuelve a calcular al
bloquear o consultar el lote. La API sigue exponiendo `codigo` como lectura.

La migración `0003_codigos_lote_por_fecha` conserva los lotes anteriores con
su código `LOT-000001`: el campo nuevo permanece null en esos registros.
Los listados de Lotes y el selector de Preparaciones permiten buscar códigos
nuevos completos/parciales, códigos anteriores, números de ID y productos.

`_crear_lote_con_codigo` es una rutina interna de los servicios confirmados,
sin endpoint de creación manual. Bloquea la secuencia de la fecha con
`select_for_update` y guarda contador/lote dentro de la misma transacción
del movimiento y la auditoría. La primera secuencia del día también está
protegida por su clave primaria. Los reintentos idempotentes no consumen otro
número; un fallo de auditoría revierte lote, movimiento y consecutivo.

Pruebas de códigos, concurrencia e integración:

```bash
python manage.py test inventario recepciones preparaciones compras
python manage.py makemigrations --check --dry-run
```

## Rutas y permisos

Rutas bajo `/api/v1/`, con paginación `pagina` fija de **10**:

| Ruta | Permiso / comportamiento |
| --- | --- |
| `inventario/lotes/` | GET, `inventario.view_lote` |
| `inventario/lotes/{id}/` | GET, saldo, disponibilidad y trazabilidad de recepción o separación de calidad |
| `inventario/lotes/{id}/estado/` | POST, además `inventario.cambiar_estado_lote` |
| `inventario/movimientos/` | GET, `inventario.view_movimientoinventario` |
| `inventario/movimientos/{id}/` | GET, líneas por lote con cantidades reales |
| `inventario/lotes/almacenes/` | GET selector de almacenes, incluso inactivos para consulta histórica |
| `inventario/movimientos/almacenes/` | GET selector con el permiso de movimientos |
| `inventario/productos/{id}/unidades/` | GET, `productos.view_producto`; POST habilitar unidad |
| `inventario/productos/{id}/unidades/{unidad}/estado/` | POST habilitar/inhabilitar con versión |
| `inventario/productos/{id}/unidades/opciones/` | GET unidades activas todavía no configuradas |

Gestionar unidades, incluidos sus selectores, exige también
`inventario.gestionar_unidades_inventario`. La unidad base es implícita y no se
puede inhabilitar aquí. Los cambios no convierten existencias históricas.
POST de alta recibe `{"unidad": 2}`; cambiar estado recibe
`{"activo": false, "version": "..."}`. Se auditan ambas operaciones.

Lotes admite `buscar`, `almacen`, `producto`, `fecha` (ingreso) y
`estado=disponible|bloqueado|vencido`. Movimientos admite `buscar`, `almacen` y
`fecha`. Ambos ofrecen consulta histórica, incluso con referencias inactivas.

El estado controlado del lote es `disponible` o `bloqueado`. La disponibilidad
efectiva exige saldo positivo, ausencia de bloqueo/vencimiento y referencias
activas (producto, categoría, unidad y almacén), además de `calidad=apto`. El vencimiento se calcula
según la fecha de Bolivia, sin un estado persistido que pueda quedar obsoleto.
Bloquear conserva el saldo físico. Desbloquear un lote vencido o con
`calidad=aprovechable` se rechaza. Este último conserva `lote_origen` y el
enlace a su preparación, sin quedar disponible para atender pedidos.
El cambio recibe `{"estado": "bloqueado", "version": "..."}`.

No hay POST/PATCH/DELETE para crear lotes o modificar movimientos manualmente.
Los movimientos registrados son `entrada_recepcion` (entrada),
`salida_preparacion` (salida) y `entrada_aprovechable` (entrada). Conservan su
referencia a recepción o preparación y las líneas con cantidades reales. La
consulta de saldos aplica el signo por naturaleza. La preparación descuenta lo
utilizado, incluida la merma, y repone el aprovechable como material retenido
en otro lote; el futuro despacho no debe descontar de nuevo esos productos.
Nuevos procesos requieren su propio servicio, permisos y validaciones. No se
ofrece conversión de unidades, ajustes ni reversión de operaciones confirmadas.

La sesión publica `permisos_inventario`. `preparar_roles` crea
**Administrador de inventario** con sus cuatro permisos si no existe. Para
gestionar unidades desde Productos también se asigna «Ver productos».
No modifica roles previos ni asigna usuarios automáticamente.

Pantallas: `/lotes`, `/lotes/{id}`, `/movimientos-inventario` y
`/movimientos-inventario/{id}`. Las unidades se configuran en la ficha del
producto. Las fechas usan el calendario compartido y las cantidades se
muestran con su unidad, en español e inglés, con tema claro/oscuro.

Las pruebas de `recepciones` cubren el ingreso, los saldos, permisos de
inventario, configuración, fechas, inmutabilidad, auditoría y concurrencia
real de PostgreSQL.
