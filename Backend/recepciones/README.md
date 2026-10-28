# Recepciones e ingreso de inventario

Pantallas: `/recepciones`, `/recepciones/nuevo`, `/recepciones/{id}` y
`/recepciones/{id}/editar`. Desde una compra registrada se puede abrir
`/recepciones/nuevo?compra={id}` o consultar sus recepciones.

## Hoja de recepción

El listado usa una cabecera única e indicadores compactos de Borradores,
Confirmadas y Canceladas. Los indicadores filtran por estado y muestran su
selección; pulsar el seleccionado o Todas vuelve al conjunto completo.
La búsqueda, fecha y compra de origen se conservan y la paginación vuelve a 1.
Los contadores corresponden a la búsqueda/fecha/compra y no se reducen por el
estado seleccionado. Los listados mantienen páginas fijas de 10.

La hoja reúne Compra, Almacén y Fecha de llegada en una cabecera compacta.
Hoy es el valor inicial y, cuando existe un único almacén activo, se selecciona
automáticamente. Los selectores tienen búsqueda y se abren anclados al campo.
El origen Sin compra conserva un motivo visible; las notas de compras son
opcionales y desplegables.

Elegir una compra muestra automáticamente sus pendientes, con 10 líneas por
página, búsqueda y proveedor por línea. El filtro se aplica antes de paginar.
Las cantidades empiezan vacías y los cambios se conservan al navegar entre
páginas o cambiar entre Productos de la compra y Anotados. Ver una fila o elegir
su unidad no la contabiliza como recibida: las filas sin cantidades ni datos
adicionales se omiten del documento enviado. Los errores se reasignan al índice
visible correspondiente después de omitirlas.

Llegó hoy expresa lo recibido de la compra y Para el almacén expresa la medición
real. Cuando no hay presentación y la unidad base comprada coincide exactamente
con la elegida para inventario, un único campo escribe ambas cantidades. No hay
conversión por nombre ni por abreviatura. Cambiar la unidad borra la medición
y el peso anteriores; Más datos muestra vencimiento y peso adicional opcionales.
En pantallas pequeñas se conservan los mismos campos en tarjetas por producto.

Guardar borrador conserva datos incompletos. Revisar ingreso valida todas las
líneas anotadas, guarda el borrador y abre el resumen que devuelve el servidor.
Confirmar entrada al almacén invoca la operación existente desde esa misma hoja;
solo entonces se generan existencias. Volver a la hoja conserva los datos y la
versión guardados. El rol con crear/confirmar sin editar puede revisar y confirmar
su borrador, pero sus campos quedan bloqueados tras guardarlo. La confirmación
conserva su UUID durante los reintentos del mismo diálogo.

## Reglas de negocio

- El origen habitual es una compra **registrada**. Una recepción puede contener
  parte de sus líneas y cantidades; otras recepciones completan el pendiente.
  Los borradores no reservan cantidades ni modifican existencias.
- También se permite un ingreso directo, sin compra, para existencias iniciales
  u otros ingresos físicos. Se documenta su motivo en observaciones. El origen
  de una recepción guardada es inmutable.
- `cantidad_compra` expresa lo recibido en la presentación o unidad histórica
  de la línea comprada. `cantidad_inventario` expresa la medición real en una
  unidad habilitada para ese producto. Son datos independientes: 8 cajas pueden
  corresponder a 120 kg pesados. No se calculan equivalencias.
- Cuando la compra no tiene presentación y ambas cantidades usan la misma
  unidad del catálogo, deben coincidir al confirmar.
- La unidad base del producto está implícitamente habilitada. Las adicionales
  se gestionan en su ficha, sin factores de conversión. Inhabilitar una unidad
  adicional impide nuevos ingresos y confirmaciones con ella; conserva los
  lotes y movimientos anteriores. Una abreviatura utilizada en lotes o
  recepciones no canceladas no puede cambiar su significado.
- `peso_kg` es opcional y corresponde a un peso realmente medido. Con la
  unidad cuya abreviatura es `kg` (sin distinguir mayúsculas), coincide con la
  cantidad de inventario; no es una conversión de otra unidad.
- La recepción no puede tener fecha futura ni ser anterior a su compra.
  El vencimiento es opcional y no puede ser anterior al ingreso. Registrar
  tardíamente un lote ya vencido conserva su saldo físico, sin disponibilidad.
- Al confirmar se revalidan producto, categoría, unidad habilitada, almacén,
  fecha y cantidades. Se crea un lote por línea y un único movimiento de
  entrada con sus detalles, todo en la misma transacción que la auditoría.
- Una recepción confirmada es inmutable. Solo los borradores se editan o
  cancelan; cancelar no genera movimientos. No se implementan anulaciones de
  ingresos confirmados ni ajustes manuales de saldos en este bloque.
