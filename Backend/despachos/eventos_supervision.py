"""Avisos después del commit. PostgreSQL sigue siendo la fuente oficial."""
import logging
import asyncio
from django.conf import settings
from django.db import transaction

bitacora = logging.getLogger(__name__)


def nombre_grupo(despacho):
    return f'despacho.seguimiento.{despacho}'


def avisar_cambio_despacho(despacho):
    if not settings.SUPERVISION_HABILITADA:
        return

    def publicar():
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            capa = get_channel_layer()
            if capa:
                async def enviar():
                    # El commit no queda esperando indefinidamente a Redis.
                    await asyncio.wait_for(capa.group_send(nombre_grupo(despacho),
                        {'type': 'seguimiento.cambio'}), timeout=1.5)
                async_to_sync(enviar)()
        except Exception:
            # Un aviso fallido no revierte GPS, descarga, cajillas ni otros hechos confirmados.
            bitacora.warning('No se pudo publicar un aviso de supervisión del despacho %s.', despacho)

    transaction.on_commit(publicar, robust=True)
