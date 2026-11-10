# Entregas

Recepción y conciliación comercial de una carga ya descargada, por despacho y
pedido. `GET /api/v1/entregas/` agrupa antes de paginar diez registros. No crea
documentos por consultar y no exige finalizar el recorrido.

La hoja está en `/entregas/{despacho}/{pedido}`. El origen conserva las cargas
descargadas y sus aportes, nombres históricos, cajas, unidades y peso real.
Los campos recibidos son independientes y manuales. Aceptado en kg se obtiene
restando el rechazo al peso recibido; la diferencia enviado/recibido se consulta
por separado y nunca se transforma automáticamente en rechazo.

«Recibido por» se fija desde el encargado de pedidos activo de la sucursal al
guardar una captura nueva, con FK a Usuario y nombre histórico. El texto legado
se acepta en las solicitudes para conservar contratos y huellas de reintentos,
pero no elige al receptor. Sin encargado activo solo se admite borrador. Los
registros históricos conservan su nombre y no se enlazan por coincidencia de texto.
La asignación del receptor no concede permisos ni cambia al responsable de registro.

Estados: pendiente (sin documento), borrador, revisión y confirmada. Guardar,
enviar, adjuntar, devolver a borrador y confirmar usan versión y UUID idempotente,
con autorización revalidada en servicios y auditoría central. Confirmada es
inmutable. Se bloquean despacho, cargas y sucursal durante la escritura.

Cada producto tiene una línea por entrega, aunque varias asignaciones CANT/UNI
viajen en ella. La confirmación de oficina exige distribuir los kilos recibidos
y rechazados entre todos sus aportes; sus sumas deben coincidir exactamente.
Si existe un único aporte, los mismos pesos medidos se vinculan a ese origen.
Nunca se usan equivalencias entre cajas, unidades y kg ni un reparto proporcional
supuesto entre lotes. Las recepciones confirmadas se acumulan por producto en
Pedidos, una vez por entrega y sin unirlas a los aportes para sumar cantidades.

## Acceso

- Rol `Encargado de recepción de sucursal`: consultar, registrar, editar borrador
  y enviar a revisión, únicamente en las sucursales asignadas.
- Rol `Administrador de entregas`: consultar y gestionar todas, revisar lotes,
  devolver a borrador y confirmar desde la administración local.
- Clientes → Sucursales permite asignar un Usuario como encargado de recepción.
  Cuando no hay asignación explícita se admite el encargado de pedidos, si tiene
  los permisos de Entregas. Tener permiso de Pedidos no concede Entregas.
- El acceso público HTTPS permite solo recepción propia, incluso para cuentas
  con privilegios globales. No publica confirmar/devolver ni controles de oficina.

`python manage.py preparar_roles` crea los roles que faltan sin asignarlos a
usuarios ni alterar roles existentes. Las migraciones son aditivas.

## Comprobantes y consultas

Los comprobantes opcionales admiten JPG, PNG, WebP o PDF verificado, hasta 8 MB.
Se guardan con nombre aleatorio fuera de medios públicos, se descargan con
sesión/alcance y no se incluyen en auditoría. La sustitución conserva la versión;
un reintento del mismo archivo no crea otro. Las imágenes del catálogo se sirven
por una API limitada a los productos de la carga, sin exigir administrar Productos.

Las API de hoja, productos, aportes, comprobante e imágenes están debajo de
`/api/v1/entregas/{despacho}/pedidos/{pedido}/`. Productos y aportes se consultan
con páginas de diez. Los borradores conservan entradas entre páginas/filtros;
las respuestas antiguas se descartan. Los resultados inciertos mantienen cuerpo
y UUID en memoria y bloquean edición hasta comprobar el resultado.

Este módulo no mueve productos, lotes, cajillas, GPS ni estados del pedido o del
viaje. Un rechazo registra lo informado; el retorno físico pertenece al futuro
módulo de Devoluciones.

Pruebas: `python manage.py test entregas --settings=config.pruebas_aisladas --keepdb --noinput`.
