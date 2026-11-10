"""Prepara OSRM local con cartografía oficial de Bolivia; no modifica HortyFru."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


raiz = Path(__file__).resolve().parent
directorio_datos = raiz / '.datos'
imagen = 'ghcr.io/project-osrm/osrm-backend@sha256:e1929ae2818226284d7ef007329098a30851c11528ab3712bc9c8d68da78278b'
origen = 'https://download.geofabrik.de/south-america/bolivia-latest.osm.pbf'


def ejecutar(*argumentos):
    subprocess.run(argumentos, cwd=raiz, check=True)


def descargar():
    archivo = directorio_datos / 'bolivia.osm.pbf'
    comprobante = directorio_datos / 'descarga.json'
    if archivo.exists() and comprobante.exists():
        datos = json.loads(comprobante.read_text(encoding='utf-8'))
        with archivo.open('rb') as entrada:
            if hashlib.file_digest(entrada, 'md5').hexdigest() == datos['md5']:
                print('Cartografía local verificada; se conserva la descarga existente.', flush=True)
                return datos
        raise RuntimeError('La descarga local no coincide con su comprobación. Revisa .datos antes de continuar.')
    with urlopen(Request(origen, headers={'User-Agent': 'HortyFru-PreparacionOSRM/0.1'}), timeout=60) as respuesta:
        direccion = respuesta.geturl()
        if urlsplit(direccion).hostname != 'download.geofabrik.de' or not re.search(r'/bolivia-(?:latest|[0-9]{6})\.osm\.pbf$', urlsplit(direccion).path):
            raise RuntimeError('La descarga no proviene del archivo de Bolivia esperado.')
        temporal = directorio_datos / 'bolivia.osm.pbf.parte'
        suma = hashlib.md5()
        cantidad = 0
        with temporal.open('wb') as salida:
            while bloque := respuesta.read(1024 * 1024):
                suma.update(bloque)
                salida.write(bloque)
                cantidad += len(bloque)
                if cantidad % (25 * 1024 * 1024) < 1024 * 1024:
                    print(f'Descargados {cantidad // (1024 * 1024)} MB de cartografía.', flush=True)
    with urlopen(Request(direccion + '.md5', headers={'User-Agent': 'HortyFru-PreparacionOSRM/0.1'}), timeout=30) as respuesta:
        coincidencia = re.search(r'\b[0-9a-fA-F]{32}\b', respuesta.read(4096).decode('ascii'))
    if not coincidencia or coincidencia.group().lower() != suma.hexdigest():
        raise RuntimeError('La descarga no coincide con la suma publicada por Geofabrik.')
    temporal.replace(archivo)
    datos = {'origen': direccion, 'md5': suma.hexdigest(), 'bytes': cantidad}
    comprobante.write_text(json.dumps(datos, indent=2), encoding='utf-8')
    print('Cartografía de Bolivia descargada y comprobada con la suma de Geofabrik.', flush=True)
    return datos


def main():
    opciones = argparse.ArgumentParser(description=__doc__)
    opciones.add_argument('--solo-preparar', action='store_true', help='Preparar los datos sin iniciar el servicio.')
    argumentos = opciones.parse_args()
    directorio_datos.mkdir(exist_ok=True)
    ejecutar('docker', 'info', '--format', '{{.ServerVersion}}')
    datos = descargar()
    marca = directorio_datos / 'preparado.json'
    esperado = {'md5': datos['md5'], 'imagen': imagen}
    if not marca.exists() or json.loads(marca.read_text(encoding='utf-8')) != esperado:
        ejecutar('docker', 'pull', imagen)
        montaje = f'{directorio_datos}:/datos'
        for orden in [
            ['osrm-extract', '--threads', '2', '-p', '/opt/car.lua', '/datos/bolivia.osm.pbf'],
            ['osrm-partition', '--threads', '2', '/datos/bolivia.osrm'],
            ['osrm-customize', '--threads', '2', '/datos/bolivia.osrm'],
        ]:
            ejecutar('docker', 'run', '--rm', '--cpus', '2', '--memory', '4g', '-v', montaje, imagen, *orden)
        marca.write_text(json.dumps(esperado, indent=2), encoding='utf-8')
    if not argumentos.solo_preparar:
        ejecutar('docker', 'compose', '-f', 'compose.yaml', 'up', '-d')
        print('OSRM local: http://127.0.0.1:5000. El teléfono se comunica con Django, no con este puerto.', flush=True)


if __name__ == '__main__':
    main()
