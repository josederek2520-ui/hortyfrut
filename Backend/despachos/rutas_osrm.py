"""Consulta acotada a OSRM; nunca sustituye un error por una linea recta."""
import json
import math
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings
from rest_framework.exceptions import APIException, ValidationError


class ErrorCalculoRuta(APIException):
    status_code = 503
    default_code = 'ruta_no_disponible'
    default_detail = 'No se pudo calcular el recorrido. Conserva el despacho y vuelve a intentarlo.'


class SinRedirecciones(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def metrica(valor):
    if isinstance(valor, bool) or not isinstance(valor, (float, int)) or not math.isfinite(valor) or valor < 0:
        raise ErrorCalculoRuta('OSRM devolvió una distancia o duración inválida.')
    try:
        resultado = Decimal(str(valor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if resultado >= Decimal('1000000000000'):
            raise ErrorCalculoRuta('La métrica del recorrido supera el límite admitido.')
        return resultado
    except InvalidOperation:
        raise ErrorCalculoRuta('OSRM devolvió una métrica inválida.') from None


def coordenada(valor):
    if (not isinstance(valor, list) or len(valor) != 2
            or any(isinstance(numero, bool) or not isinstance(numero, (int, float)) or not math.isfinite(numero) for numero in valor)
            or not -180 <= valor[0] <= 180 or not -90 <= valor[1] <= 90):
        raise ErrorCalculoRuta('OSRM devolvió coordenadas inválidas.')
    return valor


def geometria_tramo(tramo):
    # Los pasos de OSRM delimitan el tramo real, incluso si se repite una calle.
    # Los planes anteriores sin pasos conservan su geometría global.
    if 'steps' not in tramo:
        return None
    pasos = tramo['steps']
    if not isinstance(pasos, list) or not pasos:
        raise ErrorCalculoRuta('OSRM no devolvió los pasos del tramo.')
    posiciones = []
    for paso in pasos:
        geometria = paso.get('geometry') if isinstance(paso, dict) else None
        if not isinstance(geometria, dict) or geometria.get('type') != 'LineString':
            raise ErrorCalculoRuta('OSRM no devolvió la geometría de un tramo.')
        coordenadas = geometria.get('coordinates')
        if not isinstance(coordenadas, list) or not coordenadas:
            raise ErrorCalculoRuta('Un tramo del recorrido está vacío.')
        for posicion in coordenadas:
            coordenada(posicion)
        if posiciones and posiciones[-1] != coordenadas[0]:
            raise ErrorCalculoRuta('Los pasos del tramo no son continuos.')
        posiciones.extend(coordenadas[1:] if posiciones else coordenadas)
        if len(posiciones) > 100000:
            raise ErrorCalculoRuta('La geometría del tramo supera el límite admitido.')
    if len(posiciones) < 2:
        posiciones = posiciones * 2
    return {'type': 'LineString', 'coordinates': posiciones}


def validar_resultado(datos, cantidad_puntos):
    if not isinstance(datos, dict):
        raise ErrorCalculoRuta()
    if datos.get('code') in ('NoRoute', 'NoSegment'):
        raise ValidationError({'ruta': 'No hay un recorrido por calles para todos los puntos. Revisa los accesos y coordenadas.'})
    rutas, ubicaciones = datos.get('routes'), datos.get('waypoints')
    if (datos.get('code') != 'Ok' or not isinstance(rutas, list) or not rutas
            or not isinstance(ubicaciones, list) or len(ubicaciones) != cantidad_puntos):
        raise ErrorCalculoRuta('OSRM no devolvió todos los puntos del recorrido.')
    for ubicacion in ubicaciones:
        if not isinstance(ubicacion, dict):
            raise ErrorCalculoRuta()
        coordenada(ubicacion.get('location'))
        if metrica(ubicacion.get('distance')) > Decimal(str(settings.OSRM_RADIO_ACCESO_M)):
            raise ValidationError({'ruta': 'Un punto queda demasiado lejos de una calle. Revisa el acceso real del destino.'})
    ruta = rutas[0]
    if not isinstance(ruta, dict):
        raise ErrorCalculoRuta()
    geometria = ruta.get('geometry')
    if not isinstance(geometria, dict) or geometria.get('type') != 'LineString':
        raise ErrorCalculoRuta('OSRM no devolvió el trazado del recorrido.')
    posiciones = geometria.get('coordinates')
    if not isinstance(posiciones, list) or not 2 <= len(posiciones) <= 100000:
        raise ErrorCalculoRuta('El trazado está vacío o supera el tamaño admitido.')
    for posicion in posiciones:
        coordenada(posicion)
    tramos = ruta.get('legs')
    if not isinstance(tramos, list) or len(tramos) != cantidad_puntos - 1:
        raise ErrorCalculoRuta('OSRM no devolvió todos los tramos del viaje.')
    resultado_tramos = []
    for indice, tramo in enumerate(tramos):
        if not isinstance(tramo, dict):
            raise ErrorCalculoRuta()
        resultado_tramos.append({'orden': indice + 1, 'distancia_m': str(metrica(tramo.get('distance'))),
                                 'duracion_s': str(metrica(tramo.get('duration'))),
                                 **({'geometria': geometria_tramo(tramo)} if 'steps' in tramo else {})})
    distancia, duracion = metrica(ruta.get('distance')), metrica(ruta.get('duration'))
    if (abs(sum(Decimal(tramo['distancia_m']) for tramo in resultado_tramos) - distancia) > Decimal('1')
            or abs(sum(Decimal(tramo['duracion_s']) for tramo in resultado_tramos) - duracion) > Decimal('1')):
        raise ErrorCalculoRuta('Las métricas del recorrido no coinciden con sus tramos.')
    return {'geometria': {'type': 'LineString', 'coordinates': posiciones}, 'tramos': resultado_tramos,
            'distancia_m': distancia, 'duracion_s': duracion,
            'version_datos': str(datos.get('data_version') or '')[:100]}


def solicitar_datos_osrm(puntos, servicio, opciones):
    base = settings.OSRM_URL.rstrip('/')
    try:
        servidor = urlsplit(base)
        servidor.port  # Valida también un puerto mal configurado.
    except ValueError:
        raise ErrorCalculoRuta('Revisa la dirección configurada del servidor OSRM.') from None
    if (not base or servidor.scheme not in ('https', 'http') or not servidor.hostname
            or servidor.username or servidor.password or servidor.query or servidor.fragment
            or (servidor.scheme == 'http' and servidor.hostname not in ('localhost', '127.0.0.1', '::1', *settings.OSRM_SERVIDORES_INTERNOS))):
        raise ErrorCalculoRuta('Configura un servidor OSRM HTTPS o local para calcular recorridos.')
    if len(puntos) > settings.OSRM_MAX_PUNTOS:
        raise ValidationError({'ruta': 'El recorrido supera la cantidad de puntos admitida por el servidor OSRM. No se calculó una ruta parcial.'})
    posiciones = ';'.join(f"{punto['longitud']},{punto['latitud']}" for punto in puntos)
    opciones = urlencode({**opciones, 'radiuses': ';'.join(str(settings.OSRM_RADIO_ACCESO_M) for _ in puntos)})
    solicitud = Request(f'{base}/{servicio}/v1/driving/{posiciones}?{opciones}',
                        headers={'Accept': 'application/json', 'User-Agent': 'HortyFru-Rutas/0.1'})
    try:
        with build_opener(SinRedirecciones()).open(solicitud, timeout=settings.OSRM_TIEMPO_LIMITE_S) as respuesta:
            contenido = respuesta.read(5 * 1024 * 1024 + 1)
    except HTTPError as error:
        if error.code == 400:
            try:
                datos = json.loads(error.read(4096))
                if isinstance(datos, dict) and datos.get('code') in ('NoRoute', 'NoSegment'):
                    raise ValidationError({'ruta': 'No hay un recorrido por calles para todos los destinos. Revisa sus coordenadas.'})
            except (ValueError, UnicodeError):
                pass
        raise ErrorCalculoRuta() from None
    except (URLError, TimeoutError, OSError):
        raise ErrorCalculoRuta() from None
    if len(contenido) > 5 * 1024 * 1024:
        raise ErrorCalculoRuta('La respuesta de OSRM supera el tamaño admitido.')
    try:
        return json.loads(contenido)
    except (ValueError, UnicodeError, RecursionError):
        raise ErrorCalculoRuta('OSRM no devolvió una respuesta válida.') from None


def consultar_osrm(puntos):
    datos = solicitar_datos_osrm(puntos, 'route', {
        'overview': 'full', 'geometries': 'geojson', 'steps': 'true', 'alternatives': 'false'})
    return validar_resultado(datos, len(puntos))


def consultar_alternativas_osrm(puntos):
    if len(puntos) != 2:
        raise ValidationError({'tramo': 'Compara un origen y un destino por vez.'})
    datos = solicitar_datos_osrm(puntos, 'route', {
        'overview': 'full', 'geometries': 'geojson', 'steps': 'true', 'alternatives': '2'})
    if not isinstance(datos, dict) or not isinstance(datos.get('routes'), list) or not datos['routes']:
        validar_resultado(datos, 2)
    resultados = []
    for ruta in datos['routes'][:3]:
        resultado = validar_resultado({**datos, 'routes': [ruta]}, 2)
        calles = {}
        for paso in ruta['legs'][0].get('steps', []):
            nombre = str(paso.get('name') or '').strip()[:120]
            if nombre:
                calles[nombre] = calles.get(nombre, Decimal('0')) + metrica(paso.get('distance', 0))
        resultado['calles'] = sorted(calles, key=lambda nombre: calles[nombre], reverse=True)[:3]
        resultados.append(resultado)
    return resultados


def consultar_matriz_osrm(puntos):
    datos = solicitar_datos_osrm(puntos, 'table', {'annotations': 'duration'})
    if not isinstance(datos, dict) or datos.get('code') != 'Ok':
        raise ErrorCalculoRuta('OSRM no pudo calcular la matriz completa.')
    cantidad = len(puntos)
    matriz = datos.get('durations')
    if (not isinstance(matriz, list) or len(matriz) != cantidad
            or any(not isinstance(fila, list) or len(fila) != cantidad for fila in matriz)):
        raise ErrorCalculoRuta('OSRM devolvió una matriz incompleta.')
    for campo in ('sources', 'destinations'):
        referencias = datos.get(campo)
        if not isinstance(referencias, list) or len(referencias) != cantidad:
            raise ErrorCalculoRuta('OSRM no devolvió todos los accesos de la matriz.')
        for referencia in referencias:
            if not isinstance(referencia, dict):
                raise ErrorCalculoRuta()
            coordenada(referencia.get('location'))
            if metrica(referencia.get('distance')) > Decimal(str(settings.OSRM_RADIO_ACCESO_M)):
                raise ValidationError({'ruta': 'Un acceso de la matriz queda demasiado lejos de una calle.'})
    if any(valor is None for fila in matriz for valor in fila):
        raise ValidationError({'ruta': 'Hay destinos sin conexión por carretera. No se calculó una matriz parcial.'})
    matriz = [[str(metrica(valor)) for valor in fila] for fila in matriz]
    if any(Decimal(matriz[indice][indice]) != 0 for indice in range(cantidad)):
        raise ErrorCalculoRuta('La diagonal de la matriz es inválida.')
    return {'duraciones_s': matriz, 'version_datos': str(datos.get('data_version') or '')[:100]}
