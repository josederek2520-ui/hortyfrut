# Vehículos

Catálogo `/vehiculos`, con creación, edición y ficha en páginas propias. Placa
única normalizada a mayúsculas, tipo, marca opcional, capacidad declarada opcional
en toneladas (t) en la interfaz y foto opcional. La API y el almacenamiento
conservan `capacidad_kg` por compatibilidad; el frontend convierte decimales
exactamente al consultar y guardar (2000 kg se muestran como 2 t). Se conserva
la precisión histórica de 0,001 kg, equivalente a 0,000001 t. La capacidad es
una referencia, sin equivalencias de productos. Las
fotos se validan y recodifican a WebP usando el servicio existente, hasta 5 MB y
20 megapíxeles; su consulta exige permiso de Vehículos.

API `/api/v1/vehiculos/`: GET listado, POST creación, GET/PATCH `{id}/`, POST
`{id}/estado/`, GET `resumen/` y GET `{id}/imagen/`. Los listados admiten
`buscar`, `activo` y `pagina`, fija de 10. Editar y cambiar estado requieren
`version`. Crear/editar admiten JSON o multipart; `quitar_imagen` elimina la foto.
Responsable y fechas son automáticos. No se ofrece eliminación. Un vehículo en
ruta no puede desactivarse y los despachos conservan su placa histórica.

El listado reúne los contadores en una franja compacta y separa filtros, tarjetas
y paginación, sin una superficie vacía alrededor de pocos vehículos. Las fotos
se muestran completas en listado, ficha y formulario. La ficha destaca placa,
estado y capacidad en toneladas; conserva permisos y confirmación de estado.

Permisos: `view_vehiculo`, `add_vehiculo`, `change_vehiculo` y
`cambiar_estado_vehiculo`. Se integran en sesión, Roles y menú. `preparar_roles`
crea Administrador de vehículos si falta, sin ampliar roles previos ni asignar
usuarios. Los servicios validan permisos también fuera de HTTP, bloquean las
ediciones y guardan auditoría en la misma transacción. La capa HTTP registra
consultas y rechazos. Las fotos anteriores se limpian después del commit y los
archivos nuevos se retiran si falla el guardado.
