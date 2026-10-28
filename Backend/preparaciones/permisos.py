from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


def permisos_preparaciones(actor):
    return {clave: actor.has_perm(f'preparaciones.{codigo}') for clave, codigo in {
        'ver': 'view_preparacion', 'crear': 'add_preparacion', 'editar': 'change_preparacion',
        'confirmar': 'confirmar_preparacion', 'cancelar': 'cancelar_preparacion'}.items()}


def exigir_permiso(actor, codigo='view_preparacion'):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('preparaciones.view_preparacion') or not actor.has_perm(f'preparaciones.{codigo}'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con preparaciones.')


class PermisosPreparaciones(BasePermission):
    def has_permission(self, request, view):
        codigo = {'create': 'add_preparacion', 'partial_update': 'change_preparacion', 'confirmar': 'confirmar_preparacion', 'cancelar': 'cancelar_preparacion'}.get(view.action, 'view_preparacion')
        actor = request.user
        return actor.is_authenticated and actor.is_active and actor.has_perm('preparaciones.view_preparacion') and actor.has_perm(f'preparaciones.{codigo}')
