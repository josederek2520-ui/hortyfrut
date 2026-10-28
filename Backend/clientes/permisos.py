from rest_framework.permissions import BasePermission


def permisos_comerciales(usuario, modelo):
    acciones = {'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado'}
    return {accion: usuario.has_perm(f'clientes.{prefijo}_{modelo}') for accion, prefijo in acciones.items()}


class PermisosDirectorio(BasePermission):
    acciones = {'list': 'view', 'retrieve': 'view', 'resumen': 'view', 'create': 'add', 'partial_update': 'change', 'estado': 'cambiar_estado'}

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        modelo = view.modelo._meta.model_name
        if modelo == 'sucursal' and not request.user.has_perm('clientes.view_cliente'):
            return False
        prefijo = self.acciones.get(view.action)
        return not prefijo or request.user.has_perm(f'clientes.{prefijo}_{modelo}')
