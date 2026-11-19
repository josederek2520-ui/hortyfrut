# Precios acordados

El supermercado propone cuánto pagará por kilogramo de cada producto y
HortyFru acepta o rechaza la propuesta en la oficina. La cuenta del supermercado
registra su lista según los productos de sus pedidos. La oficina conserva la
captura interna y los acuerdos históricos. El acceso HTTPS se limita a propuestas
propias; aceptar/rechazar y la revisión global siguen siendo locales.

## Cuenta del supermercado

1. Crear un Usuario activo y asignarle explícitamente el rol **Responsable de
   precios de supermercado**. `preparar_roles` crea la plantilla si falta, sin
   asignarla a cuentas ni modificar roles existentes.
2. En **Clientes → Editar → Responsable de precios del supermercado**, elegir
   la cuenta y guardar. Requiere `clientes.asignar_encargado`; la asignación no
   otorga permisos. El selector exige consultar/crear precios y el permiso de
   alcance `proponer_precios_propios`, y excluye superusuarios.
3. La cuenta accede a **Comercial → Mis precios**, `/precios-acordados`. Si tiene
   un único cliente asignado, se elige automáticamente; con varios, solo puede
   seleccionar sus supermercados activos.
4. Elegir **Un día** o **Varios días**. Se reúnen productos únicos de los pedidos
   de todas sus sucursales por fecha requerida, excluyendo cancelados. No se
   muestran cajas, unidades ni cantidades. Cada precio en Bs/kg se escribe
   manualmente y los productos nuevos llegan sin precio.
5. Las tarjetas muestran foto actual, producto y precio: una columna en móvil,
   dos en pantallas medianas y tres en grandes, con búsqueda y páginas de diez.
   **Actualizar productos** conserva los precios de productos que continúan
   solicitados; pide confirmación si ya hay importes, igual que cambiar período.
6. **Guardar borrador** admite precios pendientes. **Revisar y enviar → Enviar
   precios a HortyFru** deja la lista pendiente de aceptación y vuelve al listado
   al confirmar el envío, también tras comprobar un envío con respuesta incierta.
   Si solo se recupera el guardado del borrador, se conserva la hoja para enviarlo.
   El supermercado
   cancela solo borradores y puede crear correcciones de acuerdos por período.

El listado separa propuesta, período de aplicación, número de productos y estado;
los períodos de un día muestran la fecha una sola vez. En pantallas pequeñas,
las filas se apilan con etiquetas. Conserva filtros, actualización y páginas de
diez, con el total de propuestas de la consulta actual.

La consulta de la propuesta muestra el supermercado y **Precios para los pedidos
del**, con la fecha requerida o su período. Un solo día se presenta una vez;
la fecha de envío queda separada junto a su responsable. Se omite la referencia
vacía y el buscador comparte cabecera con Productos y precios. Los acuerdos de
entregas específicas conservan su alcance y consulta de las entregas elegidas.
La revisión, aceptación, rechazo e historial mantienen sus permisos y controles.

El origen se consulta en páginas de diez con una huella común: solo se aplica
el conjunto completo cuando coincide en todas las páginas. Cambiar cliente o
período descarta respuestas tardías. Se mantiene el límite de 500 productos.
Abrir un borrador guardado conserva sus productos hasta actualizarlos
explícitamente. Guardar y enviar vuelven a comprobar la pertenencia a los pedidos;
la propuesta enviada permanece inmutable aunque después cambien esos pedidos.
Las correcciones conservan los productos y el alcance originales.

## Uso

Acceso en **Comercial → Precios acordados**, ruta `/precios-acordados`.

1. Crear una propuesta y elegir el supermercado.
2. Elegir el alcance: **Por fechas**, con ambas fechas inclusivas, o
   **Entregas específicas**, seleccionando recepciones confirmadas del cliente.
3. Agregar productos y escribir manualmente el precio de cada uno en Bs/kg.
   Se admiten coma o punto y hasta dos decimales, sin redondeos automáticos.
   Un borrador puede conservar precios pendientes.
4. **Revisar propuesta** muestra toda la lista antes de **Registrar propuesta**.
5. Una persona con permiso de aceptación revisa y pulsa **Aceptar precios**.
   También puede rechazar la propuesta indicando un motivo.

Los estados son Borrador, Pendiente de aceptación, Aceptado, Rechazado y
Cancelado. Solo se editan y cancelan borradores. Registrar una propuesta no
equivale a aceptarla y los permisos de ambas operaciones son independientes.

El precio se comparte por producto y supermercado, sin repetirlo por cada
sucursal. La vigencia por fechas se resuelve con `Pedido.fecha_requerida`,
independiente del día de despacho, descarga o recepción. Un alcance de un día
usa la misma fecha inicial y final. Una semana utiliza sus dos fechas reales.
Los precios para entregas específicas tienen prioridad sobre los generales
para esas entregas y productos.

## Cambios e historial

Un nuevo período puede tener una nueva lista. Si se corrige un acuerdo ya
aceptado, **Nueva versión** copia sus productos y precios, exige un motivo y
permite cambiar los importes. Conserva cliente, productos, fechas y entregas
del original. Para otro alcance o productos se registra otra propuesta.

