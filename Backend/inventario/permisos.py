from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_inventario(actor):
    return {clave: actor.has_perm(f'inventario.{codigo}') for clave, codigo in {
        'ver_lotes': 'view_lote', 'cambiar_estado_lotes': 'cambiar_estado_lote',
        'ver_movimientos': 'view_movimientoinventario', 'gestionar_unidades': 'gestionar_unidades_inventario',
    }.items()}


def exigir_permiso(actor, codigo):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm(codigo):
        raise PermissionDenied('No tienes permiso para realizar esta operación de inventario.')


class PermisosLotes(BasePermission):
    def has_permission(self, request, view):
        actor = request.user
        return actor.is_authenticated and actor.is_active and actor.has_perm('inventario.view_lote') and (view.action != 'estado' or actor.has_perm('inventario.cambiar_estado_lote'))


class PermisosMovimientos(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_active and request.user.has_perm('inventario.view_movimientoinventario')


class PermisosUnidadesProducto(BasePermission):
    def has_permission(self, request, view):
        actor = request.user
        return actor.is_authenticated and actor.is_active and actor.has_perm('productos.view_producto') and (view.action == 'list' or actor.has_perm('inventario.gestionar_unidades_inventario'))
