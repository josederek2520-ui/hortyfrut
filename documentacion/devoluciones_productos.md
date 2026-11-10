# Devoluciones de productos

Implementado el 9 de noviembre de 2026. Acceso local en `/devoluciones`, dentro
de Operación diaria y después de Entregas. Una entrega confirmada ofrece
«Registrar devolución» y «Ver devoluciones», según permisos.

## Flujo de trabajo

1. Crear un borrador desde una entrega confirmada. Elegir el almacén receptor,
   la fecha del retorno físico y su motivo.
2. Agregar los aportes de producto/lote que realmente regresaron. Anotar la
   cantidad física y el peso medido. Para lotes en kg se utiliza una sola
   medición; en las demás unidades, cantidad y kg son independientes.
3. Confirmar la recepción física. Se crea un lote retenido y bloqueado por
   cada aporte, con una entrada auditada de inventario. Las mediciones
   recibidas quedan inmutables.
4. Revisar la calidad: anotar únicamente **Aprovechable** y **Merma**, incluido
   cero donde corresponda, y describir la clasificación. Guardar la revisión
   permite continuar después sin generar movimientos.
5. Confirmar la revisión. Ambas partes deben sumar exactamente la cantidad
   y el peso recibidos. La merma sale del inventario retenido; el aprovechable
   pasa a un lote independiente, bloqueado para su tratamiento posterior.

No existe una clasificación «Disponible». El producto aprovechable tampoco
se puede habilitar para pedidos mediante la ficha del lote. Un producto
vencido se puede recibir físicamente, pero solo clasificarse como merma.

## Relación con los módulos existentes

La devolución conserva entrega, despacho, pedido, sucursal, producto, carga,
preparación y lote de origen. El motivo y el rechazo de Entregas sirven como
referencia; un rechazo por sí solo no prueba un retorno físico. No se copian
mediciones ni se asignan pesos automáticamente.

Preparaciones conserva su propia separación por calidad. Devoluciones
reutiliza sus criterios de inventario y los códigos diarios de lotes
`LDDMMAA-NN`, pero registra un documento independiente para el retorno desde
una sucursal. No reabre la preparación ni modifica Entregas, Pedidos,
Despachos, cajillas, GPS o el estado del viaje.

Se admiten devoluciones parciales y varias devoluciones de una entrega. La
cantidad acumulada recibida no puede superar lo enviado por aporte, y el
peso acumulado no puede superar el peso recibido confirmado en Entregas.
No hay equivalencias entre CANT, UNI y kg. Los borradores no reservan cupos;
los límites se vuelven a comprobar al confirmar el ingreso físico.

## Estados y permisos

`Borrador → Pendiente de revisión → Revisada`. Solo los borradores se cancelan.
Una recepción confirmada conserva sus medidas; una revisión confirmada es
de consulta y no admite otra clasificación.

Los seis permisos independientes son consultar, crear, editar borradores,
confirmar recepción, revisar calidad y cancelar borradores. Aparecen en Roles;
no se asignan automáticamente a usuarios o grupos. La operación exige también
el permiso de consultar. Los responsables son Usuarios.

El módulo es de administración local de almacén. No se añade a la pasarela
HTTPS del chofer o de sucursales; sus permisos se retiran de la sesión pública.
Los enlaces al detalle de Entregas, lotes y movimientos respetan los permisos
de sus respectivos módulos.

## Integridad y auditoría

Cada escritura usa sesión/CSRF, autorización revalidada, versión y UUID con
huella del cuerpo. Los reintentos conservan UUID y cuerpo exactos; una misma
clave con datos o responsable distintos se rechaza. Ante respuesta incierta,
la interfaz bloquea otra operación hasta comprobar el reintento.

Las escrituras de una misma entrega bloquean primero su fila y después la
devolución. Así, dos ingresos simultáneos no pueden superar el mismo aporte.
Recepción, lotes, movimientos y auditoría se confirman en una transacción;
un fallo los revierte juntos. Las consultas nunca generan movimientos.

La auditoría HTTP automática se complementa con el servicio central para
guardar, recibir, revisar y cancelar, además de la trazabilidad de lotes.
Los listados, aportes y selectores filtran antes de paginar de diez. La hoja
conserva sus valores de todas las páginas y dirige los errores a su aporte.

## Archivos y comprobaciones

- Backend: `Backend/devoluciones/` y migración
  `Backend/inventario/migrations/0004_lotes_devueltos.py`.
- Interfaz: `Frontend/src/components/devoluciones/` y rutas administrativas
  `/devoluciones`, `/devoluciones/nueva`, `/devoluciones/[identificador]`.
- Traducciones completas en español e inglés, reutilizando el tema claro y
  oscuro, Lucide, CampoFecha, confirmaciones y notificaciones existentes.
- Pruebas de backend en PostgreSQL aislado: permisos, CSRF, flujo HTTP,
  devoluciones parciales, límites concurrentes, precisión, vencimiento,
  inmutabilidad, UUID y reversión por fallo de auditoría.
- Pruebas de frontend: dos clasificaciones, permisos separados, decimales,
  filas de otras páginas, reintentos inmutables y respuestas tardías.

La revisión visual del navegador y la operación física con productos reales
son manuales; no se automatiza el escritorio del usuario.

Validación del 9 de noviembre de 2026: 166 pruebas de backend de Devoluciones,
Entregas, Inventario, Preparaciones, Recepciones y Roles correctas en PostgreSQL
aislado; 303 pruebas de frontend correctas. TypeScript, ESLint, formato,
compilación de producción y compilación de las tres rutas sin errores.
Migraciones locales aplicadas; seis permisos disponibles sin reasignar roles.
La copia previa comprobada de PostgreSQL está en
`.local/devoluciones-inicio/20261109-071853/base_antes_de_devoluciones.dump`.
