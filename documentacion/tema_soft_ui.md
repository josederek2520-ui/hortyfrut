# Tema Cristal salvia claro de HortyFru

El 8 de noviembre de 2026 el tema compartido evolucionó de Soft UI y Aurora
menta a la propuesta Cristal salvia claro elegida por el usuario. Conserva las
variantes claras y oscuras y la identidad verde/naranja existente.

## Superficies

El ajuste del 11 de noviembre de 2026 usa un fondo menta claro (`#e9f1ed`),
luces verdes suaves en los extremos y un toque cálido naranja arriba. Las luces
son degradados estáticos sobre el fondo, sin elementos adicionales ni animación.
Las tarjetas tienen un velo casi blanco al 94 % y un reflejo discreto, con sombra
suave y cabeceras casi blancas. No usan desenfoque ni crean contextos de apilado
nuevos para sus selectores o menús. Los campos claros conservan un relieve interior
mínimo. Las filas no añaden sombras individuales: el contenido y los estados
conservan su jerarquía.

El menú lateral incorpora cristal esmerilado blanco al 66 %, desenfoque de
24 px, saturación del 125 %, un reflejo gradual y bordes iluminados. La barra
superior usa el mismo material al 84 %, con el mismo desenfoque y saturación.
Los reflejos se dibujan en el fondo, sin capas que intercepten clics.
El logotipo y los iconos conservan sus colores. El ancho y desplazamiento del
menú siguen animados; el material no se anima al cambiar de tema.

En móvil el menú utiliza un tinte blanco al 94 % para mantener el contraste sobre
la pantalla oscurecida por el velo existente. En oscuro, el menú de escritorio
usa tinte carbón al 90 %; el menú móvil, al 96 %, y la barra superior, al 90 %. Las
tarjetas usan carbón al 96 % con un reflejo mínimo. Los textos
secundarios de la navegación oscura usan el token legible del tema.

El modo oscuro usa fondo carbón con matiz salvia, navegación de cristal ahumado
y superficies algo más claras, con relieves contenidos y texto claro. El proveedor de tema y su persistencia permanecen
iguales: el botón de la cabecera alterna claro/oscuro; se conserva el modo
automático ya disponible.

## Componentes y contratos

Los tokens se definen en `Frontend/src/app/tema-hortyfru.css`. Las clases
existentes `superficie-cristal`, `panel-lateral-hortyfru` y
`barra-superior-hortyfru` conservan sus nombres para los módulos actuales.

- `control-suave-hortyfru`: controles elevados de navegación y cierre de diálogo.
- `campo-suave-hortyfru`: entradas, fechas y campos logísticos con relieve interior sutil.
  La regla normal excluye deshabilitados y estados de error/éxito, conservando sus
  colores de validación. El foco normal usa un borde verde fino y un halo tenue,
  con su variante oscura. Los campos de texto, números, fechas, áreas de texto y
  selectores dentro de la aplicación comparten ese enfoque, aunque no incluyan
  la clase. Se excluyen casillas, radios, archivos y controles especiales. En alto
  contraste o colores forzados se mantiene un contorno sólido visible sin halo.
- `superficie-flotante-suave`: menús desplegables opacos con separación del fondo.
- `pestana-hortyfru`: opción activa elevada, blanca con texto verde oscuro y
  sombra discreta; conserva superficie y texto equivalentes en oscuro. Sustituye
  el subrayado naranja por un fondo que aparece con opacidad y escala sutiles.
- `indicador-seleccionable-hortyfru`: tarjetas de filtro de Recepciones con menta
  suave y borde verde tenue al seleccionarse; los iconos mantienen su estado.
  El cursor eleva la tarjeta ligeramente y la pulsación da respuesta inmediata.

La selección usa transiciones breves de 120 a 220 ms, cancelables al volver a
cambiar de opción. Solo se animan opacidad y transformación; los datos y las
acciones responden de inmediato. Movimiento reducido retira las transiciones y
transformaciones; alto contraste refuerza el borde y los colores forzados usan
la selección del sistema. Se conservan `aria-pressed`, `aria-selected`, foco,
filtros, cantidades y estados de carga.

