# OSRM local para HortyFru

Motor con datos de Bolivia, sin tráfico en vivo. No requiere cuenta ni clave de pago. Docker Desktop debe estar iniciado.

Desde Git Bash en la raíz del proyecto:

```bash
./Backend/.venv/Scripts/python.exe infraestructura/rutas/preparar_osrm.py
```

Descarga Bolivia desde Geofabrik, comprueba su MD5 y prepara el perfil `car.lua` con OSRM MLD. Usa una imagen oficial fijada por digest, dos hilos y hasta 4 GB para preparar; el servicio limita su memoria a 2 GB. `.datos/` está excluido de Git. La primera descarga y el procesamiento necesitan varios minutos; después reutiliza los archivos comprobados. Para preparar sin arrancar, añadir `--solo-preparar`.

Comandos posteriores:

```bash
docker compose -f infraestructura/rutas/compose.yaml up -d
docker compose -f infraestructura/rutas/compose.yaml ps
docker compose -f infraestructura/rutas/compose.yaml logs --tail 30
docker compose -f infraestructura/rutas/compose.yaml stop
```

Django usa `OSRM_URL=http://127.0.0.1:5000` por defecto; las opciones están en `Backend/.env.example`. El puerto se publica solo en localhost. El celular y la web consultan Django, que aplica permisos y conserva el plan. Para otra instalación, preparar el motor allí y configurar su URL; no publicar este puerto directamente en Internet.

El script conserva el extracto ya verificado; no actualiza silenciosamente los datos. Para actualizar la cartografía, detener el servicio y conservar la carpeta anterior como respaldo antes de preparar una carpeta `.datos` nueva. Los planes guardados en PostgreSQL conservan su geometría anterior.

Cartografía: [Geofabrik Bolivia](https://download.geofabrik.de/south-america/bolivia.html), datos de [OpenStreetMap](https://www.openstreetmap.org/copyright). Motor: [OSRM](https://github.com/Project-OSRM/osrm-backend). El perfil estático no proporciona tráfico ni certifica restricciones de camiones.

El procedimiento de la aplicación y las pruebas está en [Etapa 5](../../documentacion/etapa_cinco_movil.md).
