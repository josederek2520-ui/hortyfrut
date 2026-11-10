from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


CODIGOS = {'ver': 'view_acuerdoprecio', 'crear': 'add_acuerdoprecio', 'editar': 'change_acuerdoprecio',
    'presentar': 'presentar_acuerdoprecio', 'aceptar': 'aceptar_acuerdoprecio',
    'rechazar': 'rechazar_acuerdoprecio', 'cancelar': 'cancelar_acuerdoprecio'}


def permisos_precios(actor):
    return {clave: actor.has_perm('precios.' + codigo) for clave, codigo in CODIGOS.items()}


def exigir(actor, accion):
    if (not actor.is_active or getattr(actor, '_entregas_solo_propias', False) or
            not actor.has_perm('precios.view_acuerdoprecio') or not actor.has_perm('precios.' + CODIGOS[accion])):
        raise PermissionDenied('No tienes permiso para esta acción de Precios acordados en la administración local.')


class PermisosPrecios(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and
            not getattr(request.user, '_entregas_solo_propias', False) and request.user.has_perm('precios.view_acuerdoprecio'))
