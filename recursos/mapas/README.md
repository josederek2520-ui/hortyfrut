# Iconos del mapa

SVG proporcionados por el usuario: `almacen.svg` y `sucursales.svg`. Los originales
incluían el comentario de procedencia «Uploaded to: SVG Repo, www.svgrepo.com,
Generator: SVG Repo Mixer Tools». Se conservan sus trazados y colores interiores;
se normalizaron tamaño, atributos de relleno y cabecera para web y React Native SVG.

La etapa 7 añade `camion.svg`, también entregado por el usuario. Conserva sus
trazados y colores; solo se normalizaron atributos SVG. Identifica una ubicación
GPS medida, junto con su área de precisión. No se dibuja en el origen ni se mueve
por la ruta para simular posiciones.

El pin de sucursal toma el color del destino. El almacén conserva la ilustración
original con borde verde. El número y el nombre identifican el destino además del
color. Los tramos usan geometría de los pasos de OSRM, sin dividirlos por cercanía
a un punto ni inventar geometrías para planes históricos.

La fuente canónica está en esta carpeta. Para regenerar los adaptadores:

```bash
./Backend/.venv/Scripts/python.exe herramientas/sincronizar_iconos_mapa.py
```
