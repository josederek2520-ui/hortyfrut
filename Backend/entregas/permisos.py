from django.db.models import Q
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def permisos_entregas(actor):
    return {clave: actor.has_perm(f'entregas.{codigo}') for clave, codigo in {
        'ver': 'view_entrega', 'crear': 'add_entrega', 'editar': 'change_entrega', 'enviar': 'enviar_entrega',
        'confirmar': 'confirmar_entrega', 'ver_todas': 'ver_todas_entregas', 'gestionar_todas': 'gestionar_todas_entregas'}.items()}


def todas(actor):
    if getattr(actor, '_entregas_solo_propias', False):
        return False
    return actor.has_perm('entregas.ver_todas_entregas') or actor.has_perm('entregas.gestionar_todas_entregas')


def es_oficina(actor):
    return actor.has_perm('entregas.confirmar_entrega') and not getattr(actor, '_entregas_solo_propias', False)


def acciones_recepcion(actor, sucursal):
    permisos = permisos_entregas(actor)
    propia = (sucursal.encargado_recepcion_id or sucursal.encargado_pedidos_id) == actor.pk
    alcance = propia or (permisos['gestionar_todas'] and not getattr(actor, '_entregas_solo_propias', False))
    return {'registrar': alcance and permisos['crear'], 'editar': alcance and permisos['editar'],
            'enviar': alcance and permisos['enviar'], 'revisar': alcance and es_oficina(actor)}


def alcance_cargas(consulta, actor):
    if todas(actor):
        return consulta
    return consulta.filter(Q(parada__sucursal__encargado_recepcion=actor) |
        Q(parada__sucursal__encargado_recepcion__isnull=True, parada__sucursal__encargado_pedidos=actor))


def exigir(actor, sucursal, codigo):
    if not actor.is_active or not actor.has_perm('entregas.view_entrega') or not actor.has_perm(f'entregas.{codigo}'):
        raise PermissionDenied('No tienes permiso para esta acción de Entregas.')
    if getattr(actor, '_entregas_solo_propias', False) and codigo == 'confirmar_entrega':
        raise PermissionDenied('La revisión de oficina se realiza desde el sistema local.')
    if not getattr(actor, '_entregas_solo_propias', False) and actor.has_perm('entregas.gestionar_todas_entregas'):
        return
    encargado = sucursal.encargado_recepcion_id or sucursal.encargado_pedidos_id
    if encargado != actor.pk:
        raise PermissionDenied('Esta sucursal no está asignada a tu cuenta para recepción.')


class PermisosEntregas(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_active and request.user.has_perm('entregas.view_entrega'))
