from django.contrib.auth import get_user_model
from auditoria.servicios import nombre_responsable


def encargado_pedidos_recepcion(sucursal, bloquear=False):
    consulta = get_user_model().objects.filter(pk=sucursal.encargado_pedidos_id, is_active=True)
    if bloquear:
        consulta = consulta.select_for_update()
    return consulta.first()


def representar_receptor(usuario):
    return {'id': usuario.pk, 'nombre': nombre_responsable(usuario)} if usuario else None
