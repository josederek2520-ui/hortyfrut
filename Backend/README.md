# Backend de HortyFru

Backend con Django REST Framework y PostgreSQL.

## Entorno de desarrollo

En Git Bash de Windows, desde esta carpeta:

```bash
source .venv/Scripts/activate
python -m pip install -r requirements.txt
```

## Configuración de PostgreSQL

Las variables de conexión se leen desde `.env`. Para un entorno nuevo,
copia `.env.example` a `.env` y completa los valores:

```dotenv
DB_NAME=hortyfru
DB_USER=postgres
DB_PASSWORD=tu_contrasena_local
DB_HOST=127.0.0.1
DB_PORT=5432
SECRET_KEY=pegar_una_clave_privada_generada
DEBUG=True
```

Genera la clave privada con el siguiente comando y copia el resultado a
`SECRET_KEY` en `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

`DB_NAME` debe identificar una base existente en el servidor. En el entorno
local actual, PostgreSQL 18 escucha en el puerto 5432. La cuenta `postgres`
es la cuenta administrativa de la instalación local; el despliegue debe
utilizar una cuenta propia de la aplicación con los permisos necesarios.

`.env` está excluido de Git. Los valores ya definidos en las variables del
proceso tienen prioridad sobre los del archivo.

## Verificar la conexión

```bash
python manage.py check
python manage.py shell -c "from django.db import connection; cursor = connection.cursor(); cursor.execute('SELECT current_database(), current_user'); print(cursor.fetchone()); cursor.close()"
```

El segundo comando realiza una consulta real a PostgreSQL y muestra la base
y el usuario conectados.

## Desarrollo

El modelo personalizado `usuarios.Usuario` ya está registrado en
`AUTH_USER_MODEL`. Para preparar un entorno nuevo:

```bash
python manage.py migrate
python manage.py preparar_roles
python manage.py createsuperuser
```

La contraseña del administrador se introduce de forma interactiva; no hay
credenciales predeterminadas. El identificador solicitado por el comando
es el correo electrónico; también solicita la cédula como dato personal.
El acceso al sistema utiliza correo y contraseña. Para iniciar el servidor de desarrollo:

```bash
python manage.py runserver
```

## Módulo de usuarios

- API: `/api/v1/usuarios/`, con búsqueda, filtros, orden y paginación.
- Resumen: `/api/v1/usuarios/resumen/`.
- Detalle y edición: `/api/v1/usuarios/{id}/` (GET y PATCH).
- Estado: `/api/v1/usuarios/{id}/estado/` (POST).
- Restablecer contraseña: `/api/v1/usuarios/{id}/password/` (POST).
- Roles disponibles para asignación: `/api/v1/roles/opciones/` (GET).
- Autenticación: `/api/v1/auth/csrf/`, `login/`, `me/`, `logout/`.
- Perfil propio: `/api/v1/auth/profile/` y `/api/v1/auth/profile/password/`.

Los permisos de consulta, creación, edición, cambio de estado, asignación de
roles y restablecimiento de contraseña se verifican en Django. Las cuentas
se desactivan conservando sus registros. La cédula y el celular conservan
ceros iniciales y admiten solo dígitos. Se impiden las fechas de nacimiento
futuras, los correos duplicados sin distinguir mayúsculas y las cédulas
duplicadas. La cédula es obligatoria y única para todas las cuentas,
incluidas las técnicas. Fecha de nacimiento, celular y dirección son
opcionales; el formulario administrativo solicita los datos básicos de
las cuentas ordinarias.

La migración `usuarios.0002` verifica que todas las cuentas tengan cédula
válida antes de eliminar la columna del identificador anterior. Para
actualizar una instalación existente, completa primero las cédulas
pendientes. La migración conserva los identificadores internos, hashes de
contraseña, roles y relaciones. El listado utiliza pestañas con contadores
de todos los usuarios, activos e inactivos; el control de filtros permite
seleccionar rol y orden sin tarjetas de resumen.

La migración `usuarios.0003_acceso_por_correo` valida y normaliza los correos
antes de hacerlos obligatorios y únicos como identificadores de acceso.
Si hay correos vacíos, inválidos o repetidos al normalizar, se detiene sin
eliminar cuentas. Conserva claves internas, contraseñas, cédulas, roles,
permisos y sesiones. Los correos se guardan en minúsculas, sin espacios al
inicio o al final, y el acceso no distingue mayúsculas.

`POST /api/v1/auth/login/` recibe `email`, `password` y `remember` opcional.
La cédula y el nombre de usuario no se aceptan como credenciales. Se admite
cualquier correo válido, incluido Gmail, con la contraseña de HortyFru.

La autenticación usa sesiones con cookies HttpOnly y protección CSRF,
incluido el inicio de sesión. Next.js utiliza un proxy bajo `/api/`, por lo
que las llamadas del navegador se realizan al mismo origen. En despliegue,
configura `DEBUG=False`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, una
`SECRET_KEY` privada y las cookies seguras sobre HTTPS. La conexión local
usa los valores privados de `.env`.

## Verificación

```bash
python manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores compras almacenes inventario recepciones cajillas preparaciones
python manage.py check --database default
python manage.py makemigrations --check --dry-run
```

La suite crea su propia base de pruebas y verifica permisos, validaciones,
CSRF, cambios de contraseña, consultas y protección de privilegios.

## Registro de actividad

La página `/actividad` permite filtrar por módulo, acción, responsable,
resultado y rango de fechas. Su API es de lectura en `/api/v1/actividad/`.
El permiso independiente es `auditoria.ver_registroactividad`, incluido en
el catálogo de roles; `preparar_roles` crea el rol `Auditor del sistema`.
El superusuario puede consultar el historial desde el primer momento.

Usuarios, Roles, Autenticación y la administración técnica se integran con
la auditoría. El historial previo se importa conservando fechas y sin
duplicados. La capa HTTP cubre los endpoints futuros y el servicio central
permite registrar diferencias y tareas automáticas. Consulta
[la guía de integración](auditoria/INTEGRACION.md) para cobertura, campos,
exclusiones y ejemplos de uso en nuevos módulos.

## Catálogos

[Almacenes](almacenes/README.md) incorpora ubicaciones con nombre y dirección,
coordenadas opcionales validadas en pareja, estado y fecha de creación automática.
Tiene permisos independientes, paginación fija de 10 y auditoría transaccional.

[Compras](compras/README.md) incorpora pedidos por fecha requerida, una fecha de
compra independiente, proveedores por línea, importes decimales, borradores,
registro/cancelación e historial. Las operaciones son transaccionales e idempotentes,
con Usuarios como responsables y sin afectar inventario ni cantidades pedidas.

[Proveedores](proveedores/README.md) permite administrar nombre, categoría opcional,
teléfono, dirección y estado. Incluye fecha de creación automática, permisos
independientes, protección frente a ediciones simultáneas y auditoría transaccional.
Los responsables de operaciones se vinculan directamente a Usuarios.

[Clientes y sucursales](clientes/README.md) incorpora datos comerciales y
destinos de entrega dentro de la ficha del cliente, con permisos independientes,
validaciones, paginación fija y auditoría transaccional.

Todos los listados de negocio usan páginas fijas de 10 registros, sin permitir
que parámetros de tamaño alteren el límite. La base está en `config/paginacion.py`.

El módulo de [Productos](productos/README.md) incorpora categorías, unidades e
imágenes opcionales con permisos independientes y auditoría transaccional.

Unidades de medida y Categorías de productos tienen API y pantallas propias,
permisos por acción y auditoría de creación, edición, activación y
desactivación. Se conservan ambas fechas automáticas; `actualizado_en` no
se expone en las vistas. El campo de fracciones no se incluye.
Consulta [el contrato de catálogos](catalogos/README.md) para rutas,
validaciones y permisos.

## Roles y permisos

La página `/roles` administra los grupos y permisos nativos de Django. No
duplica la tabla de roles ni almacena un tipo de usuario adicional.

| Ruta | Operación | Permiso |
| --- | --- | --- |
| `/api/v1/roles/` | GET: lista paginada | `auth.view_group` |
| `/api/v1/roles/` | POST: crear | `auth.add_group` |
| `/api/v1/roles/{id}/` | GET: detalle | `auth.view_group` |
| `/api/v1/roles/{id}/` | PATCH: editar | `auth.change_group` |
| `/api/v1/roles/{id}/` | DELETE: eliminar sin usuarios | `auth.delete_group` |
| `/api/v1/roles/resumen/` | GET: contadores | `auth.view_group` |
| `/api/v1/permisos/` | GET: catálogo funcional | Ver, crear o editar roles |

La lista admite `search`, `membership=assigned|unassigned`, `ordering` y
`page`; el tamaño fijo es 10. El catálogo incluye únicamente las
acciones implementadas de Usuarios, Roles, Registro de actividad, Catálogos,
Productos, Presentaciones, Clientes, Sucursales, Pedidos, Proveedores, Compras,
Almacenes, Recepciones, Cajillas, Preparaciones y los permisos funcionales de Inventario. La etiqueta visible es **Ver
usuarios**; su código interno sigue siendo `usuarios.view_usuario`.

Al crear se envía `{"name":"Operaciones","permissions":[1,2]}` usando
identificadores del catálogo real. Al editar se incluye también `version`
del detalle; DELETE recibe `{"version":"..."}`. Un cambio concurrente
devuelve 409 para evitar sobrescribir una edición ajena. El índice de
PostgreSQL impide nombres duplicados sin distinguir mayúsculas.

Un administrador solo puede otorgar permisos que posee y no puede cambiar
roles asignados a su propia cuenta, roles superiores ni los asignados a
superusuarios. El superusuario es la excepción técnica. No se elimina un
rol con usuarios, incluso si están inactivos. La asignación se mantiene en
Usuarios y se sincroniza bajo bloqueo con las modificaciones de roles.
La auditoría conserva actor, fecha y permisos anteriores/nuevos; permanece
tras eliminar un rol. Los permisos adicionales de instalaciones previas
se conservan y no se ofrecen para nuevas asignaciones desde el catálogo.

`preparar_roles` crea **Administrador de roles** con los cuatro permisos
de grupos, además de los dos roles previos. No amplía roles existentes.
Para delegar permisos de Usuarios, la cuenta administradora también debe
tener esos permisos. La API es el acceso ordinario auditado; Django Admin
de Usuarios y Grupos queda reservado al superusuario para impedir saltarse
estas restricciones. La sesión expone `role_capabilities` por separado.

La base local solo tenía tablas iniciales sin usuarios ni roles. Antes de
preparar el modelo personalizado se creó un respaldo en `.backups/` y se
rehicieron las migraciones de autenticación sobre ese esquema vacío.

## Recepciones e inventario

[Recepciones](recepciones/README.md) ingresa compras parcialmente o existencias
directas. Su confirmación atómica genera lotes, un movimiento y su evidencia
de auditoría, sin modificar pedidos. Los pendientes se recalculan con
recepciones confirmadas y se protegen bajo bloqueo de la compra.

[Inventario](inventario/README.md) configura unidades habilitadas por producto,
consulta lotes y movimientos y permite bloquear lotes. El saldo procede del
registro de movimientos; no hay edición manual de existencias ni equivalencias
en presentaciones. Sus permisos y los de Recepciones aparecen en la sesión y
en el catálogo de Roles. `preparar_roles` crea sus roles si faltan y mantiene
intactos los anteriores.

[Cajillas](cajillas/README.md) controla recipientes por color y cantidades
enteras, con saldos calculados desde movimientos, pendientes por sucursal,
devoluciones parciales, permisos independientes y auditoría transaccional.
Los responsables son Usuarios y las fechas son automáticas. Sus datos y
movimientos son independientes del inventario de productos y de CANT/UNI.

[Preparaciones](preparaciones/README.md) consolida los pedidos por cliente y
fecha requerida en una hoja de productos por sucursal, con totales CANT/UNI,
categorías e impresión completa. Los borradores no reservan existencias. La
confirmación parcial o completa registra aportes reales de lotes, separa calidad,
genera movimientos de inventario y actualiza el avance de los pedidos de forma
atómica y auditada. Las cajillas se planifican sin registrar préstamos. Su rol
independiente se crea mediante `preparar_roles`, sin modificar los anteriores.
