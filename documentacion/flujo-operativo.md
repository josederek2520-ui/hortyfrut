# Cómo trabajar con HortyFru

Esta guía corresponde a los módulos implementados actualmente. El trabajo diario
incluye Despachos, Mis viajes web con GPS consentido, supervisión y recepción en
Entregas. La [guía de Entregas](entregas_recepcion_sucursales.md) explica el registro
por sucursal, los rechazos y la confirmación de oficina.

## Cómo está organizado el menú

| Bloque | Opciones, en su orden del menú | Para qué se usa |
| --- | --- | --- |
| Operación diaria | Pedidos, Compras, Recepciones, Preparación de pedidos, Despachos, Entregas, Seguimiento de camiones, Mis viajes, Chat | Registrar la demanda, adquirir productos, prepararlos, repartir y conciliar lo recibido. |
| Inventario | Lotes, Movimientos de inventario, Cajillas, Almacenes | Consultar existencias, trazabilidad, recipientes y lugares de almacenamiento. |
| Catálogos y contactos | Clientes, Proveedores, Vehículos, Productos, Categorías de productos, Unidades de medida | Mantener los datos con los que se trabaja. |
| Administración | Usuarios, Roles y permisos, Registro de actividad | Administrar accesos y revisar quién realizó cada operación. |

**Mi cuenta** queda al pie del menú. Cada persona ve únicamente las opciones
para las que tiene permiso; un bloque sin opciones autorizadas se oculta.
Las sucursales se administran dentro de la ficha del cliente. Las presentaciones
y unidades adicionales de inventario se administran dentro de la ficha del producto.

## 1. Configuración inicial

Se realiza al comenzar y se actualiza cuando cambian los datos del negocio.
No hace falta repetirla cada día.

1. **Roles y permisos → Usuarios.** Define qué puede hacer cada persona, crea sus
   cuentas y asigna los roles correspondientes. Los responsables son Usuarios;
   no existe un módulo de Empleados. Mi cuenta permite gestionar el perfil propio.
2. **Unidades de medida → Categorías de productos → Productos.** Registra las
   unidades necesarias, las categorías (por ejemplo frutas y verduras) y los
   productos. Dentro del producto configura las presentaciones para compras y
   pedidos; en pedidos identifica las columnas Cajas (CANT) y Unidades (UNI).
   La unidad base queda habilitada para inventario y puedes habilitar otras
   unidades desde esa misma ficha. Las presentaciones no configuran equivalencias.
3. **Clientes → ficha del cliente → Sucursales.** Registra la empresa cliente y
   cada dirección de entrega, con su ubicación cuando corresponda. Si una persona
   del cliente registrará pedidos, asígnala como encargada de las sucursales que
   atenderá y dale los permisos de Pedidos. El personal de HortyFru puede tener
   permisos para consultar o gestionar los pedidos de todas las sucursales.
4. **Proveedores.** Registra a quién compras: nombre, contacto, dirección y
   categoría principal opcional. La fecha de creación se registra automáticamente.
5. **Almacenes.** Crea los lugares donde guardarás productos y cajillas, con
   dirección y coordenadas opcionales. Latitud y longitud se completan juntas.
6. **Cajillas.** Registra cada color y su cantidad inicial real en un almacén.
   Si no tienes existencias de un color, puedes crearlo con cero. Las cantidades
   posteriores cambian mediante ingresos, salidas y devoluciones.

## 2. Flujo de trabajo diario

**Pedidos → revisar Lotes → Compras si hace falta → Recepciones → Preparación.**

### Paso 1: registrar lo que necesita cada sucursal

En **Pedidos**, la sucursal asignada se carga automáticamente y queda fija.
Si tienes varios destinos autorizados, elige uno antes de abrir la hoja. El
cliente aparece junto al nombre de la sucursal, sin un campo duplicado. Selecciona
la fecha requerida y agrega productos y sus
cantidades CANT/UNI. La fecha requerida indica para qué día se solicita el pedido,
aunque se registre otro día. Cada sucursal conserva su propio pedido.

