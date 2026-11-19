from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from clientes.models import Cliente


def es_responsable_pagos(actor):
    return bool(getattr(actor, '_pagos_solo_propios', False) or (not actor.is_superuser and (
        actor.has_perm('pagos.consultar_pagos_propios') or Cliente.objects.filter(encargado_pagos_id=actor.pk).exists())))


def clientes_propios(actor):
    return Cliente.objects.filter(encargado_pagos_id=actor.pk)


def autorizar_propios(actor, informar=False, cliente_id=None):
    actual = get_object_or_404(get_user_model(), pk=actor.pk)
    actual._pagos_solo_propios = True
    if not actual.is_active or not actual.has_perm('pagos.consultar_pagos_propios') or (informar and not actual.has_perm('pagos.informar_pagos_propios')):
        raise PermissionDenied('No tienes acceso a los pagos de este supermercado.')
    if cliente_id is not None:
        get_object_or_404(clientes_propios(actual), pk=cliente_id)
    return actual


def autorizar_oficina(actor, accion='consultar'):
    publico = any(getattr(actor, campo, False) for campo in ['_pagos_solo_propios', '_precios_solo_propios', '_entregas_solo_propias'])
    limitado = es_responsable_pagos(actor)
    actual = get_object_or_404(get_user_model(), pk=actor.pk)
    if publico or limitado or es_responsable_pagos(actual) or not actual.is_active or not actual.has_perm('pagos.view_avisopago'):
        raise PermissionDenied('La verificación de pagos corresponde a la oficina local de HortyFru.')
    if accion in ['confirmar', 'observar'] and not actual.has_perm('pagos.' + accion + '_avisopago'):
        raise PermissionDenied('No tienes permiso para esta decisión sobre el pago.')
    if accion == 'confirmar' and not all(actual.has_perm('cobros.' + permiso) for permiso in ['view_cobro', 'add_cobro']):
        raise PermissionDenied('Confirmar un pago requiere permiso para registrar el cobro recibido.')
    return actual


def permisos_propios(actor):
    ver = actor.is_active and actor.has_perm('pagos.consultar_pagos_propios') and clientes_propios(actor).exists()
    return {'ver': bool(ver), 'informar': bool(ver and actor.has_perm('pagos.informar_pagos_propios'))}


def permisos_oficina(actor):
    publico = any(getattr(actor, campo, False) for campo in ['_pagos_solo_propios', '_precios_solo_propios', '_entregas_solo_propias'])
    ver = actor.is_active and not publico and not es_responsable_pagos(actor) and actor.has_perm('pagos.view_avisopago')
    return {'ver': bool(ver), 'confirmar': bool(ver and actor.has_perm('pagos.confirmar_avisopago') and actor.has_perm('cobros.view_cobro') and actor.has_perm('cobros.add_cobro')),
        'observar': bool(ver and actor.has_perm('pagos.observar_avisopago'))}


def cliente_inicial_pagos(actor):
    filas = list(clientes_propios(actor).order_by('pk')[:2])
    return {'id': filas[0].pk, 'nombre': filas[0].razon_social, 'nit': filas[0].nit} if len(filas) == 1 else None


class PermisoPropios(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        request.user = autorizar_propios(request.user, request.method == 'POST')
        return True


class PermisoOficina(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        accion = getattr(view, 'action', '')
        autorizar_oficina(request.user, 'confirmar' if accion in ['confirmar', 'revisar'] else 'observar' if accion == 'observar' else 'consultar')
        return True
