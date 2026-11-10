# Entregas y recepción de sucursales

La hoja digital reúne lo enviado y lo recibido siguiendo la hoja física de
HortyFru. Su origen es la carga de un pedido en un viaje, cuya descarga ya
confirmó el chofer. Admite viajes en curso y finalizados y varios envíos parciales
del mismo pedido, conservando cada recepción por separado.

## Uso

1. En Roles y Usuarios, asignar el rol de recepción al Usuario correspondiente.
   En Clientes → Sucursales, seleccionar el encargado de recepción. Si este campo
   queda vacío se usa el encargado de pedidos cuando tenga permisos de Entregas.
2. Entrar en **Entregas**. El listado reúne únicamente las descargas completas de
   cada pedido en su viaje, con búsqueda, estado y fecha de reparto.
3. Abrir una recepción. Enviado muestra cajas, unidades y kg de la carga real.
   Registrar fecha de recepción y las cantidades físicas recibidas. «Recibido por»
   toma automáticamente al Usuario activo encargado de pedidos de la sucursal;
   indicar cero cuando corresponda, sin copiar automáticamente el envío.
4. Si hubo rechazo, registrar kg, motivo y cajas/unidades rechazadas cuando
   corresponda. Las cantidades rechazadas no pueden superar las recibidas.
5. Adjuntar opcionalmente una foto o PDF de hasta 8 MB. Guardar conserva un
   borrador; Enviar a revisión valida todos los productos, también otras páginas.
6. La oficina revisa la hoja y las diferencias. Con varios aportes de lotes,
   distribuye explícitamente kg recibidos y rechazados por aporte. Puede devolver
   a borrador para corregir o confirmar. Confirmar vuelve la hoja inmutable.
7. Pedidos permite consultar la recepción confirmada desde el listado y muestra
   sus cantidades acumuladas en las columnas de Recepción cuando se consulta la hoja.

Ejemplo: enviado 7 kg, recibido 6,8 kg y rechazado 0,3 kg dejan aceptado 6,5 kg.
La diferencia de envío es 0,2 kg y se muestra por separado. No se convierten cajas
en kg ni se cambia lo solicitado por la sucursal.

## Interfaz de recepción

El ajuste del 10 de noviembre de 2026 identifica al receptor desde
`Sucursal.encargado_pedidos`, con un vínculo a Usuario y una copia de su nombre al
guardar. El campo es de solo lectura y el backend ignora los nombres manuales del
contrato legado. La cuenta que registra y la que confirma siguen siendo evidencia
independiente. Un encargado ausente o inactivo permite guardar borrador, pero
bloquea enviarlo. La migración es aditiva y no atribuye usuarios a nombres antiguos:
los registros históricos conservan su texto original. Cambiar una asignación antes
de crear exige una nueva versión; los reintentos conservan su cuerpo y la identidad
ya registrada. Los cambios posteriores de nombre o asignación no reescriben el receptor.

El listado separa Por recibir, Borradores, En revisión y Confirmadas. Sus contadores
respetan el alcance y los filtros de búsqueda/fecha antes de paginar, y no dependen
de la pestaña seleccionada. Las acciones de cada fila se resuelven con autorización
de esa sucursal. La hoja distingue registro de sucursal, revisión de oficina y
confirmación; el pie conserva el avance de todos los productos. Los permisos y la
asignación explícita de encargado de recepción permanecen compatibles; no se otorgan
roles al asignar automáticamente el nombre del receptor.

Validación del ajuste: 47 pruebas de Entregas/Devoluciones en PostgreSQL aislado,
341 pruebas web, TypeScript, ESLint y compilación de producción correctos. Las
vistas aisladas con datos ficticios cubren acceso, listado y hoja en ambos temas,
incluidos anchos de 320 y 390 px sin desbordamiento horizontal. La migración
aditiva del vínculo de receptor está aplicada en el entorno local.

El ajuste del 8 de noviembre de 2026 mantiene el tema compartido Cristal salvia
claro, tarjetas blancas y superficies oscuras equivalentes. El listado etiqueta
por separado la fecha de reparto y la descarga confirmada; el filtro conserva
su significado de fecha de reparto. `fecha_reparto` se añadió únicamente a la
respuesta del listado, sin alterar el origen persistido, la versión ni su huella.

Cada fila presenta estado con texto e icono y una acción según los permisos:
Registrar recepción, Continuar registro, Revisar recepción o Ver recepción.
Los filtros tienen etiquetas visibles, limpieza conjunta y un estado vacío
distinto cuando no hay coincidencias. Los listados conservan diez registros.

