from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied
from clientes.models import Cliente


CODIGOS = {'ver': 'view_acuerdoprecio', 'crear': 'add_acuerdoprecio', 'editar': 'change_acuerdoprecio',
    'presentar': 'presentar_acuerdoprecio', 'aceptar': 'aceptar_acuerdoprecio',
    'rechazar': 'rechazar_acuerdoprecio', 'cancelar': 'cancelar_acuerdoprecio'}


def permisos_precios(actor):
    restringido = es_supermercado(actor)
    disponible = not restringido or (actor.has_perm('precios.proponer_precios_propios') and clientes_permitidos(actor).exists())
    return {clave: bool(disponible and actor.has_perm('precios.' + codigo) and
        not (restringido and clave in ('aceptar', 'rechazar'))) for clave, codigo in CODIGOS.items()}


def es_supermercado(actor):
    return bool(getattr(actor, '_precios_solo_propios', False) or
        (not actor.is_superuser and (actor.has_perm('precios.proponer_precios_propios') or
            Cliente.objects.filter(encargado_precios_id=actor.pk).exists())))


def clientes_permitidos(actor):
    consulta = Cliente.objects.all()
    if es_supermercado(actor):
        consulta = consulta.filter(encargado_precios_id=actor.pk, activo=True)
        if not actor.has_perm('precios.proponer_precios_propios'):
            return consulta.none()
    return consulta


def acuerdos_permitidos(consulta, actor):
    return consulta.filter(cliente__in=clientes_permitidos(actor)) if es_supermercado(actor) else consulta


def cliente_inicial_precios(actor):
    if not es_supermercado(actor):
        return None
    clientes = clientes_permitidos(actor)
    cliente = clientes.first() if clientes.count() == 1 else None
    return {'id': cliente.pk, 'nombre': cliente.razon_social} if cliente else None


def exigir(actor, accion, cliente=None):
    if (not actor.is_active or (getattr(actor, '_entregas_solo_propias', False) and not getattr(actor, '_precios_solo_propios', False)) or
            not actor.has_perm('precios.view_acuerdoprecio') or not actor.has_perm('precios.' + CODIGOS[accion])):
        raise PermissionDenied('No tienes permiso para esta acción de precios.')
    if es_supermercado(actor):
        if accion in ('aceptar', 'rechazar') or not actor.has_perm('precios.proponer_precios_propios'):
            raise PermissionDenied('La aceptación y el rechazo corresponden a HortyFru.')
        if cliente is not None and (not cliente.activo or cliente.encargado_precios_id != actor.pk):
            raise PermissionDenied('Este supermercado no está asignado a tu cuenta.')
        if cliente is None and not clientes_permitidos(actor).exists():
            raise PermissionDenied('Asigna un supermercado activo a esta cuenta para proponer precios.')


class PermisosPrecios(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        try:
            exigir(request.user, 'ver')
        except PermissionDenied:
            return False
        return True
