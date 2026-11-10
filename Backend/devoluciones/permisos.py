from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_devoluciones(actor):
    return {clave: actor.has_perm(f'devoluciones.{codigo}') for clave, codigo in {
        'ver': 'view_devolucion', 'crear': 'add_devolucion', 'editar': 'change_devolucion',
        'recibir': 'recibir_devolucion', 'revisar': 'revisar_devolucion', 'cancelar': 'cancelar_devolucion'}.items()}


def exigir(actor, codigo):
    if (not actor.is_active or not actor.has_perm('devoluciones.view_devolucion') or
            not actor.has_perm(f'devoluciones.{codigo}') or getattr(actor, '_entregas_solo_propias', False)):
        raise PermissionDenied('No tienes permiso para esta acción de Devoluciones en la administración local.')


class PermisosDevoluciones(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and
                    request.user.has_perm('devoluciones.view_devolucion'))
