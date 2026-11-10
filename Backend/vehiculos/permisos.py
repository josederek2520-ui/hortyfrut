from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_vehiculos(actor):
    return {clave: actor.has_perm(f'vehiculos.{codigo}_vehiculo') for clave, codigo in {
        'ver': 'view', 'crear': 'add', 'editar': 'change', 'cambiar_estado': 'cambiar_estado'}.items()}


def exigir_permiso(actor, accion='view'):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('vehiculos.view_vehiculo') or not actor.has_perm(f'vehiculos.{accion}_vehiculo'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con vehículos.')


class PermisosVehiculos(BasePermission):
    def has_permission(self, request, view):
        accion = {'create': 'add', 'partial_update': 'change', 'estado': 'cambiar_estado'}.get(view.action, 'view')
        actor = request.user
        return actor.is_authenticated and actor.is_active and actor.has_perm('vehiculos.view_vehiculo') and actor.has_perm(f'vehiculos.{accion}_vehiculo')
