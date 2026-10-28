# HortyFru

Aplicación con Next.js, TailAdmin, Django REST Framework y PostgreSQL.

Consulta [la guía del flujo operativo](documentacion/flujo-operativo.md) para
configurar el sistema, seguir los pedidos hasta su preparación y ubicar cada
módulo en el menú lateral.

## Iniciar en desarrollo (Git Bash de Windows)

Primera terminal:

```bash
cd Backend
source .venv/Scripts/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py preparar_roles
python manage.py createsuperuser
python manage.py runserver
```

Segunda terminal:

```bash
cd Frontend
npm run dev
```

Abre <http://localhost:3000/es/usuarios>. El inicio de sesión utiliza la
correo electrónico y la contraseña de la cuenta creada con
`createsuperuser`. Después se pueden crear cuentas ordinarias y
asignar los roles disponibles desde el módulo de usuarios. El módulo
**Roles y permisos** está en <http://localhost:3000/roles> y en el menú
lateral para las cuentas autorizadas.

El frontend incluye creación, edición, detalle, activación y desactivación,
restablecimiento de contraseñas, búsqueda, filtros, orden, paginación,
pestañas con contadores de cuentas activas e inactivas,
actividad reciente y perfil propio. La interfaz usa componentes TailAdmin,
traducciones en español e inglés y estilos para modo claro y oscuro.

Roles incluye creación, edición, detalle, eliminación confirmada, búsqueda,
paginación y pestañas de roles con/sin usuarios. Los permisos se agrupan
por módulo y usan «Ver usuarios». Se puede ver la lista de usuarios
asignados cuando la cuenta tiene ese permiso. Los campos inválidos se
marcan en rojo y las notificaciones aparecen abajo a la derecha.

Django comprueba los permisos en cada operación, impide otorgar accesos
superiores a los propios, protege los roles del administrador y bloquea
eliminar roles con usuarios. Los cambios se auditan y el editor detecta
versiones desactualizadas. `preparar_roles` crea un rol independiente de
administración de roles sin cambiar los permisos de los roles previos.

`Backend/.env` contiene la conexión privada. `Frontend/.env.example`
documenta `DJANGO_API_URL` si el backend se ejecuta en otro destino; su
valor local por defecto es `http://127.0.0.1:8000`.

Consulta [la documentación del backend](Backend/README.md) para las rutas
de la API, configuración y pruebas.

## Comprobaciones

```bash
# En Backend, con el entorno activado
python manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores compras almacenes inventario recepciones cajillas preparaciones

# En Frontend
npm run build
npx tsc --noEmit
node --test pruebas/calculos_preparacion.mjs
```

La plantilla original tiene incidencias de lint en sus componentes de
calendario, contextos y tipos de mapas. El módulo nuevo se
comprueba por separado con ESLint. La compilación valida los tipos de todo
el proyecto.

Crear y editar roles ahora utiliza páginas propias: `/roles/nuevo` y
`/roles/{id}/editar`. Conserva las validaciones, detección de edición
concurrente y los permisos de Django. Las confirmaciones de eliminación
y consultas auxiliares mantienen sus diálogos.

El nuevo módulo `/actividad` muestra el historial central del sistema con
filtros, paginación y detalles de cambios. Su permiso independiente es
«Ver registro de actividad». Los nombres del código propio nuevo se
escriben en español según [las convenciones del proyecto](AGENTS.md).
La cobertura y el contrato para módulos futuros están documentados en
[la guía de auditoría](Backend/auditoria/INTEGRACION.md).

