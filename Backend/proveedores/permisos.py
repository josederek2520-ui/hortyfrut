from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_proveedores(usuario):
    acciones = {'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado'}
    return {accion: usuario.has_perm(f'proveedores.{prefijo}_proveedor') for accion, prefijo in acciones.items()}


def exigir_permiso(usuario, accion):
    if not usuario or not usuario.is_authenticated or not usuario.is_active or not usuario.has_perm(f'proveedores.{accion}_proveedor'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con proveedores.')


class PermisosProveedores(BasePermission):
    acciones = {'list': 'view', 'retrieve': 'view', 'resumen': 'view', 'categorias': 'view',
                'create': 'add', 'partial_update': 'change', 'estado': 'cambiar_estado'}

    def has_permission(self, request, view):
        usuario = request.user
        if not usuario.is_authenticated or not usuario.is_active:
            return False
        if view.action == 'categorias':
            return any(usuario.has_perm(f'proveedores.{accion}_proveedor') for accion in ('view', 'add', 'change'))
        accion = self.acciones.get(view.action)
        return accion is None or usuario.has_perm(f'proveedores.{accion}_proveedor')
