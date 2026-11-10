"""Acceso del chofer desde la sesión web, sin exponer credenciales Bearer."""
import uuid

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView

from despachos.permisos import exigir_permiso_chofer
from .autenticacion_movil import crear_sesion_movil, revocar_sesion_movil
from .models import SesionMovil
from .permissions import AutenticacionSesion


def dispositivo_web(solicitud):
    clave = solicitud.session.session_key
    if not clave:
        raise AuthenticationFailed('Inicia sesión para consultar tus viajes.')
    return uuid.uuid5(uuid.NAMESPACE_URL, 'hortyfru:chofer:web:' + clave)


def consultar_acceso_web(solicitud, actor):
    return SesionMovil.objects.filter(usuario=actor,
        identificador_dispositivo=dispositivo_web(solicitud)).order_by('-creada_en', '-pk').first()


class AutenticacionChoferWeb(AutenticacionSesion):
    def authenticate(self, request):
        resultado = super().authenticate(request)
        if resultado is None:
            return None
        actor, _ = resultado
        exigir_permiso_chofer(actor)
        acceso = consultar_acceso_web(request, actor)
        if (acceso is None or acceso.revocada_en or acceso.vence_en <= timezone.now()
                or not constant_time_compare(acceso.huella_autenticacion, actor.get_session_auth_hash())):
            raise AuthenticationFailed('El acceso del chofer terminó. Inicia sesión nuevamente.')
        return actor, acceso


class AccesoChoferWeb(APIView):
    authentication_classes = [AutenticacionSesion]
    modulo_auditoria = 'despachos'

    @transaction.atomic
    def post(self, request):
        actor = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        exigir_permiso_chofer(actor)
        acceso = consultar_acceso_web(request, actor)
        if acceso and (acceso.revocada_en or not constant_time_compare(
                acceso.huella_autenticacion, actor.get_session_auth_hash())):
            raise AuthenticationFailed('El acceso fue revocado. Cierra sesión e ingresa nuevamente.')
        if acceso is None or acceso.vence_en <= timezone.now():
            acceso, _ = crear_sesion_movil(actor, dispositivo_web(request), 'Navegador del chofer')
        respuesta = Response({'vence_en': acceso.vence_en})
        respuesta['Cache-Control'] = 'no-store'
        return respuesta


def cerrar_acceso_chofer_web(solicitud):
    if not solicitud.session.session_key:
        return
    acceso = consultar_acceso_web(solicitud, solicitud.user)
    if acceso and not acceso.revocada_en:
        revocar_sesion_movil(solicitud.user, acceso.pk)
