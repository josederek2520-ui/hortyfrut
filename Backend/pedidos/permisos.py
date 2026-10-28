from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


def permisos_pedidos(actor):
    return {clave: actor.has_perm(f'pedidos.{codigo}') for clave, codigo in {
        'ver': 'view_pedido', 'crear': 'add_pedido', 'editar': 'change_pedido', 'cancelar': 'cancelar_pedido',
        'ver_todos': 'ver_todos_pedidos', 'gestionar_todos': 'gestionar_todos_pedidos'}.items()}


def alcance_pedidos(consulta, actor):
    if actor.has_perm('pedidos.ver_todos_pedidos') or actor.has_perm('pedidos.gestionar_todos_pedidos'):
        return consulta
    return consulta.filter(sucursal__encargado_pedidos=actor)


def comprobar_escritura(actor, sucursal, permiso):
    if not actor.is_active or not actor.has_perm(f'pedidos.{permiso}'):
        raise PermissionDenied('No tienes permiso para esta acción.')
    if not actor.has_perm('pedidos.gestionar_todos_pedidos') and sucursal.encargado_pedidos_id != actor.pk:
        raise PermissionDenied('Esta sucursal no está asignada a tu cuenta.')


class PermisosPedidos(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated or not request.user.has_perm('pedidos.view_pedido'):
            return False
        codigo = {'create': 'add_pedido', 'partial_update': 'change_pedido', 'cancelar': 'cancelar_pedido'}.get(view.action)
        return not codigo or request.user.has_perm(f'pedidos.{codigo}')
