from rest_framework.permissions import BasePermission

MODELOS_CATALOGOS = {'unidades_medida': 'unidadmedida', 'categorias_productos': 'categoriaproducto'}
ACCIONES_CATALOGO = {'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado'}


def permisos_catalogos(usuario):
    return {clave: {accion: usuario.has_perm(f'catalogos.{prefijo}_{modelo}') for accion, prefijo in ACCIONES_CATALOGO.items()}
            for clave, modelo in MODELOS_CATALOGOS.items()}


class PermisosCatalogo(BasePermission):
    acciones = {'list': 'view', 'retrieve': 'view', 'resumen': 'view', 'create': 'add', 'partial_update': 'change', 'estado': 'cambiar_estado'}

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        prefijo = self.acciones.get(view.action)
        return not prefijo or request.user.has_perm(f'catalogos.{prefijo}_{view.modelo._meta.model_name}')
