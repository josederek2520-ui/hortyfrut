"""Canal de lectura autorizado. No admite acciones sobre el reparto."""
import asyncio
import json
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from .eventos_supervision import nombre_grupo
from .supervision import consumir_acceso_supervision, consultar_desde_canal, auditar_canal


class CanalSupervision(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.referencia = None
        self.grupo = None
        self.tarea_control = None
        await self.accept()
        self.limite_acceso = asyncio.create_task(self.vencer_acceso())

    async def vencer_acceso(self):
        await asyncio.sleep(5)
        if self.referencia is None:
            await self.close(code=4401)

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        if not text_data or len(text_data) > 2048 or bytes_data is not None:
            await self.close(code=4400)
            return
        try:
            contenido = json.loads(text_data)
        except (ValueError, TypeError):
            await self.close(code=4400)
            return
        await self.receive_json(contenido)

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            await self.close(code=4400)
            return
        if self.referencia is not None:
            if content == {'tipo': 'actualizar'}:
                await self.seguimiento_cambio({})
            else:
                await self.close(code=4400)
            return
        if content.get('tipo') != 'autorizar' or set(content) != {'tipo', 'acceso'}:
            await self.close(code=4401)
            return
        try:
            identificador = int(self.scope['url_route']['kwargs']['identificador'])
            self.referencia = await database_sync_to_async(consumir_acceso_supervision)(content['acceso'], identificador)
            self.limite_acceso.cancel()
            self.grupo = nombre_grupo(identificador)
            await self.channel_layer.group_add(self.grupo, self.channel_name)
            await database_sync_to_async(auditar_canal)(self.referencia, 'abrir_supervision')
            if await self.seguimiento_cambio({}):
                self.tarea_control = asyncio.create_task(self.controlar())
        except PermissionDenied:
            await self.close(code=4403)
        except AuthenticationFailed:
            await self.close(code=4401)
        except Exception:
            await self.close(code=1013)

    async def controlar(self):
        try:
            while True:
                await asyncio.sleep(max(0.05, settings.SUPERVISION_INTERVALO_CONTROL_S))
                # Los controles y avisos se procesan en la misma cola del consumidor.
                await self.channel_layer.send(self.channel_name, {'type': 'seguimiento.cambio'})
        except asyncio.CancelledError:
            return
        except Exception:
            await self.close(code=1013)

    async def seguimiento_cambio(self, event):
        if not self.referencia:
            return
        try:
            datos = await database_sync_to_async(consultar_desde_canal)(self.referencia)
            await self.send_json({'tipo': 'seguimiento', 'datos': datos})
            return True
        except PermissionDenied:
            await self.close(code=4403)
        except AuthenticationFailed:
            await self.close(code=4401)
        except Exception:
            await self.close(code=1013)
        return False

    async def disconnect(self, close_code):
        tareas = [tarea for tarea in (getattr(self, 'limite_acceso', None), self.tarea_control) if tarea]
        for tarea in tareas:
            tarea.cancel()
        if tareas:
            await asyncio.gather(*tareas, return_exceptions=True)
        if self.grupo:
            try:
                await self.channel_layer.group_discard(self.grupo, self.channel_name)
            except Exception:
                pass
        if self.referencia:
            await database_sync_to_async(auditar_canal)(self.referencia, 'cerrar_supervision')

    @classmethod
    async def encode_json(cls, content):
        return json.dumps(content, cls=DjangoJSONEncoder)