El acuerdo anterior conserva sus precios, responsables y aceptación. La
corrección solo lo sustituye al ser aceptada. Un historial paginado muestra
las propuestas de la misma familia, incluidas correcciones rechazadas o
canceladas. Dos borradores de corrección pueden coexistir; solo uno puede
reemplazar la versión anterior, con revalidación al registrar y aceptar.

No se permiten precios aceptados superpuestos para un mismo cliente,
producto y alcance. La aceptación bloquea primero el cliente y después el
acuerdo, de modo que dos aceptaciones concurrentes no introducen precios
ambiguos. El alcance específico puede coexistir con uno general porque
su prioridad es explícita.

## Relación con la futura liquidación

`precios.consultas.precio_para_entrega` devuelve la línea exacta del acuerdo
aceptado que corresponde a un producto de una entrega confirmada. Da prioridad
al alcance específico y después consulta el período por fecha requerida.
Sin precio aceptado devuelve `None`, nunca cero o un precio supuesto.

La futura liquidación deberá conservar la línea, precio y kilos aceptados
utilizados al emitirse; una corrección de precios no debe reescribir esos
documentos. Este módulo no genera liquidaciones, cobros o movimientos físicos,
ni cambia Pedidos, Entregas, devoluciones, GPS o cajillas.

## Integridad y permisos

Siete permisos: consultar, crear, editar borradores, registrar propuesta,
aceptar, rechazar y cancelar. Todos requieren además consultar. Se integran
con Roles y la sesión; no se asignan automáticamente a usuarios o grupos.
El permiso adicional de alcance `proponer_precios_propios` identifica la cuenta
propia junto a `Cliente.encargado_precios`. El rol del supermercado no incluye
aceptar/rechazar y el backend los impide incluso si se añaden por error. Retirar
la asignación, revocar el permiso o desactivar el cliente bloquea su acceso.
La autorización se recarga después de adquirir los bloqueos, también en reintentos.

Listados, clientes, productos de pedidos e historial se limitan antes de filtros,
conteos y paginación. Las fotos privadas sin caché requieren pertenencia a los
pedidos del período o a un acuerdo propio. La sesión pública fija alcance propio
incluso para administradores; la pasarela excluye aceptar/rechazar y el catálogo
global. Estas migraciones no inician ni publican un túnel.

Cada escritura usa sesión/CSRF, autorización fresca, versión y UUID con huella
del cuerpo y responsable. Un reintento conserva el mismo cuerpo y UUID; si
la respuesta es incierta, la interfaz bloquea otras operaciones hasta comprobar
la anterior. La auditoría automática HTTP se complementa con el servicio
central dentro de la transacción. Un fallo de auditoría revierte la escritura.

Los precios son `Decimal(12,2)` en Bs por kg, positivos cuando se anotan y
obligatorios al registrar o aceptar. No se suman precios unitarios ni se
convierten CANT/UNI en kg. Los listados, selectores e historial paginan de diez.
La hoja conserva hasta 500 productos y sus valores entre páginas; la revisión
valida todos, incluyendo los que están fuera de la página visible.

## Archivos y validación

- Backend: `Backend/precios/`, migraciones de acuerdos y permiso de alcance;
  `clientes.0004_cliente_encargado_precios` agrega la asignación opcional sin
  alterar cuentas existentes.
- Interfaz: `Frontend/src/components/precios/`, tres rutas administrativas,
  acceso en sidebar, traducciones español/inglés y tema claro/oscuro existente.
- Consulta paginada compartida: `Frontend/src/hooks/useConsultaPaginada.ts`.
- Pruebas: backend con aislamiento de clientes, origen de pedidos, fotos privadas,
  revocación, permisos, CSRF, auditoría, versiones, exactitud y concurrencia;
  frontend con tarjetas de diez, carga atómica y respuestas tardías, revisión de
  otras páginas, importes y reintentos inmutables.

Se respeta la instrucción de no automatizar el navegador ni el escritorio.
La revisión visual en dispositivos y la operación comercial con listas reales
son manuales.

Validación del 12 de noviembre de 2026: 183 pruebas de backend en PostgreSQL
aislado y 372 de frontend correctas, además de las ocho pruebas de pasarela.
TypeScript, ESLint, UTF-8 y compilaciones local/pública correctas. La comprobación
HTTP de producción verifica HTML y RSC de las ocho páginas del acceso público,
incluidas listado, nueva propuesta y detalle de Precios, con una cuenta ficticia
sin tocar PostgreSQL. Migraciones locales aplicadas y plantilla de rol disponible,
sin asignar cuentas ni reiniciar el túnel. El flujo con productos reales y la
revisión visual en dispositivos siguen siendo verificaciones manuales.

Validación del 9 de noviembre de 2026: 119 pruebas de integración de Precios,
Roles, Usuarios, Entregas y Devoluciones correctas en PostgreSQL aislado;
314 pruebas de frontend correctas. TypeScript, ESLint, formato, compilación
de producción y compilación de las tres rutas correctos. Migración local
aplicada, con siete permisos disponibles sin reasignar usuarios o grupos.
Copia previa de PostgreSQL comprobada en
`.local/precios-inicio/20261109-083955/base_antes_de_precios.dump`.