Guardar un pedido no mueve inventario. Cajas y unidades son cantidades
independientes: escribir una caja no calcula automáticamente unidades o kg.
El responsable y la fecha del pedido son automáticos. La hoja no incluye
Observaciones; las asignaciones se administran en Clientes → Sucursales.
La hoja permite revisar «Ver resumen» y, al guardar, vuelve al listado principal.
Desde las acciones de ese listado puedes editar o cancelar cuando corresponda.
Cancelar solo pide confirmar el pedido, sin escribir un motivo; se conserva su
historial, responsable de la cancelación y fecha.

### Paso 2: revisar qué tienes disponible

En **Lotes**, consulta producto, almacén, saldo, unidad, vencimiento y
disponibilidad. Si ya tienes suficiente mercadería apta, puedes ir directamente
a Preparación. Si faltan productos, registra las compras necesarias.

El saldo físico y la disponibilidad para pedidos se consultan por lote; el
material bloqueado, vencido o separado como aprovechable no se utiliza para
preparar pedidos. No se mezclan kg con otras unidades en un único saldo.

### Paso 3: registrar la compra

En **Compras → Nueva compra**, usa sus dos fechas:

- **Pedidos para:** fecha requerida que quieres consultar. Muestra la demanda
  de ese día por producto o sucursal.
- **Fecha de compra:** día en que realmente adquiriste los productos.

Registra proveedor, producto, presentación o unidad, cantidad adquirida y precio.
Puedes guardar un borrador y registrar la compra cuando esté completa. Los
pedidos consultados son una referencia; revisa lo ya preparado y las existencias
antes de decidir cuánto comprar. Registrar una compra no ingresa mercadería al
almacén ni completa pedidos.

### Paso 4: recibir físicamente la mercadería

Desde una compra registrada, abre **Recepciones** y elige el almacén. Indica
cuánto llegó de la compra y cuánto mediste realmente para inventario. Una compra
puede recibirse por partes.

Por ejemplo, puedes recibir 8 cajas compradas y pesar 120 kg. Ambos datos se
registran por separado: el sistema no supone cuántos kg tiene una caja. Revisa
la fecha de recepción y el vencimiento, si corresponde.

**Confirmar la recepción** crea los lotes y el movimiento de entrada. Un borrador
todavía no cambia las existencias. También se puede registrar una recepción
directa para mercadería inicial u otros ingresos reales, indicando el motivo.

### Paso 5: preparar los pedidos del cliente y del día

En **Preparación de pedidos**, selecciona fecha requerida y cliente. La hoja
agrupa los productos de sus pedidos, muestra cada sucursal y calcula el total
del cliente manteniendo CANT/UNI separadas. Filtra por categoría, consulta lo
solicitado o lo pendiente e imprime la hoja completa si la necesitas.

Pulsa **Preparar** y sigue los cuatro pasos:

1. **Lotes y calidad:** elige almacén y los lotes que vas a utilizar. Si separas
   merma o aprovechable, registra sus cantidades y el motivo.
2. **Reparto por sucursal:** indica cuántas CANT/UNI atiendes y las cantidades
   físicas medidas de cada lote. Puedes completar una caja usando varios lotes;
   esa caja se cuenta una vez. El peso se registra realmente, sin conversiones.
3. **Cajillas:** anota opcionalmente el color y cantidad que prevés usar por
   sucursal. Es una previsión; todavía no modifica su inventario.
4. **Revisión:** comprueba los datos, guarda el borrador y confirma expresamente
   cuando la preparación física sea correcta.

**Confirmar la preparación** descuenta las cantidades utilizadas y registra su
salida en Movimientos de inventario. La merma sale del inventario; el aprovechable
se conserva en otro lote bloqueado, con su origen y motivo. Los borradores no
reservan ni descuentan existencias.

Puedes preparar por partes. El pedido sigue pendiente mientras falte alguna
cantidad y pasa a preparado cuando todas sus líneas quedan atendidas. Un pedido
con preparación confirmada ya no admite edición o cancelación ordinaria. Las
preparaciones confirmadas conservan su historial y no se editan ni cancelan.

## 3. Consultas y controles de apoyo

