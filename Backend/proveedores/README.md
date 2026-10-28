# Proveedores

Directorio de proveedores de HortyFru. Cada proveedor tiene nombre o razón social,
categoría principal opcional, teléfono opcional, dirección opcional y estado.
La fecha de creación se registra automáticamente y se conserva al editar o cambiar
el estado. No existe un campo de mercado o lugar de compra.

## Interfaz

- `/proveedores`: búsqueda por nombre, teléfono, dirección o categoría; filtros
  por estado/categoría, contadores y orden por nombre o fecha de creación.
- `/proveedores/nuevo`: formulario con nombre obligatorio y validación por campo.
- `/proveedores/{id}`: ficha con contacto, dirección, estado y fecha/hora de creación.
- `/proveedores/{id}/editar`: edición con protección de versión y aviso al descartar.

Los listados y selectores tienen páginas de 10 registros. El listado muestra
la fecha de creación tanto en la tabla de escritorio como en las tarjetas móviles.
Las fechas se presentan según el idioma activo y la zona America/La_Paz.
Los mensajes y permisos tienen traducciones en español e inglés.
La selección de categoría usa el diálogo compartido, presentado mediante portal
fuera de las superficies con desenfoque.

## API

| Ruta | Métodos y propósito |
| --- | --- |
| `/api/v1/proveedores/` | GET paginado y POST. |
| `/api/v1/proveedores/{id}/` | GET y PATCH. |
| `/api/v1/proveedores/{id}/estado/` | POST con `activo` y `version`. |
| `/api/v1/proveedores/resumen/` | GET con total, activos e inactivos. |
| `/api/v1/proveedores/categorias/` | GET de categorías paginadas para el selector. |

Los filtros son `buscar`, `categoria`, `activo`, `orden` y `pagina`. Los órdenes
admitidos son `nombre`, `-nombre`, `creado_en` y `-creado_en`. El resumen aplica
búsqueda y categoría y conserva los contadores de ambos estados.

POST/PATCH admiten `nombre`, `categoria` (ID o null), `telefono` y `direccion`.
PATCH exige `version`, recibida en la lectura. El estado y las fechas no se
modifican desde ese contrato. Los campos desconocidos se rechazan.
Las respuestas incluyen categoría anidada, fecha de creación y versión;
`actualizado_en` se mantiene internamente.

Los nombres son únicos sin distinguir mayúsculas, incluso entre inactivos.
Se normalizan los espacios del nombre y la dirección; los teléfonos conservan
ceros iniciales y admiten dígitos del 0 al 9, según las validaciones compartidas.
Una categoría nueva debe estar activa. Se puede mantener una categoría histórica
inactiva, sustituirla por una activa o quitarla. Las referencias se protegen.

## Permisos y auditoría

Permisos independientes: `view_proveedor`, `add_proveedor`, `change_proveedor`
y `cambiar_estado_proveedor`, bajo la aplicación `proveedores`. No hay borrado.
La sesión expone `permisos_proveedores`; menú y páginas respetan su acceso.
Consultar categorías requiere acceso al módulo o permiso de creación/edición,
sin conceder administración de Productos o Categorías.

Los servicios `guardar_proveedor` y `cambiar_estado_proveedor` validan permisos,
datos y versiones también fuera de HTTP. Cada cambio y su auditoría se guardan
en la misma transacción; si falla la evidencia, se revierte el cambio. Los
registros bloqueados y la versión evitan sobrescribir ediciones simultáneas.
La capa HTTP central conserva también consultas y rechazos.

La migración crea la tabla y los cuatro permisos sin asignarlos a cuentas ni
ampliar roles existentes. `python manage.py preparar_roles` permite crear el rol
Administrador de proveedores cuando no existe, conservando los roles previos.
El superusuario tiene acceso al módulo directamente.

Los responsables de futuras compras y otras operaciones se vincularán a Usuarios,
conforme a la decisión del proyecto de no incorporar un módulo de Empleados.
Las futuras compras deben conservar las referencias a proveedores y admitir
nuevas selecciones entre proveedores activos.

## Comprobaciones

```bash
python manage.py test proveedores
python manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores
python manage.py check --database default
python manage.py makemigrations --check --dry-run
```

Las pruebas cubren permisos HTTP y de servicios, campos protegidos, fecha inmutable,
referencias históricas, paginación, filtros, auditoría transaccional y ediciones
simultáneas sobre la misma versión.
