# Logotipos de HortyFru

Recursos utilizados por `MarcaHortyfru`:

- `logo-hortyfru-claro-transparente.png`: variante verde oscuro, PNG RGBA de 1600 x 533.
- `logo-hortyfru-oscuro-transparente.png`: variante menta, PNG RGBA de 1600 x 533.

Los fondos y los espacios entre letras tienen alfa cero. La aplicación no usa mezcla de colores ni filtros de brillo para ocultar un rectángulo. Ambas variantes conservan las dimensiones y la posición de los originales, incluida la presentación compacta de la caja.

Los JPEG originales se conservan sin modificar: `logo-hortyfru-claro.jpeg` y `logo-hortyfru-menta-original.jpeg`.

El usuario autorizó explícitamente usar Pillow para este recorte. Se procesaron los JPEG originales localmente, identificando el papel neutro, conservando los detalles blancos de la ilustración y reconstruyendo el alfa de los bordes para reducir halos. No se instaló ninguna dependencia ni se redibujaron las letras.

Comprobaciones: canal alfa, esquinas transparentes, huecos de las letras, conservación del color en áreas opacas y vista previa sobre fondos claro y oscuro.

## Icono de pestaña

`src/icons/IsotipoHortyfru.svg` es una versión vectorial simplificada de la caja con frutas, sin letras, para tamaños pequeños. También se usa como elemento decorativo en la ilustración del acceso; los logotipos completos anteriores se conservan.

Desde `Frontend`, ejecutar `node herramientas/generarIconoPestana.mjs` para exportar el vector con la dependencia `sharp` ya incluida por Next.js. Genera ambos archivos `src/app/favicon.ico` y `public/images/favicon.ico`, con transparencia y tamaños de 16, 32, 48, 64, 128 y 256 píxeles. Next.js publica automáticamente el primero en `/favicon.ico`, una ruta ya admitida por la pasarela HTTPS.

El acceso usa una sola marca completa, un formulario compacto y una ilustración decorativa visible desde escritorio. Conserva los textos en español e inglés, el control de tema compartido y el funcionamiento de autenticación. Su título de pestaña es «Iniciar sesión | HortyFru» y se traduce según el idioma activo.
