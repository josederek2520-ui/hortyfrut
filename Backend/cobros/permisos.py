from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied


def permisos_cobros(actor):
    from pagos.permisos import es_responsable_pagos
    propio = es_responsable_pagos(actor)
    return {'ver': not propio and actor.has_perm('cobros.view_cobro'), 'registrar': not propio and actor.has_perm('cobros.add_cobro')}


def autorizar(actor, registrar=False):
    from pagos.permisos import es_responsable_pagos
    publico = getattr(actor, '_entregas_solo_propias', False) or getattr(actor, '_precios_solo_propios', False)
    actual = get_object_or_404(get_user_model(), pk=actor.pk)
    if publico or es_responsable_pagos(actor) or es_responsable_pagos(actual) or not actual.is_active or not actual.has_perm('cobros.view_cobro') or (registrar and not actual.has_perm('cobros.add_cobro')):
        raise PermissionDenied('No tienes permiso para esta operación de Cobros en la administración local.')
    return actual


class PermisosCobros(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        autorizar(request.user, request.method == 'POST')
        return True
