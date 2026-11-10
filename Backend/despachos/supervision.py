"""Consultas de supervisión y acceso efímero, ligado al viaje y sesión web."""
import hashlib
import re
import secrets
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.cache import caches
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed, APIException
from auditoria.servicios import registrar_actividad
from .models import Despacho
from .modelos_seguimiento import SesionSeguimiento
from .permisos import exigir_permiso
from .servicios import version_despacho
from .seguimiento import mostrar_sesion


class SupervisionNoDisponible(APIException):
    status_code = 503
    default_detail = 'El seguimiento en vivo no está disponible. Puedes seguir consultando el viaje.'


def exigir_supervision():
    if not settings.SUPERVISION_HABILITADA:
        raise SupervisionNoDisponible()


def autorizar_acceso_supervision(solicitud, identificador):
    exigir_supervision()
    exigir_permiso(solicitud.user)
    despacho = get_object_or_404(Despacho, pk=identificador)
    if not solicitud.session.session_key:
        raise AuthenticationFailed('Inicia sesión nuevamente.')
    acceso = secrets.token_urlsafe(32)
    huella = hashlib.sha256(acceso.encode('ascii')).hexdigest()
    referencia = {'usuario': solicitud.user.pk, 'despacho': despacho.pk, 'sesion_web': solicitud.session.session_key}
    try:
        caches['supervision'].set('acceso:' + huella, referencia, timeout=30)
    except Exception:
        raise SupervisionNoDisponible() from None
    registrar_actividad('despachos', 'autorizar_supervision', actor=solicitud.user, objeto=despacho,
        descripcion='Acceso efímero al seguimiento del viaje')
    return {'despacho': despacho.pk, 'acceso': acceso, 'websocket': f'/ws/seguimiento/{despacho.pk}/', 'vigencia_s': 30}


def consumir_acceso_supervision(acceso, identificador):
    if not isinstance(acceso, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', acceso):
        raise AuthenticationFailed('Acceso no válido.')
    huella = hashlib.sha256(acceso.encode('ascii')).hexdigest()
    exigir_supervision()
    try:
        almacenamiento = caches['supervision']
        if not almacenamiento.add('usado:' + huella, True, timeout=60):
            raise AuthenticationFailed('El acceso ya se utilizó.')
        referencia = almacenamiento.get('acceso:' + huella)
        almacenamiento.delete('acceso:' + huella)
    except AuthenticationFailed:
        raise
    except Exception:
        raise SupervisionNoDisponible() from None
    if not referencia or referencia.get('despacho') != identificador:
        raise AuthenticationFailed('El acceso venció o corresponde a otro viaje.')
    validar_supervisor(referencia)
    return referencia


def validar_supervisor(referencia):
    exigir_supervision()
    sesion = Session.objects.filter(session_key=referencia['sesion_web'], expire_date__gt=timezone.now()).first()
    datos = sesion.get_decoded() if sesion else {}
    actor = get_user_model().objects.filter(pk=referencia['usuario'], is_active=True).first()
    if (not actor or str(datos.get('_auth_user_id')) != str(actor.pk)
            or not constant_time_compare(datos.get('_auth_user_hash', ''), actor.get_session_auth_hash())):
        raise AuthenticationFailed('La sesión web terminó.')
    exigir_permiso(actor)
    return actor


@transaction.atomic
def consultar_supervision(actor, identificador):
    exigir_supervision()
    exigir_permiso(actor)
    # Las escrituras del viaje y GPS bloquean esta misma fila; la consulta no escribe.
    despacho = get_object_or_404(Despacho.objects.select_for_update(), pk=identificador)
    progreso = despacho.paradas.aggregate(total=Count('pk'), completadas=Count('pk', filter=Q(descargada_en__isnull=False)))
    siguiente = despacho.paradas.filter(descargada_en__isnull=True).order_by('orden').values('id', 'cliente_nombre', 'sucursal_nombre', 'llegada_en').first()
    sesion = SesionSeguimiento.objects.select_related('ultima_posicion', 'sesion_movil').filter(despacho=despacho).first()
    seguimiento = mostrar_sesion(sesion)
    if seguimiento:
        seguimiento['activa'] = seguimiento['activa'] and not sesion.sesion_movil.revocada_en and despacho.estado == 'en_ruta'
    return {'despacho': despacho.pk, 'version_despacho': version_despacho(despacho), 'estado': despacho.estado,
        'seguimiento': seguimiento, 'progreso': {**progreso, 'siguiente': {
            **siguiente, 'llegada_en': siguiente['llegada_en'].isoformat() if siguiente['llegada_en'] else None,
        } if siguiente else None}, 'consultado_en': timezone.now().isoformat()}


def consultar_desde_canal(referencia):
    return consultar_supervision(validar_supervisor(referencia), referencia['despacho'])


def auditar_canal(referencia, accion):
    registrar_actividad('despachos', accion,
        actor=get_user_model().objects.filter(pk=referencia['usuario']).first(),
        objeto_id=referencia['despacho'], objeto_tipo='despachos.despacho',
        descripcion='Consulta del seguimiento en vivo', origen='sistema')
