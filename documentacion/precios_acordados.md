# Precios acordados

El supermercado propone cuánto pagará por kilogramo de cada producto y
HortyFru acepta la lista. La oficina registra la propuesta recibida, por
ejemplo, en una lista o mensaje. Esta implementación es local: no publica
un portal comercial ni modifica el acceso HTTPS de sucursales o choferes.

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
La cuenta pública no recibe estos permisos y sus rutas no se publican en
la pasarela HTTPS.

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

- Backend: `Backend/precios/`, migración `0001_acuerdos_precios`.
- Interfaz: `Frontend/src/components/precios/`, tres rutas administrativas,
  acceso en sidebar, traducciones español/inglés y tema claro/oscuro existente.
- Consulta paginada compartida: `Frontend/src/hooks/useConsultaPaginada.ts`.
- Pruebas: backend con permisos, CSRF, auditoría, versiones, exactitud,
  prioridades y concurrencia; frontend con filas de diez, revisión de otras
  páginas, importes, versiones y reintentos inmutables.

Se respeta la instrucción de no automatizar el navegador ni el escritorio.
La revisión visual en dispositivos y la operación comercial con listas reales
son manuales.

Validación del 9 de noviembre de 2026: 119 pruebas de integración de Precios,
Roles, Usuarios, Entregas y Devoluciones correctas en PostgreSQL aislado;
314 pruebas de frontend correctas. TypeScript, ESLint, formato, compilación
de producción y compilación de las tres rutas correctos. Migración local
aplicada, con siete permisos disponibles sin reasignar usuarios o grupos.
Copia previa de PostgreSQL comprobada en
`.local/precios-inicio/20261109-083955/base_antes_de_precios.dump`.
