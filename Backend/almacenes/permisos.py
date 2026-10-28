from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_almacenes(usuario):
    return {clave: usuario.has_perm(f'almacenes.{prefijo}_almacen') for clave, prefijo in {
        'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado',
    }.items()}


def exigir_permiso(actor, accion):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('almacenes.view_almacen') or not actor.has_perm(f'almacenes.{accion}_almacen'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con almacenes.')


class PermisosAlmacenes(BasePermission):
    acciones = {'create': 'add', 'partial_update': 'change', 'estado': 'cambiar_estado'}

    def has_permission(self, request, view):
        actor = request.user
        if not actor.is_authenticated or not actor.is_active or not actor.has_perm('almacenes.view_almacen'):
            return False
        accion = self.acciones.get(view.action)
        return accion is None or actor.has_perm(f'almacenes.{accion}_almacen')
