# Almacenes

Directorio de los lugares donde HortyFru almacenará productos y organizará sus
operaciones. Nombre y dirección son obligatorios. Latitud y longitud son
opcionales y siempre se registran juntas. El estado inicial es activo y la fecha
de creación se registra automáticamente.

## Interfaz

- `/almacenes`: listado con búsqueda por nombre/dirección, filtros de estado,
  orden por nombre o fecha de creación, contadores y páginas de 10 registros.
- `/almacenes/nuevo`: registro con validación por campo.
- `/almacenes/{id}`: detalle de dirección, coordenadas, estado y fecha de creación.
- `/almacenes/{id}/editar`: edición con detección de versiones desactualizadas
  y confirmación antes de descartar cambios.

La fecha de creación se muestra en listado, tarjetas móviles, ficha y edición.
Es de solo lectura y usa el idioma activo y America/La_Paz. No es un campo de
fecha introducido por el usuario.

Las coordenadas aceptan hasta 7 decimales: latitud entre -90 y 90, longitud entre
-180 y 180. El valor cero es válido. Se pueden dejar ambas vacías o quitar las dos
desde el formulario. Una ubicación válida muestra un enlace a Google Maps en una
pestaña nueva. No se carga un mapa externo ni se solicita geolocalización
automáticamente. No se añadieron dependencias.

Se reutilizan formularios, botones, notificaciones, confirmaciones con portal,
estilos de HortyFru, modo oscuro y traducciones en español e inglés.

## API

| Ruta | Operación |
| --- | --- |
| `/api/v1/almacenes/` | GET paginado y POST. |
| `/api/v1/almacenes/{id}/` | GET y PATCH. |
| `/api/v1/almacenes/{id}/estado/` | POST con `activo` y `version`. |
| `/api/v1/almacenes/resumen/` | GET de total, activos e inactivos. |

Los filtros son `buscar`, `activo`, `orden` y `pagina`. El tamaño fijo es 10, sin
permitir otros parámetros de tamaño. Los órdenes son `nombre`, `-nombre`,
`creado_en` y `-creado_en`. El resumen aplica la búsqueda sin excluir los otros
estados.

POST/PATCH admiten nombre, dirección, latitud y longitud. Las coordenadas se envían
como decimales o null; las respuestas usan cadenas con 7 decimales o null.
PATCH exige `version`; las modificaciones parciales validan el par combinado
contra el registro bloqueado. Enviar un solo campo a null cuando el otro conserva
una coordenada se rechaza. Para quitar la ubicación se envían ambos como null.

La fecha de creación, la fecha interna de actualización y el estado no se pueden
modificar desde POST/PATCH. Los campos desconocidos se rechazan. Los nombres son
únicos sin distinguir mayúsculas, incluso si el almacén está inactivo. Se
normalizan los espacios de nombre y dirección.

La base de datos protege las coordenadas completas, sus rangos, el nombre y la
dirección no vacíos. Los cambios de estado conservan todos los datos y el historial.
No hay endpoints para borrar ni para reemplazar el registro mediante PUT.

## Permisos y auditoría

Permisos: `almacenes.view_almacen`, `add_almacen`, `change_almacen` y
`cambiar_estado_almacen`. Toda operación requiere consulta, además del permiso de
la acción cuando escribe. La sesión expone `permisos_almacenes`; menú, páginas y
acciones respetan esos permisos.

Los servicios `guardar_almacen` y `cambiar_estado_almacen` validan permisos, datos
y versión también sin HTTP. Sus escrituras y la evidencia de negocio se guardan
en una misma transacción. Si falla la auditoría, el cambio se revierte. Los
bloqueos y la versión evitan sobrescribir cambios concurrentes.

La migración crea el catálogo y los cuatro permisos. `preparar_roles` crea
Administrador de almacenes si falta, sin ampliar roles existentes ni asignarlo
a cuentas. El superusuario tiene acceso directamente.

Este módulo administra ubicaciones. Las existencias pertenecerán al bloque de
Lotes y Movimientos de inventario, y los ingresos físicos al de Recepciones.

## Verificación

```bash
python manage.py test almacenes
python manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores compras almacenes
python manage.py check --database default
python manage.py makemigrations --check --dry-run
```

Las pruebas cubren coordenadas opcionales/completas, cero, extremos, precisión,
valores no finitos, restricciones de base de datos, fechas protegidas, versiones,
permisos, paginación, auditoría transaccional y edición concurrente de coordenadas.
