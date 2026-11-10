from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

ACCIONES = {'crear': 'add_despacho', 'editar': 'change_despacho', 'iniciar': 'iniciar_despacho', 'enviar': 'enviar_despacho',
            'recorrido': 'registrar_recorrido', 'finalizar': 'finalizar_despacho', 'cancelar': 'cancelar_despacho', 'ver': 'view_despacho'}


def permisos_despachos(actor):
    return {clave: actor.has_perm(f'despachos.{codigo}') for clave, codigo in ACCIONES.items()}


def exigir_permiso(actor, accion='ver'):
    if not actor or not actor.is_authenticated or not actor.is_active or not actor.has_perm('despachos.view_despacho') or not actor.has_perm(f'despachos.{ACCIONES[accion]}'):
        raise PermissionDenied('No tienes permiso para realizar esta operación con despachos.')


def exigir_permiso_chofer(actor, operar=False):
    if (not actor or not actor.is_authenticated or not actor.is_active
            or not actor.has_perm('despachos.conducir_despacho')
            or not actor.has_perm('despachos.ver_despachos_propios')
            or (operar and not actor.has_perm('despachos.operar_despachos_propios'))):
        raise PermissionDenied('No tienes permiso para acceder a estos viajes como chofer.')


class PermisosDespachos(BasePermission):
    def has_permission(self, request, view):
        accion = {'create': 'crear', 'partial_update': 'editar', 'calcular_ruta': 'editar', 'aprobar_ruta': 'editar', 'iniciar': 'iniciar', 'enviar': 'enviar', 'llegar': 'recorrido',
                  'descargar': 'recorrido', 'finalizar': 'finalizar', 'cancelar': 'cancelar'}.get(view.action, 'ver')
        actor = request.user
        return actor.is_authenticated and actor.is_active and actor.has_perm('despachos.view_despacho') and actor.has_perm(f'despachos.{ACCIONES[accion]}')