- Compras no puede cancelarse mientras tenga recepciones no canceladas.
  Pedidos y sus estados no se modifican al recibir productos.
- El responsable se vincula a Usuarios. Se conserva quién creó la recepción
  y quién confirmó el ingreso; no se crea un módulo de Empleados.

## API

Todas las rutas parten de `/api/v1/`. Listados y selectores usan `pagina`
con tamaño fijo **10**. Los detalles de una recepción conservan su documento
completo (máximo 500 líneas); la interfaz muestra 10 líneas por página.

| Ruta | Operación |
| --- | --- |
| `recepciones/` | GET listado; POST borrador |
| `recepciones/{id}/` | GET detalle; PATCH documento completo en borrador |
| `recepciones/{id}/confirmar/` | POST confirmar e ingresar existencias |
| `recepciones/{id}/cancelar/` | POST cancelar borrador con motivo |
| `recepciones/resumen/` | GET contadores por los filtros actuales |
| `recepciones/compras/` | GET compras registradas con pendiente |
| `recepciones/compra-origen/?compra={id}` | GET código, fecha y existencia de pendientes |
| `recepciones/compra-detalles/?compra={id}` | GET líneas y avance recibido, sin precios |
| `recepciones/almacenes/` | GET almacenes activos |
| `recepciones/productos/` | GET productos activos para ingreso directo |
| `recepciones/unidades/?producto={id}` | GET unidades activas habilitadas |

Filtros del listado: `buscar`, `estado`, `compra`, `almacen`, `fecha` (ISO).
Los selectores admiten `buscar`. Estas consultas proporcionan solo los datos
necesarios para recibir, sin conceder permisos administrativos sobre Compras,
Productos o Almacenes.

`compra-detalles` admite `solo_pendientes=true` y conserva la consulta completa
original si se omite. Añade `proveedor_nombre` y `unidad_compra` (ID de la unidad
base cuando no hay presentación, null en otro caso), sin exponer precios.
El detalle de recepción añade esos campos y `cantidad_pendiente`, calculada
desde recepciones confirmadas. Estos datos son de lectura; las validaciones y el
bloqueo al confirmar continúan en el servicio central.

Creación:

```json
{
  "compra": 3,
  "almacen": 1,
  "fecha_recepcion": "2026-10-26",
  "observaciones": "Llegada parcial",
  "clave_operacion": "22986bee-6535-4eb6-b1e8-0f10624c6947",
  "detalles": [
    {
      "detalle_compra": 7,
      "producto": 2,
      "unidad_inventario": 1,
      "cantidad_compra": "8.000",
      "cantidad_inventario": "120.000",
      "peso_kg": null,
      "fecha_vencimiento": null
    }
  ]
}
```

Los identificadores del ejemplo son ilustrativos. En un ingreso directo se
envía `compra: null`, `detalle_compra: null` y `cantidad_compra: "0"`.
Se permiten cantidades cero en borrador; confirmar exige al menos una línea
y cantidades positivas. PATCH sustituye el documento, conserva los `id` de
las líneas existentes, incluye `version` y omite `clave_operacion` de creación.
Los errores de línea se identifican como `detalle_{indice}_{campo}`.

Confirmar recibe `version` y un UUID `clave_operacion`. Cancelar añade
`motivo`. Los reintentos con la misma clave y actor no duplican operaciones.
Una clave de creación con otra carga, versiones desactualizadas y operaciones
incompatibles devuelven 409. Las entradas controladas por el servidor no se
aceptan en el formulario.

## Permisos, auditoría y concurrencia

`recepciones.view_recepcion` es necesario junto con el permiso de crear,
editar, confirmar o cancelar para cada acción. La sesión los publica en
`permisos_recepciones`. `preparar_roles` crea **Administrador de recepciones**
si no existe, sin ampliar roles anteriores ni asignar cuentas.

La capa HTTP registra lecturas y rechazos. Los servicios `guardar_recepcion`,
`confirmar_recepcion` y `cancelar_recepcion` aplican permisos, validaciones y
auditoría también fuera de HTTP. La rutina privada de inventario solo se llama
desde la confirmación validada y atómica. Si falla la evidencia de negocio,
se revierte toda la escritura, incluidos lotes y movimientos.

Todas las escrituras de una recepción vinculada bloquean primero la compra
y después la recepción. Confirmación y cancelación de compra comparten ese
bloqueo. Dos recepciones concurrentes recalculan el recibido confirmado antes
de aceptar cantidades; no pueden superar el pendiente. Las referencias se
bloquean en orden estable para serializar cambios de estado/configuración.
La edición usa una versión opaca; PostgreSQL impone unicidad de claves,
orígenes, vínculos y cantidades válidas.

Consulta [Inventario](../inventario/README.md) para saldos y trazabilidad.

Verificación del flujo desde Frontend:

```bash
node --test pruebas/flujo_recepciones.mjs
npm run build
```
