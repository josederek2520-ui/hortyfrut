from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

CODIGOS = {'ver': 'view_venta', 'crear': 'add_venta', 'editar': 'change_venta', 'emitir': 'emitir_venta', 'cancelar': 'cancelar_venta', 'descargar': 'descargar_venta'}


def permisos_ventas(actor):
    return {clave: actor.has_perm('ventas.' + codigo) for clave, codigo in CODIGOS.items()}


def autorizar(actor, accion='ver'):
    publico = getattr(actor, '_entregas_solo_propias', False)
    actual = get_object_or_404(get_user_model(), pk=actor.pk)
    actual._entregas_solo_propias = publico
    if publico or not actual.is_active or not actual.has_perm('ventas.view_venta') or not actual.has_perm('ventas.' + CODIGOS[accion]):
        raise PermissionDenied('No tienes permiso para esta operación de Ventas y saldos en la administración local.')
    return actual


class PermisosVentas(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        autorizar(request.user, 'descargar' if view.action == 'descargar' else 'ver')
        return True
