# Unidades de medida y categorías de productos

Dos catálogos independientes en la aplicación Django `catalogos`:

| Tabla PostgreSQL | Modelo | Campos |
| --- | --- | --- |
| `unidades_medida` | `UnidadMedida` | id, nombre, abreviatura, activo, creado_en, actualizado_en |
| `categorias_productos` | `CategoriaProducto` | id, nombre, activo, creado_en, actualizado_en |

`permite_fraccion` no forma parte de los modelos, de la API ni de las
pantallas. `actualizado_en` se mantiene automáticamente al guardar, pero se
omite en respuestas públicas, formularios, listados, administración de
catálogos y diferencias de auditoría. `creado_en` se muestra en el listado.

## API y permisos

Para cada recurso (`unidades-medida` y `categorias-productos`):

- `GET /api/v1/{recurso}/`: lista paginada, 10 elementos por página.
- `POST /api/v1/{recurso}/`: crear un registro activo.
- `GET /api/v1/{recurso}/{id}/`: recuperar datos para edición.
- `PATCH /api/v1/{recurso}/{id}/`: editar datos, incluyendo `version`.
- `POST /api/v1/{recurso}/{id}/estado/`: enviar `activo` y `version`.
- `GET /api/v1/{recurso}/resumen/`: contadores por estado.

Filtros: `buscar`, `activo=true|false`, `orden=nombre|-nombre|creado_en|-creado_en`
y `pagina`. Un filtro activo ausente significa todos los estados. Los
contadores respetan la búsqueda y cuentan todos los estados.

Cada modelo tiene permisos nativos `view`, `add`, `change` y un permiso
específico `cambiar_estado_unidadmedida` o `cambiar_estado_categoriaproducto`.
No existe borrado HTTP ni permisos de eliminación de catálogos. Django
comprueba los permisos por acción; Next.js adapta el menú y los botones con
`permisos_catalogos` de la sesión.

El comando `preparar_roles` crea `Administrador de catálogos` con los ocho
permisos cuando ese rol no existe. No amplía roles anteriores ni asigna
roles a cuentas existentes. Los permisos nuevos aparecen en el editor de
Roles y permisos y se pueden delegar con las restricciones actuales.

## Integridad e historial

Los nombres son obligatorios, hasta 100 caracteres, con espacios
normalizados y unicidad sin distinguir mayúsculas en PostgreSQL. La
abreviatura es obligatoria, hasta 10 caracteres, sin espacios y única.
Su escritura se conserva: los símbolos pueden distinguir mayúsculas.

Las ediciones y cambios de estado bloquean el registro y revalidan su
versión dentro de una transacción. La versión es un identificador opaco;
no revela la fecha de modificación. Un conflicto devuelve 409 y permite
recargar los datos actuales. El registro y su auditoría se confirman o se
revierten juntos. Las desactivaciones conservan el historial.

La administración Django de estos catálogos es de lectura. Las operaciones
ordinarias utilizan la API auditada. No se cargan unidades ni categorías
ficticias ni se crean dependencias de Productos aún inexistentes. Cuando se
implemente Productos, sus relaciones deberán proteger las referencias y
validar la disponibilidad de los catálogos en cada operación aplicable.

## Pantallas

- `/unidades-medida` y `/categorias-productos`.
- `/{recurso}/nuevo` y `/{recurso}/{id}/editar`.
- Pestañas por estado, buscador, orden, paginación, formularios con errores
  por campo, confirmación de cambios de estado y notificaciones flotantes.
