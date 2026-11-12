# Ventas y saldos

Ruta local `/ventas`, en **Comercial**, después de Precios acordados. Implementa
el resumen de venta comercial del paso F18 del documento de referencia. No es
una factura fiscal. No crea cobros ni permite marcar manualmente una venta como
pagada: el registro y aplicación de pagos corresponde a la etapa posterior Cobros.
Hasta esa integración, una venta emitida tiene cobrado cero y saldo igual al total.

## Flujo y pantalla

1. **Nueva venta** elige un supermercado activo. Las fechas filtran la fecha real
   de recepción en la sucursal, no la fecha de creación del pedido o del acuerdo.
   Se pueden reunir uno o varios días y varias sucursales del mismo supermercado.
2. **Elegir entregas** muestra entregas confirmadas con kilos aceptados positivos
   que aún no se incluyeron en una venta. Búsqueda por sucursal, pedido o entrega;
   páginas de diez, selección persistente entre páginas y vista Elegidas. Cambiar
   las fechas conserva la selección y señala entregas fuera del nuevo período;
   el guardado exige corregir ese caso. No se eligen filas sin precios aceptados.
3. **Guardar borrador** conserva cliente, período, vencimiento opcional y selección.
   No reserva entregas ni fija precios. Hasta 100 entregas y 500 líneas por venta.
   Dos borradores pueden elegir la misma entrega sin crear un cobro duplicado.
4. **Revisar venta** guarda primero si hay cambios, utiliza la versión devuelta y
   muestra kilos aceptados, precio por kg e importe. Los pedidos, lotes y acuerdos
   quedan en Ver trazabilidad. La tabla de líneas se pagina de diez en servidor.
5. **Emitir venta** requiere confirmación con el importe y una revisión vigente.
   Conserva los datos históricos y excluye las entregas de nuevas ventas.
   El documento emitido no se edita ni cancela. Solo se cancelan borradores.
6. **Descargar PDF** produce un resumen privado, con texto seleccionable, columnas
   repetidas entre páginas y la leyenda Sin valor fiscal. No acredita un pago.

El listado muestra supermercado, período, total, saldo y estado. Sus contadores
respetan los mismos filtros antes de paginar de diez. Diferencia el primer uso,
los filtros sin coincidencias y los fallos de conexión. Las fichas y filas se
adaptan a pantallas pequeñas; tema claro/oscuro, foco, campos de fecha compartidos,
notificaciones y confirmaciones reutilizan el diseño existente. Español e inglés.

## Cálculos y evidencia histórica

- Peso aceptado = kg recibidos confirmados menos kg rechazados confirmados.
  CANT y UNI conservan su independencia: nunca se convierten en kilos.
- `precios.consultas.precio_para_entrega` resuelve la línea del acuerdo aceptado.
  Una entrega específica tiene prioridad; por período usa la fecha requerida del
  pedido. No se inventa un precio si falta ni se admite un precio ambiguo.
- Se redondea a dos decimales, `ROUND_HALF_UP`, una vez por producto y entrega.
  Los centavos de los aportes se distribuyen por mayor resto, con desempate estable
  por aporte. Los pesos originales no se reparten ni se alteran.
- La emisión guarda cliente/NIT, producto, sucursal, pedido, entrega, fecha requerida,
  fecha de recepción, línea y versión del acuerdo, precio, kilos e importe. Cada
  aporte conserva lote, kilos aceptados e importe. Los cambios de catálogo o una
  nueva versión del acuerdo no reescriben documentos emitidos.
- Devoluciones conserva su tratamiento físico independiente. Recibir una devolución
  no cambia esta venta ni produce automáticamente descuentos o documentos de crédito.

## Integridad y permisos

Seis permisos independientes: consultar, crear, editar borradores, emitir, cancelar
borradores y descargar. Se registran en Roles y en la sesión, sin asignaciones
automáticas. No requieren permisos adicionales de administrar clientes, productos
o precios. La administración local conserva la decisión de concederlos.

Todas las escrituras exigen sesión/CSRF, autorización fresca, versión y UUID ligado
al cuerpo y responsable. El reintento de una respuesta incierta conserva exactamente
su cuerpo y UUID y bloquea otras operaciones hasta comprobarlo. Salir o cambiar de
sesión descarta respuestas tardías. El navegador protege cambios sin guardar.

Orden de bloqueo: cliente, entregas ordenadas y venta. El cliente comparte el
bloqueo de aceptación de precios, evitando emitir durante una sustitución del
acuerdo. La revisión tiene una huella de contenido: si cambian precios, pesos o
datos relevantes, hay que revisar de nuevo. Restricciones únicas de entrega,
línea de entrega y aporte impiden duplicados, también bajo concurrencia.

La auditoría HTTP y el servicio central conservan crear/guardar, emitir, cancelar
y descargar. Un reintento o guardado sin cambios no aumenta la actividad principal.
Un fallo de auditoría revierte la emisión. No se alteran inventario, cajillas,
pedidos, entregas, viajes o GPS. Las rutas no se publican por la pasarela HTTPS.

## Archivos y comprobaciones

- `Backend/ventas/`: modelos, migración, permisos, consultas, cálculos, servicios,
  representaciones, API, documento PDF y pruebas de integración/concurrencia.
- `Frontend/src/components/ventas/`: listado, hoja, selección, revisión y descarga.
- `Frontend/pruebas/ventas.mjs`: selección entre páginas, exactitud monetaria,
  revisión, reintentos, doble envío, cambio de sesión, accesibilidad y traducciones.
- ReportLab 5.1.0 se añadió con autorización expresa del usuario. Usa las fuentes
  Vera incluidas en la dependencia; no necesita servicios externos para el PDF.
- `lib/moneda.ts` conserva Bs y ahora formatea importes decimales de texto mediante
  enteros exactos, sin perder centavos en valores grandes.

La comprobación visual del PDF utiliza archivos ficticios privados bajo `.local/ventas/`.
No se crean ventas de demostración en la base habitual ni se automatiza el navegador.

Validación del 11/11/2026: 21 pruebas de Ventas aprobadas, incluidas entregas de
varios días, concurrencia, permisos, CSRF y descarga. Las pruebas relacionadas de
Precios, Entregas, Devoluciones, Usuarios, Roles y Auditoría también se verificaron.
Las 352 pruebas del frontend pasan; TypeScript y ESLint del módulo no presentan
errores. La compilación incluye las tres rutas de Ventas. El PDF se comprobó en
español e inglés con 32 líneas y cuatro páginas.

La migración `ventas.0001_initial` está aplicada en la base local. Antes se creó y
verificó una copia PostgreSQL bajo `.local/ventas/20261111-153547/`; tras migrar se
compararon las asignaciones de usuarios y roles con la copia previa: no cambiaron.
