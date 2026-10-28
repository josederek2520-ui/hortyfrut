from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_recepciones(actor):
    return {clave: actor.has_perm(f'recepciones.{codigo}') for clave, codigo in {
        'ver': 'view_recepcion', 'crear': 'add_recepcion', 'editar': 'change_recepcion',
        'confirmar': 'confirmar_recepcion', 'cancelar': 'cancelar_recepcion',
    }.items()}


def exigir_permiso(actor, codigo):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('recepciones.view_recepcion') or not actor.has_perm(f'recepciones.{codigo}'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con recepciones.')


class PermisosRecepciones(BasePermission):
    def has_permission(self, request, view):
        actor = request.user
        if not actor.is_authenticated or not actor.is_active or not actor.has_perm('recepciones.view_recepcion'):
            return False
        codigo = {'create': 'add_recepcion', 'partial_update': 'change_recepcion', 'confirmar': 'confirmar_recepcion', 'cancelar': 'cancelar_recepcion'}.get(view.action)
        return codigo is None or actor.has_perm(f'recepciones.{codigo}')
