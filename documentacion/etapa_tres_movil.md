# Etapa 3: descarga de cada pedido por el chofer

30 de octubre de 2026

## Funcionamiento

El chofer registra su llegada a la siguiente sucursal, consulta sus pedidos y confirma la descarga de cada uno. Una sucursal conserva una sola parada aunque lleve varios pedidos. En el sistema web se muestran los pedidos, sus productos y lotes, el responsable y la fecha de confirmación, y el avance «1 de 2 pedidos descargados».

La parada se completa únicamente cuando se descargó toda la carga de todos sus pedidos. Solo entonces se registra la entrega de las cajillas por color y se habilita la siguiente parada. El viaje se puede finalizar cuando terminaron todas las descargas. Ninguna de estas acciones vuelve a descontar productos de inventario.

Se confirma exclusivamente la carga transportada en este viaje. Un pedido parcialmente preparado puede tener otras cantidades pendientes fuera del despacho; esta descarga no modifica el estado global del pedido ni la conciliación futura de pesos en Entregas. Cajas y unidades se conservan separadas de los pesos reales medidos.

## Registro y trazabilidad

La descarga se registra en las mismas filas de `CargaDespacho` que ya vinculan el viaje, la parada y la asignación preparada. No se creó otra relación entre pedido, parada y despacho. Al agrupar sus filas por pedido se reúnen las distintas tandas, productos, CANT/UNI y aportes de lotes sin perder la copia de lo enviado.

Cada carga conserva `descargada_en`, `responsable_descarga` (Usuario) y `responsable_descarga_nombre`. Las filas de un mismo pedido se confirman juntas en una transacción. El viaje se bloquea mientras se comprueba la versión y se registra la operación. La evidencia central identifica el pedido, sus cargas, los pedidos confirmados y si se completó la parada. Un fallo de auditoría revierte también la descarga y cualquier movimiento de cajillas.

Los reintentos utilizan la misma `clave_operacion`. La huella incluye viaje, parada, pedido y los identificadores comprobados; el orden de la lista no altera la operación. Cambiar el contenido reutilizando una clave provoca conflicto. Dos confirmaciones simultáneas con la misma versión no se aplican sobre datos anteriores: una debe actualizar el viaje y volver a intentarlo.

## API para la aplicación del chofer

El acceso, los permisos por Usuario y la credencial Bearer son los de la etapa 2. No se amplió el acceso administrativo de los choferes.

| Método y ruta desde `/api/v1/` | Uso |
| --- | --- |
| GET `movil/mis-despachos/{id}/pedidos/?parada={id}&pagina=1` | Pedidos transportados en esa parada, agrupados antes de paginar de diez |
| GET `movil/mis-despachos/{id}/productos-pedido/?parada={id}&pedido={id}&pagina=1` | Asignaciones transportadas del pedido, con sus cantidades, preparación y aportes de lotes; diez por página |
| POST `movil/mis-despachos/{id}/descargar-pedido/` | Confirmar el pedido comprobado por el chofer |

La confirmación recibe:

```json
{
  "version": "<version_actual_del_viaje>",
  "clave_operacion": "<uuid_de_esta_operacion>",
  "parada": 1,
  "pedido": 1,
  "cargas_comprobadas": [1, 2]
}
```

Los valores del ejemplo son marcadores que la aplicación debe sustituir por los identificadores y la versión consultados. `cargas_comprobadas` incluye los `id` de todas las filas transportadas del pedido, también las que estén en otras páginas. No admite duplicados, omisiones ni filas de otro pedido. La aplicación de la etapa 4 conservará los checks al cambiar de página y reutilizará el mismo UUID al reintentar una confirmación.

La API valida que el viaje esté autorizado para el chofer autenticado, que tenga permiso de operar, que esté en ruta, que se haya registrado la llegada y que la parada sea la siguiente pendiente. Cambiar el identificador del viaje, pedido o parada no permite descargar carga ajena.

El detalle y los resúmenes añaden conteos de `pedidos` y `pedidos_descargados`. Cada pedido consultado devuelve fecha requerida, cajas, unidades, peso real transportado, estado, responsable y fecha de descarga. Los productos conservan sus códigos de preparación y lotes históricos.

## Seguimiento en la web

Las rutas administrativas de solo lectura equivalentes son `despachos/{id}/pedidos/` y `despachos/{id}/productos-pedido/`, con los mismos filtros y páginas de diez. Se consultan con permiso de ver Despachos, sin exigir administrar Productos.

El detalle muestra los pedidos de la sucursal seleccionada. Cada fila tiene su fecha requerida, cantidades, estado y un desplegable para ver productos y lotes. Los pedidos descargados muestran quién confirmó y cuándo. El botón de actualizar el viaje consulta el avance; esta etapa no implementa seguimiento GPS en vivo.

La interfaz web no ofrece la confirmación de toda la sucursal: esa tarea corresponde al chofer desde su aplicación. Se conserva el endpoint administrativo anterior `descargar/` para clientes existentes con su permiso de recorrido; internamente registra las cargas y consolida las cajillas una sola vez. El endpoint móvil anterior sigue funcionando cuando queda un único pedido pendiente. Con varios pedidos pendientes exige confirmarlos por separado con la ruta nueva.

## Historial y migración

La migración `despachos/0003_descarga_por_pedido.py` añade los tres campos a la carga. Para las paradas que ya estaban descargadas copia únicamente la fecha conocida a sus cargas. Conserva la llegada y el estado del viaje. No inventa un responsable por pedido, no crea confirmaciones nuevas ni vuelve a generar movimientos.

Estos casos se muestran como «Descarga anterior registrada por sucursal». Las cargas de paradas pendientes permanecen pendientes. La restricción de base de datos impide guardar responsable sin fecha de descarga.

No se requieren dependencias nuevas, roles adicionales ni coordenadas para este flujo. Las coordenadas reales siguen pendientes para las pruebas de mapas, conforme a la decisión del usuario.

La migración ya se aplicó en el entorno local. La comprobación anterior y posterior conservó dos viajes (uno en ruta y otro finalizado), siete cargas, ocho movimientos de cajillas y cinco movimientos de productos. Se conservaron las fechas de tres cargas históricas de la única parada completada; las cuatro cargas restantes continúan pendientes. No se confirmaron descargas reales de prueba.

## Verificación

Las pruebas cubren dos pedidos en una misma sucursal, distintas tandas y CANT/UNI del mismo pedido, lectura de lotes, permisos, acceso ajeno, llegada previa, checks completos entre páginas, reintentos, concurrencia, reversión ante fallos de auditoría y conservación del inventario. También comprueban la migración del historial sin inventar responsables y sin duplicar cajillas.

Se usa exclusivamente la base PostgreSQL aislada de la etapa cero. La interfaz se valida mediante pruebas de componentes, TypeScript, controles de código y compilación; no se automatiza el navegador ni se afirma una prueba en un teléfono.

Resultado: 484 pruebas de backend y 154 de frontend aprobadas, TypeScript y compilación de producción correctos, ESLint sin errores en Despachos y sin migraciones de modelo faltantes. Los diagnósticos de Next.js no informaron errores de configuración o sesión.

## Siguiente etapa

La etapa 4 construirá la aplicación Android: inicio de sesión, mis viajes, siguiente parada, pedidos con sus productos, checks de revisión y confirmación de descarga. Utilizará la lógica y la API ya preparadas. Los mapas corresponden a la etapa 5.
