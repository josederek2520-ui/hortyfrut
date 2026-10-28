from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_compras(usuario):
    return {clave: usuario.has_perm(f'compras.{codigo}') for clave, codigo in {
        'ver': 'view_compra', 'crear': 'add_compra', 'editar': 'change_compra',
        'registrar': 'registrar_compra', 'cancelar': 'cancelar_compra',
    }.items()}


def exigir_permiso(actor, codigo):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('compras.view_compra') or not actor.has_perm(f'compras.{codigo}'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con compras.')


class PermisosCompras(BasePermission):
    def has_permission(self, request, view):
        actor = request.user
        if not actor.is_authenticated or not actor.is_active or not actor.has_perm('compras.view_compra'):
            return False
        codigo = {'create': 'add_compra', 'partial_update': 'change_compra', 'registrar': 'registrar_compra', 'cancelar': 'cancelar_compra'}.get(view.action)
        return codigo is None or actor.has_perm(f'compras.{codigo}')