- **Movimientos de inventario:** consulta qué recepción ingresó los productos
  y qué preparación los utilizó. El saldo se calcula con estos movimientos.
- **Cajillas:** registra ingresos reales, salidas a sucursales y devoluciones
  parciales. Una salida reduce el disponible del almacén y deja pendiente a la
  sucursal; una devolución lo reduce y devuelve cajillas al almacén receptor.
  Las operaciones manuales se registran cuando ocurren físicamente. En los
  despachos, iniciar mueve cajillas al vehículo y descargar las entrega a la
  sucursal. La previsión de Preparación no registra movimientos.
- **Registro de actividad:** revisa responsable, fecha y cambios de las
  operaciones, según los permisos asignados.
- Los listados muestran **10 registros por página**. Las fechas de creación
  y los usuarios responsables se registran automáticamente.

## 4. Ejemplo para seguir de principio a fin

Ejemplo ilustrativo; no representa datos cargados automáticamente al sistema:

1. Un cliente tiene las sucursales Centro y Norte. Para el mismo día, Centro
   pide 2 cajas de papaya y Norte pide 3. La hoja del cliente muestra 5 CANT.
2. Revisas Lotes. Si no hay stock suficiente, registras una compra real y
   confirmas su recepción; supongamos que ingresas 100 kg efectivamente pesados.
3. En Preparación atiendes las 2 cajas de Centro con 20 kg medidos y las
   3 de Norte con 30 kg medidos. Estas cifras son mediciones del ejemplo,
   no una equivalencia configurada de kg por caja.
4. Si no hubo separación de calidad, confirmar utiliza 50 kg: quedan 50 kg
   en el lote. Cada pedido pasa a preparado si no tenía otras líneas pendientes.
5. Si planificas 5 cajillas verdes, el inventario de cajillas todavía conserva
   su saldo. La salida real se registra cuando se envían físicamente.

## 5. Vehículos y despachos

En **Vehículos**, registra placa y tipo, junto con marca, capacidad declarada y
foto si corresponden. Asigna a los usuarios choferes el permiso «Ser asignado
como chofer» desde Roles; no se necesita un módulo de Empleados.

En **Despachos → Nuevo despacho**, sigue la hoja:

1. **Carga:** elige almacén y fecha de reparto; marca las sucursales con carga
   confirmada. Una sucursal reúne sus productos aunque ocupen varias páginas.
   En **Ver productos** puedes ajustar las cantidades preparadas que viajarán;
   cada cantidad conserva todos sus aportes de lotes. La fecha del pedido es un
   filtro opcional independiente de la fecha del viaje.
   Cada sucursal muestra sus pedidos con código, fecha requerida y cantidades
   preparadas. Puedes incluir un pedido o toda la carga de esa sucursal.
   Cambiar filtros conserva lo elegido y avisa si hay carga de otras fechas.
2. **Transporte y ruta:** asigna vehículo y usuario chofer, ordena las sucursales
   y revisa las cajillas reales por color. El resumen muestra el peso y la
   capacidad del vehículo en toneladas.
3. **Revisión:** guarda el borrador y comprueba los datos antes de iniciar.
   Para guardar un borrador también se necesitan vehículo y chofer.

Iniciar registra la salida real y mueve las cajillas del almacén al vehículo.
La misma carga no se asigna a dos despachos activos, y vehículo/chofer no pueden
tener dos viajes en ruta. Cancelar un borrador libera su carga y conserva la
historia. Un viaje iniciado ya no se edita ni cancela como borrador.

En la ficha registra llegada a la siguiente sucursal, comprueba cada producto y
confirma la descarga. Esto registra cajillas entregadas y su pendiente por
sucursal. Finaliza el viaje al completar todas las descargas. Los productos
conservan la salida de Preparaciones, sin otro descuento. La aceptación de pesos
por la sucursal se conciliará en Entregas.

## 6. Continuación pendiente de implementar

El siguiente tramo es **Mis despachos y GPS → Entregas**, para trabajar desde el
espacio propio del chofer, compartir ubicación voluntariamente y conciliar los
pesos aceptados por la sucursal. El recorrido administrativo ya se registra en
Despachos; no se genera una segunda salida de productos.
