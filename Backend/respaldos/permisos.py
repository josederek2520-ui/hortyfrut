from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_respaldos(actor):
    return {clave: bool(actor.is_active and actor.has_perm('respaldos.' + codigo)) for clave, codigo in {
        'ver': 'view_respaldo', 'crear': 'add_respaldo', 'descargar': 'descargar_respaldo'}.items()}


def exigir_permiso(actor, accion='ver'):
    permisos = permisos_respaldos(actor) if actor and actor.is_authenticated else {}
    if settings.ROOT_URLCONF != 'config.urls' or not permisos.get('ver') or not permisos.get(accion):
        raise PermissionDenied('No tienes permiso para realizar esta operación con respaldos.')


class PermisosRespaldos(BasePermission):
    def has_permission(self, request, view):
        exigir_permiso(request.user, {'create': 'crear', 'descargar': 'descargar'}.get(view.action, 'ver'))
        return True
