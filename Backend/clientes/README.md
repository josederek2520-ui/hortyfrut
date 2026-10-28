# Clientes y sucursales

Clientes agrupa los datos comerciales. Sus sucursales representan los destinos
de pedidos y entregas. Se administran dentro de la ficha del cliente, sin un
menú independiente de sucursales.

## Datos y reglas

`Cliente`: razón social (150), NIT obligatorio y único (20 dígitos), teléfono
opcional (30 dígitos), correo opcional (150), estado y fechas automáticas.
Los identificadores y teléfonos se guardan como texto para conservar ceros.
El correo se normaliza en minúsculas y el nombre normaliza espacios.

`Sucursal`: cliente protegido con `PROTECT`, nombre (150), dirección obligatoria
(255), teléfono opcional (30), referencia opcional (255), latitud y longitud
opcionales (7 decimales), estado y fechas automáticas. El nombre es único dentro
del cliente, sin distinguir mayúsculas, incluso si está inactiva.

Las coordenadas se guardan juntas o ambas nulas. Latitud admite -90 a 90 y
longitud -180 a 180; se rechazan valores no finitos y precisión excesiva. El
formulario permite agregar esta ubicación más adelante. «Ver en Google Maps»
abre las coordenadas guardadas solo cuando el usuario pulsa el enlace, usando
[Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

`actualizado_en` es interno y no se expone en la API ni en las vistas. No hay
borrado físico por HTTP. Desactivar un cliente conserva el estado y el historial
de sus sucursales. Crear o reactivar sucursales exige cliente activo. Los módulos
operativos deberán comprobar que tanto cliente como sucursal estén activos.
La relación con un responsable empleado se incorporará con ese módulo; no se
simula con usuarios o identificadores sin relación.

## API

- `/api/v1/clientes/`: GET paginado y POST.
- `/api/v1/clientes/{id}/`: GET y PATCH.
- `/api/v1/clientes/{id}/estado/`: POST con `activo` y `version`.
- `/api/v1/clientes/resumen/`: contadores según búsqueda, ignorando estado.
- `/api/v1/clientes/{cliente_id}/sucursales/`: GET paginado y POST.
- `/api/v1/clientes/{cliente_id}/sucursales/{id}/`: GET y PATCH.
- `/api/v1/clientes/{cliente_id}/sucursales/{id}/estado/`: POST con `activo` y `version`.
- `/api/v1/clientes/{cliente_id}/sucursales/resumen/`: contadores.

Todos los listados son de **10 registros**, con parámetros `pagina`, `buscar`,
`activo` y `orden` (`nombre`, `-nombre`, `creado_en`, `-creado_en`). En Clientes,
el orden por nombre utiliza la razón social y se incluye `cantidad_sucursales`.
Se busca por datos comerciales/contacto, o por nombre/dirección/referencia en
sucursales. Las rutas hijas comprueban el cliente: no permiten mover registros
ni acceder a una sucursal de otro cliente.

POST recibe exclusivamente datos editables. PATCH requiere `version`, detecta
ediciones simultáneas y devuelve 409 sin sobrescribir. La activación tiene una
acción y permiso independientes. Las restricciones de PostgreSQL refuerzan NIT,
nombres de sucursales, teléfonos y coordenadas.

## Permisos y auditoría

Ocho permisos: `view`, `add`, `change` y `cambiar_estado` para `cliente` y
`sucursal`. Sucursales requiere además `clientes.view_cliente` para acceder a
la ficha. La sesión entrega `permisos_clientes` y `permisos_sucursales` por
separado. Los permisos aparecen en Roles; no se amplían grupos existentes.
`preparar_roles` crea «Administrador de clientes» únicamente si no existe.

Las escrituras pasan por `guardar_registro` y `cambiar_estado`. Son transaccionales,
bloquean primero cliente y después sucursal, y registran diferencias con el servicio
central de auditoría. Si falla la evidencia, se revierte la escritura. Procesos fuera
de HTTP deben usar los mismos servicios. El middleware registra lecturas y rechazos
en `clientes` o `sucursales`, incluyendo rutas anidadas.

El historial conserva los nombres de campos modificados, pero protege los valores
de NIT, teléfono, correo, dirección, referencia y coordenadas. No guarda cuerpos
de solicitudes, secretos ni parámetros de búsqueda.

## Frontend y comprobaciones

`/clientes`, `/clientes/nuevo`, `/clientes/{id}` y `/clientes/{id}/editar`.
Listado y ficha con diseño existente, Lucide, modo oscuro, es/en, navegación
localizada, estados de carga/error/vacío, búsqueda y contadores por estado.
Sucursales se gestionan con un formulario breve dentro de la ficha. Se reutilizan
validaciones rojas, confirmaciones y notificaciones abajo a la derecha.

```bash
python manage.py test usuarios roles auditoria catalogos productos clientes
python manage.py check --database default
python manage.py makemigrations --check --dry-run
# En Frontend
npm run build
```
