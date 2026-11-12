# Preparación por producto en vista amplia

El 9 de noviembre de 2026 la preparación de productos dejó el panel lateral y
pasó a una vista amplia dentro de la misma jornada, conservando la disposición
de la aplicación y sus permisos. No crea otra preparación ni cambia la URL.

## Recorrido

1. Elegir la jornada por cliente y fecha desde el listado de Preparaciones.
2. Consultar sus productos y abrir el que se va a preparar.
3. Anotar cantidades, aportes de lotes, peso y previsiones de cajillas por sucursal.
4. Guardar producto: guarda el borrador completo y vuelve a los productos solo
   tras el éxito. Un error conserva la vista y lo anotado.
5. Revisar preparación desde los productos: guarda primero y abre la revisión
   con la versión recibida. Confirmar regresa al listado de jornadas.

Se admite preparación parcial. Guardar producto no confirma, no cambia los
pendientes confirmados ni genera movimientos. Los permisos de crear, editar y
confirmar, la versión, UUID y auditoría conservan sus contratos existentes.

## Disposición y navegación

`VistaProductoPreparacion` utiliza una sección normal, sin diálogo superpuesto,
portal, bloqueo del cuerpo ni foco contenido. La cabecera ofrece volver a
productos y navegación anterior/siguiente; el pie presenta el estado del borrador
y el guardado. El contenido se desplaza entre ambos y mantiene el reparto en
columnas cuando hay ancho, apilado en móvil.

La disposición mide el borde inferior de su barra fija (altura y separación
superior) y lo comparte mediante `--limite-barra-aplicacion`. La vista del producto
reserva ese espacio al abrirse y al calcular su alto, dejando visibles la imagen,
el nombre y las acciones de cabecera. La medida se actualiza con el tamaño de la
barra y de la ventana; no supone una altura fija para escritorio o móvil.

La lista permanece montada y oculta mientras se trabaja en el producto. Sus
filtros, página y documento se conservan; volver restaura el control y la posición
anteriores. Cambiar de producto no guarda automáticamente y las consultas
pendientes se cancelan al volver, conservando las reglas anteriores.

Los productos con datos persistidos en el borrador se muestran en filas verdes,
con marca «Guardado en borrador» y botón «Editar». La señal proviene de la última
respuesta guardada, también al reabrir la jornada. Las anotaciones exclusivamente
locales conservan «Continuar» y los productos nuevos, «Preparar». El verde no
modifica el pendiente confirmado ni confirma movimientos de inventario.

Los formularios de lista y producto son independientes, nunca anidados. La
validación y el foco de errores usan el formulario activo. Los errores de un
producto, sus sucursales o la separación de calidad abren la sección y página
correspondientes; los errores de contexto devuelven a la lista.

Volver a productos conserva los cambios en memoria. Salir de la jornada o seguir
un enlace interno hacia otra pantalla pide confirmar si hay cambios sin guardar;
los enlaces se bloquean durante el guardado. Recargar o cerrar la pestaña usa el
aviso del navegador. Se respetan descargas, anclas y enlaces que abren otra pestaña.

## Aspecto y comprobación

Se conservan salvia, botones menta, tarjeta blanca, sucursal seleccionada y sus
variantes oscuras. La entrada reutiliza la animación cancelable existente y su
preferencia de movimiento reducido. Alto contraste y colores forzados mantienen
sus indicadores. La navegación no fuerza el desbloqueo del cuerpo: los diálogos
de descarte y confirmación conservan el bloqueo compartido existente.

Las pruebas cubren formularios independientes, navegación, filtros y posición,
cantidades y cajillas, petición única, conflictos, permisos y revisión con la
versión guardada. La revisión visual del navegador sigue siendo manual según
las convenciones del proyecto.