La hoja separa Enviado de Recibido; en móvil las cajas y unidades comparten una
fila y el peso ocupa el ancho completo. El rechazo se abre explícitamente y
conserva lo anotado al plegar; explica que está incluido en lo recibido. Cada
producto distingue falta, exceso, coincidencia o medición pendiente, sin usar
el rechazo para calcular la diferencia de envío ni convertir cantidades.

El avance cuenta productos completos de toda la hoja, también fuera de la página
o búsqueda visibles. Antes de enviar o confirmar, la interfaz señala cabecera,
cantidades, rechazo y motivo incompletos; el backend sigue revalidando. Guardar
borrador mantiene la captura incompleta permitida. El resumen de errores permite
navegar a la página y campo afectados, con foco visible. Un fallo de consulta de
la hoja, productos o aportes tiene reintento independiente; las operaciones
inciertas conservan su UUID y cuerpo original.

La conciliación de oficina muestra las sumas y los kg pendientes o excedentes
de todos los aportes del producto. Las cantidades se distribuyen manualmente y
se validan con decimales exactos, incluidos los aportes de otras páginas. Un
aporte único se muestra como referencia derivada de la recepción y su vínculo
se sigue guardando únicamente al confirmar mediante el servicio existente.

La recepción confirmada presenta valores de solo lectura, quién recibió,
fecha, responsable de registro, fecha/responsable de confirmación y descarga
del comprobante privado. No muestra campos de captura ni carga de archivos.
El adjunto seleccionado se distingue del comprobante ya guardado. Los textos
del módulo se corrigieron en UTF-8 y las claves nuevas se mantienen en español
e inglés. Los permisos y el alcance propio de HTTPS permanecen independientes
de la presentación; la revisión de oficina se muestra solo en acceso local.

## Acceso local y HTTPS

La oficina usa `/entregas` en la administración local. Los encargados pueden usar
`/entregas` en el mismo origen temporal HTTPS del chofer y Chat, con su cuenta y
permisos. El público está limitado a sucursales propias, aunque la cuenta tenga
otros permisos: revisión y confirmación global quedan en local. El enlace
temporal vigente se consulta en `.local/chofer_https/enlace.txt`.

El módulo conserva responsable de registro, persona que recibió, fecha,
responsable de confirmación y evidencia auditada. Los adjuntos son privados.
No se ha asignado automáticamente ningún rol nuevo a cuentas existentes.

## Relación con el inventario

Confirmar Preparaciones ya descontó los productos. Registrar, enviar y confirmar
Entregas no producen movimientos de inventario ni de cajillas. La descarga física,
el cierre del viaje y la conciliación de recepción son acciones independientes.
Los productos rechazados no ingresan al almacén hasta que se registre su regreso
físico en Devoluciones. Este módulo se incorporó posteriormente, el 9 de noviembre
de 2026, con recepción retenida y clasificación exclusiva en aprovechable y merma.
Detalle en [Devoluciones de productos](devoluciones_productos.md).

La validación técnica utiliza una base aislada, pruebas de permisos, páginas,
versiones, UUID, concurrencia, precisión, adjuntos y conservación de inventario.
La comprobación visual y el registro físico en el dispositivo quedan a cargo del
usuario; no se automatiza su navegador ni su escritorio.

Comprobación técnica inicial de esta implementación: 148 pruebas de backend en PostgreSQL
aislado, 276 pruebas web y 7 de la pasarela correctas; TypeScript, ESLint y las
compilaciones de las rutas correctas. Las migraciones aditivas y los roles nuevos
están disponibles en el entorno local, sin asignaciones automáticas de usuarios.

El 5 de noviembre de 2026 se recompiló y reinició el acceso HTTPS para incluir
Entregas. Se comprobó el enlace público con sesión obligatoria, CSRF seguro y
bloqueo de las rutas administrativas y de confirmación/devolución. La navegación
HTML/RSC del listado y la hoja pasó con una cuenta ficticia; la administración
local siguió respondiendo. El enlace temporal vigente permanece en
`.local/chofer_https/enlace.txt`.

El ajuste de UX del 8 de noviembre pasó 292 pruebas web (incluidas recepción,
validación entre páginas, conciliación exacta y consulta inmutable) y 21 pruebas
del backend de Entregas en PostgreSQL aislado. TypeScript, ESLint y compilación
de producción correctos. Las comprobaciones de formato conservan los finales
de línea existentes de las traducciones. La comprobación visual de escritorio,
móvil y ambos temas permanece manual; no se automatiza el navegador del usuario.