La vista de producto de Preparaciones separa superficies con salvia suave: fondo
`#edf2ef`, campos normales `#f0f5f2`, botones secundarios `#e5efe8` y sucursal
seleccionada `#dfeee4`. Conserva la ficha blanca y el verde del guardado. Los
tokens se limitan a `vistaProducto` en `estilosTrabajo.module.css`, con variantes
oscuras, foco y colores forzados; no cambian los errores, los valores ni el
funcionamiento de los campos. Los selectores anclados normales comparten el
relleno y borde de los campos; sus menús conservan la superficie flotante.

La preparación de un producto ocupa el ancho de la aplicación, sin panel lateral
ni velo sobre la lista. Mantiene cabecera y pie visibles, con desplazamiento del
contenido. La lista queda montada y oculta para conservar sus filtros; volver
restaura el foco y la posición. Guardar producto guarda el borrador y vuelve a
la lista; revisar guarda primero y confirmar regresa al listado de jornadas.
Detalle en `documentacion/flujo_preparacion_productos.md`.

Los botones compartidos mantienen tamaños, permisos y eventos. Los títulos con
migas ganan jerarquía y una separación más compacta respecto a su contenido.
Se conservan la marca, iconos, tablas, estados, paginación y colores operativos,
incluidas las etapas de Despachos y selecciones de Preparaciones.

Los avisos usan cristal blanco con texto oscuro en claro y cristal ahumado con
texto claro en oscuro. Icono, acento lateral, cierre y barra de duración se
adaptan al tema y al estado, conservando la pausa y el cierre existentes. Sin
desenfoque o con transparencia reducida usan su fondo sólido; el alto contraste
retira reflejos y desenfoque, y los colores forzados usan la paleta del sistema.
La navegación lateral y superior añade desenfoque; las tarjetas solo usan una
transparencia mínima y las capas flotantes siguen opacas.
Los diálogos siguen usando el portal, foco y bloqueo de desplazamiento compartidos.
El fondo es estático y no añade animaciones ni elementos que intercepten clics.
Sin soporte de desenfoque, tarjetas y navegación utilizan su superficie sólida. La
transparencia reducida mantiene estas superficies sólidas y el alto contraste retira
las luces decorativas y el desenfoque, con bordes más definidos.

## Accesibilidad y validación

Los textos y fondos nuevos se comprobaron mediante relaciones de contraste en
los dos temas. Se conserva el foco visible, la preferencia de movimiento reducido,
la alternativa de alto contraste y los colores forzados del sistema. Las sombras
no son la única señal del control o del elemento seleccionado.

La validación técnica utiliza TypeScript, ESLint del cambio, la suite web y la
compilación de producción. La revisión visual en el navegador del usuario sigue
siendo manual, según las convenciones del proyecto; no se automatiza su escritorio.

El ajuste Cristal salvia claro pasó 280 pruebas web, TypeScript, ESLint,
formato y compilación de producción. La ruta Pedidos compila en desarrollo y
Next no informa errores de configuración o de las sesiones conectadas.

En la versión del 8 de noviembre, la composición sRGB aproximada del fondo y los materiales se muestreó en 1681
puntos por tema, incluyendo saturación y los extremos del reflejo. Los mínimos
del texto secundario sobre el fondo son 4,78:1 en claro y 5,64:1 en oscuro. El
menú móvil supera 5,18:1 y la barra sobre contenido blanco/negro, 5,10:1; los
bordes de campo superan 3,56:1. Los cálculos incluyen el velo existente del menú
móvil. Esta comprobación técnica no sustituye la revisión visual manual del
resultado en el navegador.

El ajuste del 11 de noviembre pasó formato CSS y compilación de producción con
TypeScript. La composición sRGB aproximada de la navegación conserva al menos
4,62:1 para texto secundario de la cabecera clara sobre un fondo negro, 4,66:1
para la cabecera oscura sobre blanco incluyendo su reflejo y 4,92:1 para el menú
oscuro en ese mismo extremo. Se reforzó la opacidad de la navegación donde hacía
falta contraste. La revisión visual final de la interfaz permanece manual.
