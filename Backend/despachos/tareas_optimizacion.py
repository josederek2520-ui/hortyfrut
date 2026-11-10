import logging

from celery.exceptions import SoftTimeLimitExceeded
from django.core.exceptions import PermissionDenied as PermisoDjango
from django.http import Http404
from rest_framework.exceptions import APIException, PermissionDenied

from config.trabajos import aplicacion
from .optimizacion.servicios import finalizar_error, procesar_calculo
from .servicios import ConflictoDespacho

registro = logging.getLogger(__name__)


@aplicacion.task(name='despachos.ejecutar_optimizacion', ignore_result=True,
                soft_time_limit=55, time_limit=65)
def ejecutar_optimizacion(identificador):
    try:
        procesar_calculo(identificador)
    except (PermissionDenied, PermisoDjango, Http404, ConflictoDespacho):
        finalizar_error(identificador, 'El viaje, sus ubicaciones o la autorización cambiaron. Actualiza el despacho.', 'obsoleta')
    except SoftTimeLimitExceeded:
        finalizar_error(identificador, 'El cálculo superó el tiempo permitido. Puedes solicitarlo de nuevo.')
    except APIException as problema:
        mensaje = problema.detail if isinstance(problema.detail, str) else 'Revisa los accesos y la conexión con OSRM antes de volver a calcular.'
        finalizar_error(identificador, str(mensaje)[:250])
    except Exception:
        registro.exception('No se pudo completar el cálculo de optimización %s', identificador)
        finalizar_error(identificador, 'No se pudo completar el cálculo. El despacho conserva su recorrido anterior.')
