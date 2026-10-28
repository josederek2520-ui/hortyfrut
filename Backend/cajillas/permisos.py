from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_cajillas(actor):
    return {clave: actor.has_perm(f'cajillas.{codigo}') for clave, codigo in {
        'ver': 'view_cajilla', 'crear': 'add_cajilla', 'ingresar': 'registrar_ingreso',
        'enviar': 'registrar_salida', 'devolver': 'registrar_devolucion',
    }.items()}


def exigir_permiso(actor, codigo='view_cajilla'):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('cajillas.view_cajilla') or not actor.has_perm(f'cajillas.{codigo}'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con cajillas.')


class PermisosCajillas(BasePermission):
    def has_permission(self, request, view):
        actor = request.user
        return actor.is_authenticated and actor.is_active and actor.has_perm('cajillas.view_cajilla') and (view.action != 'create' or actor.has_perm('cajillas.add_cajilla'))
