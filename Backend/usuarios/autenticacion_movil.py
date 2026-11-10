"""Credenciales opacas por dispositivo, independientes de la sesión web."""
import hashlib
import re
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from auditoria.servicios import registrar_actividad
from despachos.permisos import exigir_permiso_chofer
from .models import SesionMovil


def exigir_conexion_movil(solicitud):
    if not settings.DEBUG and not solicitud.is_secure():
        raise PermissionDenied('El acceso móvil requiere una conexión HTTPS.')


def resumen_credencial(valor):
    return hashlib.sha256(valor.encode('ascii')).hexdigest()


@transaction.atomic
def crear_sesion_movil(usuario, identificador_dispositivo, nombre_dispositivo):
    huella_previa = usuario.get_session_auth_hash()
    usuario = get_user_model().objects.select_for_update().get(pk=usuario.pk)
    if not constant_time_compare(huella_previa, usuario.get_session_auth_hash()):
        raise AuthenticationFailed('Las credenciales cambiaron. Inicia sesión nuevamente.')
    exigir_permiso_chofer(usuario)
    momento = timezone.now()
    from despachos.seguimiento import cerrar_seguimientos_acceso
    anteriores = list(SesionMovil.objects.select_for_update().filter(usuario=usuario,
        identificador_dispositivo=identificador_dispositivo, revocada_en__isnull=True).order_by('pk'))
    SesionMovil.objects.filter(usuario=usuario, identificador_dispositivo=identificador_dispositivo, revocada_en__isnull=True).update(revocada_en=momento)
    for anterior in anteriores:
        cerrar_seguimientos_acceso(anterior, usuario)
    identificador = uuid.uuid4()
    credencial = f'{identificador.hex}.{secrets.token_urlsafe(32)}'
    sesion = SesionMovil.objects.create(id=identificador, usuario=usuario,
        identificador_dispositivo=identificador_dispositivo, nombre_dispositivo=nombre_dispositivo,
        resumen_credencial=resumen_credencial(credencial), huella_autenticacion=usuario.get_session_auth_hash(),
        vence_en=momento + timedelta(hours=12))
    registrar_actividad('autenticacion', 'iniciar_sesion_movil', actor=usuario, objeto=sesion,
                       descripcion='Acceso móvil por dispositivo')
    return sesion, credencial


@transaction.atomic
def revocar_sesion_movil(actor, identificador):
    sesion = get_object_or_404(SesionMovil.objects.select_for_update(), pk=identificador, usuario=actor)
    if sesion.revocada_en is None:
        sesion.revocada_en = timezone.now()
        sesion.save(update_fields=['revocada_en'])
        from despachos.seguimiento import cerrar_seguimientos_acceso
        cerrar_seguimientos_acceso(sesion, actor)
        registrar_actividad('autenticacion', 'revocar_acceso_movil', actor=actor, objeto=sesion)
    return sesion


class AutenticacionMovil(BaseAuthentication):
    def authenticate_header(self, request):
        return 'Bearer'

    def authenticate(self, request):
        exigir_conexion_movil(request)
        cabecera = get_authorization_header(request).split()
        if not cabecera:
            return None
        if len(cabecera) != 2 or cabecera[0].lower() != b'bearer':
            raise AuthenticationFailed('Credencial móvil no válida.')
        try:
            credencial = cabecera[1].decode('ascii')
        except UnicodeDecodeError:
            raise AuthenticationFailed('Credencial móvil no válida.') from None
        if not re.fullmatch(r'[0-9a-f]{32}\.[A-Za-z0-9_-]{43}', credencial):
            raise AuthenticationFailed('Credencial móvil no válida.')
        sesion = SesionMovil.objects.select_related('usuario').filter(pk=uuid.UUID(credencial[:32])).first()
        if (sesion is None or sesion.revocada_en is not None or sesion.vence_en <= timezone.now()
                or not constant_time_compare(sesion.resumen_credencial, resumen_credencial(credencial))
                or not sesion.usuario.is_active
                or not constant_time_compare(sesion.huella_autenticacion, sesion.usuario.get_session_auth_hash())):
            raise AuthenticationFailed('La sesión móvil terminó. Inicia sesión nuevamente.')
        return sesion.usuario, sesion
