from rest_framework.permissions import BasePermission


def permisos_productos(usuario):
    acciones = {'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado'}
    return {accion: usuario.has_perm(f'productos.{prefijo}_producto') for accion, prefijo in acciones.items()}


def permisos_presentaciones(usuario):
    acciones = {'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado'}
    return {accion: usuario.has_perm(f'productos.{prefijo}_presentacionproducto') for accion, prefijo in acciones.items()}


class PermisosPresentacion(BasePermission):
    acciones = {'list': 'view', 'retrieve': 'view', 'resumen': 'view', 'create': 'add',
                'partial_update': 'change', 'estado': 'cambiar_estado'}

    def has_permission(self, request, view):
        if not request.user.is_authenticated or not request.user.has_perm('productos.view_producto'):
            return False
        prefijo = self.acciones.get(view.action)
        return not prefijo or request.user.has_perm(f'productos.{prefijo}_presentacionproducto')


class PermisosProducto(BasePermission):
    acciones = {'list': 'view', 'retrieve': 'view', 'resumen': 'view', 'imagen': 'view',
                'create': 'add', 'partial_update': 'change', 'estado': 'cambiar_estado'}

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if view.action == 'opciones':
            return request.user.has_perm('productos.view_producto')
        prefijo = self.acciones.get(view.action)
        return not prefijo or request.user.has_perm(f'productos.{prefijo}_producto')
