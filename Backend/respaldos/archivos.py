"""Paquete ZIP estándar, privado y sin secretos de configuración ni copias recursivas."""
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import time
import zipfile
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.db import connection


class ErrorRespaldo(Exception):
    pass


def directorio_respaldos():
    raiz = Path(settings.RESPALDOS_DIRECTORIO).resolve()
    prohibidos = [Path(settings.MEDIA_ROOT).resolve(), Path(settings.BASE_DIR).parent / 'Frontend' / 'public',
                  Path(getattr(settings, 'ENTREGAS_ARCHIVOS_DIR', settings.BASE_DIR / 'privado' / 'entregas')).resolve()]
    if any(raiz == ruta or raiz.is_relative_to(ruta) or ruta.is_relative_to(raiz) for ruta in prohibidos):
        raise ErrorRespaldo('Configura una carpeta privada de respaldos separada de fotos y comprobantes.')
    raiz.mkdir(parents=True, exist_ok=True, mode=0o700)
    return raiz


def ruta_respaldo(respaldo):
    raiz = directorio_respaldos()
    historico = re.fullmatch(r'hortyfru_\d{2}-\d{2}-\d{4}_\d{6}_' + respaldo.pk.hex[:8] + r'\.zip', respaldo.nombre)
    if respaldo.nombre != respaldo.nombre_publico and not historico:
        raise ErrorRespaldo('El nombre del respaldo no es válido.')
    carpeta = raiz / respaldo.pk.hex
    if carpeta.is_symlink() or not carpeta.resolve().is_relative_to(raiz):
        raise ErrorRespaldo('No se pudo acceder al archivo privado del respaldo.')
    archivo = carpeta / respaldo.nombre
    if archivo.is_symlink() or not archivo.resolve().is_relative_to(raiz):
        raise ErrorRespaldo('No se pudo acceder al archivo privado del respaldo.')
    return archivo


def binario_postgres(nombre):
    carpeta = settings.RESPALDOS_PG_BIN
    if carpeta:
        candidato = Path(carpeta) / (nombre + ('.exe' if os.name == 'nt' else ''))
    else:
        encontrado = shutil.which(nombre)
        candidato = Path(encontrado) if encontrado else Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'PostgreSQL' / str(connection.pg_version // 10000) / 'bin' / (nombre + '.exe')
    if not candidato.is_file():
        raise ErrorRespaldo('No se encontraron las herramientas de PostgreSQL. Configura RESPALDOS_PG_BIN.')
    return str(candidato)


def comprobar_tiempo(limite):
    if time.monotonic() >= limite:
        raise ErrorRespaldo('El respaldo excedió su tiempo máximo. Intenta nuevamente fuera del horario de trabajo.')


def ejecutar_herramienta(argumentos, limite):
    comprobar_tiempo(limite)
    entorno = os.environ.copy()
    conexion = connection.get_connection_params()
    # Valores de conexión como entorno, nunca argumentos, registros ni manifiesto.
    for variable in tuple(entorno):
        if variable.startswith('PG'):
            entorno.pop(variable)
    for clave, variable in [('dbname', 'PGDATABASE'), ('user', 'PGUSER'), ('password', 'PGPASSWORD'),
                            ('host', 'PGHOST'), ('port', 'PGPORT'), ('sslmode', 'PGSSLMODE'),
                            ('sslrootcert', 'PGSSLROOTCERT'), ('sslcert', 'PGSSLCERT'), ('sslkey', 'PGSSLKEY')]:
        if conexion.get(clave) is not None:
            entorno[variable] = str(conexion[clave])
    entorno['PGCONNECT_TIMEOUT'] = '10'
    try:
        subprocess.run(argumentos, env=entorno, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, check=True, timeout=max(1, limite - time.monotonic()),
                       **({'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}))
    except (subprocess.SubprocessError, OSError):
        raise ErrorRespaldo('No se pudo exportar o comprobar la base de datos. Revisa PostgreSQL y vuelve a intentar.') from None


def exportar_base(destino, instantanea, limite):
    ejecutar_herramienta([binario_postgres('pg_dump'), '--no-password', '--format=custom', '--compress=0',
                         '--snapshot=' + instantanea, '--file=' + str(destino)], limite)
    ejecutar_herramienta([binario_postgres('pg_restore'), '--list', str(destino)], limite)


def archivo_permitido(raiz, relativo):
    nombre = PurePosixPath(str(relativo).replace('\\', '/'))
    if nombre.is_absolute() or any(parte in ('..', '.', '') or ':' in parte for parte in nombre.parts):
        raise ErrorRespaldo('Hay un archivo con una ubicación no permitida. Revisa las fotos y comprobantes.')
    raiz = Path(raiz).resolve()
    candidato = raiz.joinpath(*nombre.parts)
    if any(ruta.is_symlink() for ruta in [candidato, *candidato.parents] if ruta != raiz.parent):
        raise ErrorRespaldo('Las fotos y comprobantes del respaldo no pueden ser enlaces simbólicos.')
    if not candidato.resolve().is_relative_to(raiz) or not candidato.is_file():
        raise ErrorRespaldo('Falta una foto o comprobante referenciado. Revisa los archivos antes de crear el respaldo.')
    return candidato, nombre.as_posix()


def copiar_archivo(origen, destino, limite):
    destino.parent.mkdir(parents=True, exist_ok=True)
    suma, tamano = hashlib.sha256(), 0
    opciones = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0)
    with os.fdopen(os.open(origen, opciones), 'rb') as entrada, destino.open('xb') as salida:
        if not stat.S_ISREG(os.fstat(entrada.fileno()).st_mode):
            raise ErrorRespaldo('El respaldo solo admite archivos regulares.')
        while bloque := entrada.read(1024 * 1024):
            comprobar_tiempo(limite)
            salida.write(bloque)
            suma.update(bloque)
            tamano += len(bloque)
    return {'tamano_bytes': tamano, 'sha256': suma.hexdigest()}


def suma_archivo(archivo):
    with archivo.open('rb') as entrada:
        return hashlib.file_digest(entrada, 'sha256').hexdigest()


def empaquetar(directorio, destino, informacion, limite):
    manifiesto = directorio / 'informacion.json'
    manifiesto.write_text(json.dumps(informacion, ensure_ascii=False, indent=2), encoding='utf-8')
    with zipfile.ZipFile(destino, 'x', compression=zipfile.ZIP_DEFLATED, allowZip64=True) as paquete:
        for archivo in sorted(directorio.rglob('*')):
            comprobar_tiempo(limite)
            if archivo.is_file():
                paquete.write(archivo, archivo.relative_to(directorio).as_posix())
    with zipfile.ZipFile(destino) as paquete:
        if paquete.testzip() is not None:
            raise ErrorRespaldo('No se pudo comprobar la integridad del ZIP.')
