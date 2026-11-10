import hashlib
import re
import secrets
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.cache import caches
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed, APIException
from auditoria.servicios import registrar_actividad
from .servicios import exigir_usuario


class ChatNoDisponible(APIException):
    status_code = 503
    default_detail = 'No se pudo abrir la conexión del chat. Puedes volver a intentarlo.'


def autorizar_canal(solicitud):
    exigir_usuario(solicitud.user)
    origen = solicitud.META.get('HTTP_ORIGIN', '')
    if origen not in settings.CSRF_TRUSTED_ORIGINS or not solicitud.session.session_key:
        raise AuthenticationFailed('Actualiza tu sesión para abrir el chat.')
    acceso = secrets.token_urlsafe(32)
    huella = hashlib.sha256(acceso.encode()).hexdigest()
    referencia = {'usuario': solicitud.user.pk, 'sesion_web': solicitud.session.session_key, 'origen': origen}
    try:
        caches['supervision'].set('chat:acceso:' + huella, referencia, timeout=30)
    except Exception:
        raise ChatNoDisponible() from None
    return {'usuario': solicitud.user.pk, 'acceso': acceso, 'websocket': '/ws/chat/', 'vigencia_s': 30}


def validar_identidad(referencia):
    sesion = Session.objects.filter(session_key=referencia['sesion_web'], expire_date__gt=timezone.now()).first()
    datos = sesion.get_decoded() if sesion else {}
    usuario = get_user_model().objects.filter(pk=referencia['usuario'], is_active=True).first()
    if (not usuario or str(datos.get('_auth_user_id')) != str(usuario.pk)
            or not constant_time_compare(datos.get('_auth_user_hash', ''), usuario.get_session_auth_hash())):
        raise AuthenticationFailed('La sesión del chat terminó.')
    return usuario


def consumir_acceso(acceso, origen):
    if not isinstance(acceso, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', acceso):
        raise AuthenticationFailed('Acceso no válido.')
    huella = hashlib.sha256(acceso.encode()).hexdigest()
    try:
        almacenamiento = caches['supervision']
        if not almacenamiento.add('chat:usado:' + huella, True, timeout=60):
            raise AuthenticationFailed('El acceso ya se utilizó.')
        referencia = almacenamiento.get('chat:acceso:' + huella)
        almacenamiento.delete('chat:acceso:' + huella)
    except AuthenticationFailed:
        raise
    except Exception:
        raise ChatNoDisponible() from None
    if not referencia or not origen or referencia.get('origen') != origen:
        raise AuthenticationFailed('El acceso venció o corresponde a otro origen.')
    validar_identidad(referencia)
    return referencia


def auditar_canal(referencia, accion):
    registrar_actividad('chat', accion, actor=get_user_model().objects.filter(pk=referencia['usuario']).first(),
        descripcion='Conexion privada de avisos del chat', origen='sistema')