Los catálogos de [Unidades de medida](http://localhost:3000/unidades-medida)
y [Categorías de productos](http://localhost:3000/categorias-productos)
incluyen búsqueda, filtros de estado, orden, paginación, creación/edición
en páginas propias y cambios de estado confirmados. Se integran con roles
y auditoría, sin datos de ejemplo. Conservan `actualizado_en` internamente
y muestran la fecha de creación; no tienen el campo `permite_fraccion`.

[Productos](http://localhost:3000/productos) permite registrar nombre, categoría,
unidad de medida base e imagen opcional, con formularios propios, filtros,
validación por campo, permisos y auditoría. Las fotos se validan y optimizan con
Pillow. Consulta [su documentación](Backend/productos/README.md).

Todos los listados de negocio usan paginación fija de **10 registros**, incluido
el registro de actividad. Esta convención queda en `AGENTS.md` para módulos futuros.

Las presentaciones se administran dentro de la ficha de cada producto, sin otro
menú. Definen el nombre y el uso en compras/pedidos, con permisos y auditoría
independientes. Las cantidades reales se registran en inventario. En Productos, pulsa el
nombre o el icono de ver para abrirlas.

[Clientes](http://localhost:3000/clientes) permite registrar datos comerciales,
NIT y contacto. La ficha de cada cliente reúne sus sucursales, direcciones,
referencias y ubicación opcional, con permisos por acción y auditoría. Los
listados usan 10 filas. Consulta [el contrato del módulo](Backend/clientes/README.md).

[Proveedores](http://localhost:3000/proveedores) reúne nombre o razón social,
categoría principal opcional, teléfono, dirección y estado. La fecha de creación
es automática y visible en el listado, la ficha y la edición. Incluye formularios
propios, búsqueda, filtros, paginación de 10 registros, permisos y auditoría
transaccional. Consulta [su contrato](Backend/proveedores/README.md).

Los responsables operativos se vinculan directamente a Usuarios; no se incorpora
un módulo de Empleados.

[Compras](http://localhost:3000/compras) conserva dos fechas independientes:
pedidos a atender (consulta por fecha requerida) y fecha de compra. Permite revisar
el resumen CANT/UNI y los pedidos por sucursal, registrar proveedores y precios,
guardar borradores y registrar o cancelar con permisos y auditoría. Las compras
no generan existencias ni cambian los pedidos. Consulta [su contrato](Backend/compras/README.md).

[Almacenes](http://localhost:3000/almacenes) incorpora nombre, dirección, latitud,
longitud, estado y fecha de creación automática. Valida coordenadas completas y
sus rangos, muestra un enlace al mapa e incluye búsqueda, paginación de 10,
permisos y auditoría. Consulta [su contrato](Backend/almacenes/README.md).

[Recepciones](http://localhost:3000/recepciones) permite recibir compras por
partes o registrar ingresos directos. Distingue la cantidad recibida de la
compra y la cantidad física medida; solo confirmar genera lotes y movimientos.
Incluye borradores, fechas, vencimiento opcional, confirmación, permisos,
auditoría y controles de concurrencia. Las unidades habilitadas se administran
en la ficha del producto, sin equivalencias. Consulta [su contrato](Backend/recepciones/README.md).

[Lotes](http://localhost:3000/lotes) muestra saldos físicos, vencimiento y
disponibilidad, con bloqueo controlado. [Movimientos de inventario](http://localhost:3000/movimientos-inventario)
conserva la trazabilidad hacia la recepción o preparación y sus lotes. Los saldos
se calculan desde movimientos en su propia unidad. Consulta [Inventario](Backend/inventario/README.md).

[Cajillas](http://localhost:3000/cajillas) permite registrar colores y cantidades
iniciales, controlar ingresos, salidas a sucursales y devoluciones parciales.
Muestra disponibles por almacén, pendientes por sucursal, total por color y
el historial con fechas y responsables automáticos. Conserva las cantidades
de referencias inactivas e impide saldos negativos o devoluciones superiores
al pendiente. Consulta [su contrato](Backend/cajillas/README.md).

[Preparaciones](http://localhost:3000/preparaciones) reúne los pedidos de un
cliente y fecha requerida en una hoja de productos por sucursal, categorías y
totales CANT/UNI independientes. Permite imprimir el conjunto completo, preparar
por partes, seleccionar lotes, registrar aportes físicos medidos y separar
merma/aprovechable. Solo confirmar descuenta inventario y actualiza el avance
de los pedidos. Las cajillas quedan como previsión para el despacho, sin mover
sus saldos. La hoja de trabajo permite elegir productos con foto, repartir por
sucursal y revisar/confirmar desde la misma pantalla, conservando cantidades al
cambiar de producto o página. Incluye historial, permisos y auditoría.
Consulta [su contrato](Backend/preparaciones/README.md).
