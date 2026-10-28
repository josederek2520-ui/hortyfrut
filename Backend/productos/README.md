# Productos

Catálogo de productos con nombre único sin distinguir mayúsculas, categoría,
unidad de medida base, imagen opcional y estado. Las relaciones se protegen con
`PROTECT`. Las fechas son automáticas; `actualizado_en` permanece fuera de la API
y las vistas. El stock se construirá con los movimientos de inventario.

## API

- `GET /api/v1/productos/`: listado fijo de 10 filas. Filtros `buscar`, `activo`,
  `categoria`, `unidad_medida`, `orden` y `pagina`.
- `POST /api/v1/productos/`: nombre, categoría y unidad obligatorios; imagen opcional.
- `GET /api/v1/productos/{id}/`: detalle y versión actual.
- `PATCH /api/v1/productos/{id}/`: edición con `version` obligatoria. Admite
  `quitar_imagen=true` o un archivo `imagen`.
- `POST /api/v1/productos/{id}/estado/`: `activo` y `version` obligatorios.
- `GET /api/v1/productos/resumen/`: contadores con búsqueda y filtros de relaciones.
- `GET /api/v1/productos/opciones/?tipo=categorias_productos`: opciones paginadas
  de diez, con `buscar`, `pagina` y tipo `categorias_productos` o `unidades_medida`.
  Devuelve activos por defecto; `incluir_inactivos=true` sirve para filtros del listado.
- `GET /api/v1/productos/{id}/imagen/`: foto protegida por sesión y permiso de lectura.

Sin borrado físico ni actualización de estado desde el formulario de edición.
Crear o cambiar una relación exige que esté activa. Una relación histórica
inactiva se conserva al editar otros datos; para reactivar el producto se
requieren ambas relaciones activas.

## Permisos y auditoría

Permisos independientes `view_producto`, `add_producto`, `change_producto` y
`cambiar_estado_producto`, disponibles en el editor de roles y en
`auth/me.permisos_productos`. Los roles existentes no reciben accesos nuevos
automáticamente. `preparar_roles` crea «Administrador de productos» solo si falta.

Las escrituras pasan por `guardar_producto` y `cambiar_estado_producto`: bloqueo
de filas, versión para detectar conflictos (409) y evidencia transaccional en
`auditoria.servicios`. Usar estos servicios también desde procesos fuera de HTTP.
El middleware registra consultas y rechazos; los recursos visuales exitosos no
generan eventos repetidos por cada miniatura.

## Imágenes

Requieren Pillow, fijado en `requirements.txt`. Se admiten archivos decodificables
JPG, PNG y WebP de hasta 5 MB y 20 megapíxeles. Se orientan y vuelven a generar
como WebP, máximo 1600 × 1600, sin metadatos y con nombres UUID. Se conserva solo
el primer fotograma si el archivo está animado.

La subida usa multipart y conserva CSRF. Los archivos anteriores se eliminan
después del commit, comprobando que ya no estén referenciados. Si falla la
escritura o auditoría se retira el archivo nuevo. Como el almacenamiento de
archivos no participa en transacciones SQL, un cierre abrupto del proceso puede
dejar un archivo huérfano; las copias de seguridad deben incluir base y `media/`.
En despliegue, conservar `MEDIA_ROOT` en almacenamiento persistente y no exponerlo
como carpeta pública: el acceso actual pasa por el endpoint con permiso.

Al incorporar movimientos de inventario, impedir cambios de unidad base en
productos con historial o realizar una conversión explícita y auditada.

## Frontend

`/productos`, `/productos/nuevo`, `/productos/{id}/editar`. Reutiliza el listado
de catálogos, filtros, estados, notificaciones y confirmaciones. Formulario propio
con selectores de búsqueda paginados, navegación por teclado, vista previa de
foto y validación por campo. Traducciones en español e inglés.

## Presentaciones dentro del producto

La ficha `/productos/{id}` reúne los datos generales y la sección de presentaciones.
Al crear un producto se abre esta ficha. Desde el listado se accede por el nombre
o el icono de ver. Las presentaciones se crean y editan en un formulario breve
dentro de la ficha, con búsqueda, filtros por uso/estado y páginas fijas de 10.

`PresentacionProducto` se guarda en `presentaciones_producto`, con una relación
protegida al producto, nombre único por producto sin distinguir mayúsculas,
uso (`compra`, `pedido`, `ambos`), estado y fechas automáticas.
`actualizado_en` permanece oculto.

Las cantidades y los pesos reales se registran al ingresar al inventario. La
presentación identifica únicamente el formato y las operaciones donde se utiliza.

### API anidada

Base: `/api/v1/productos/{producto_id}/presentaciones/`.

- GET: listado con `buscar`, `uso`, `activo`, `orden` y `pagina`.
  `uso=compra` y `uso=pedido` incluyen las de uso `ambos`.
- POST: `nombre` obligatorio y `uso` opcional, por defecto `ambos`.
- GET/PATCH `{id}/`: detalle o actualización; PATCH requiere `version`.
- POST `{id}/estado/`: `activo` y `version`, con confirmación en la interfaz.
- GET `resumen/`: contadores según búsqueda y uso, ignorando el filtro de estado.

El producto se obtiene de la URL, nunca del cuerpo. Una presentación de otro
producto devuelve 404; no se permite moverla ni borrarla físicamente. Las
inactivas conservan su nombre e historial. Crear o reactivar exige producto activo.
Los campos desconocidos se rechazan en la API y en el servicio de negocio.

Permisos independientes `view_presentacionproducto`, `add_presentacionproducto`,
`change_presentacionproducto` y `cambiar_estado_presentacionproducto`, junto con
`view_producto` para acceder a la ficha. Aparecen en Roles bajo «Presentaciones»;
la sesión los entrega en `permisos_presentaciones`. No se amplían roles existentes.

Las escrituras usan `servicios_presentaciones.py` dentro de una transacción,
bloqueando primero producto y después presentación. Los conflictos devuelven 409.
El servicio central y el middleware registran el módulo `presentaciones`, incluidos
rechazos y lecturas de rutas anidadas. Los procesos fuera de HTTP deben llamar
`guardar_presentacion` o `cambiar_estado_presentacion` para conservar la auditoría.
