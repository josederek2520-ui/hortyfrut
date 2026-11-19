# Tema Cristal menta claro de HortyFru

El 8 de noviembre de 2026 el tema compartido evolucionó de Soft UI y Aurora
menta a la propuesta Cristal salvia claro elegida por el usuario. Conserva las
variantes claras y oscuras y la identidad verde/naranja existente.

## Tipografía local

Outfit se conserva en `Frontend/src/app/fuentes/` como WOFF2 variable de 100 a
900, con los subconjuntos latino y latino ampliado y su licencia OFL. La
disposición principal importa `fuentes.css`; el tema, el menú, los formularios
y los gráficos mantienen el nombre de familia `Outfit`. La compilación emite
los archivos bajo `/_next/static/media/` y los sirve desde el propio sistema.
El arranque y la compilación no necesitan consultar Google Fonts. Se comprobaron
ambos archivos por HTTP, sus huellas y los grosores, además de la compilación
con la salida a internet por proxy deshabilitada.

## Superficies

El ajuste del 13 de noviembre de 2026 aplica el verde menta claro elegido por
el usuario en la propuesta visual, con un efecto glass suave. El fondo combina
`#c8ecd3`, `#dff6e5` y `#d8f4dc` con luces verdes estáticas; retira el matiz azul
del tema claro. Las tarjetas usan un velo menta al 72 % y un reflejo blanco al
22 %, con alternativa sólida `#edf8ef`. El sidebar usa cristal menta al 62 % y
la barra superior al 64 %, con desenfoque de 20 px, saturación del 125 %, borde
iluminado y sombras verdes discretas. Los campos usan `#e8f6eb`, los bordes
`#6f9177` y la selección del menú `#d0edcf`. El menú móvil conserva mayor opacidad
para mantener la legibilidad sobre el velo de la aplicación.

Solo la navegación desenfoca: las tarjetas mantienen su transparencia sin crear
contextos de apilado que afecten selectores o menús. Diálogos y capas flotantes
siguen opacos. Se mantienen tema oscuro, colores de validación, foco, movimiento
reducido, alternativa sólida sin desenfoque o con transparencia reducida y colores
del sistema en alto contraste. El cambio se concentra en los tokens compartidos;
no cambia la distribución ni las operaciones de los módulos.

Esta actualización pasó compilación de producción con TypeScript, formato CSS,
análisis de PostCSS y validación UTF-8. La lectura HTTP de localhost confirmó los
tokens nuevos en el CSS servido. Se comprobaron las parejas de texto secundario
con el fondo (5,27:1), texto de campos (13,14:1), borde de campos (3,14:1), selección
del menú (7,06:1) y texto secundario oscuro (7,60:1). La revisión visual queda a
cargo del usuario; no se automatizó su navegador ni el escritorio.

Los ajustes anteriores se conservan a continuación como historial visual.

El ajuste del 12 de noviembre de 2026 refuerza el fondo salvia y reduce la luz
casi blanca del centro, conservando el degradado menta y azul suave existente.
El menú lateral usa blanco suave con un matiz salvia ligero y una selección
menta con contorno tenue, con alternativa sólida y variante móvil de mayor
opacidad. Sus secciones permanecen siempre abiertas, con encabezados fijos sin
botones ni flechas de despliegue; en modo reducido conserva todos los accesos
por icono. Chat y Mi cuenta
permanecen al pie. Se conserva el orden operativo y el filtrado por permisos,
con desplazamiento visible para las pantallas pequeñas. Despachos
separa sus filtros en menta, los encabezados en un salvia más marcado y las
filas alternas y el pie en salvia claro; compacta los espacios verticales y
destaca «Pendiente de salida» en ámbar. Las nuevas superficies usan tokens
compartidos con variantes oscuras y colores del sistema en contraste forzado.

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
