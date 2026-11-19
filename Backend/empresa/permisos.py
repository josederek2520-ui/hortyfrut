from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_empresa(actor):
    return {'ver': actor.has_perm('empresa.view_datosempresa'), 'editar': actor.has_perm('empresa.change_datosempresa')}


def autorizar(actor, editar=False):
    publico = getattr(actor, '_entregas_solo_propias', False) or getattr(actor, '_precios_solo_propios', False)
    actual = get_object_or_404(get_user_model(), pk=actor.pk)
    if publico or not actual.is_active or not actual.has_perm('empresa.view_datosempresa') or (editar and not actual.has_perm('empresa.change_datosempresa')):
        raise PermissionDenied('No tienes permiso para gestionar los datos de la empresa en la administración local.')
    return actual


class PermisosEmpresa(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        autorizar(request.user, request.method == 'POST')
        return True
