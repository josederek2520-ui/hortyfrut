import asyncio
import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from .acceso import consumir_acceso, validar_identidad, auditar_canal
from .servicios import grupo_usuario, resumen_buzon


def consultar_canal(referencia):
    return resumen_buzon(validar_identidad(referencia))


class CanalChat(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.referencia = None
        self.grupo = None
        self.control = None
        await self.accept()
        self.vencimiento = asyncio.create_task(self.vencer_acceso())

    async def vencer_acceso(self):
        await asyncio.sleep(5)
        if self.referencia is None:
            await self.close(code=4401)

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        if self.referencia is not None or not text_data or len(text_data) > 1024 or bytes_data is not None:
            await self.close(code=4400)
            return
        try:
            contenido = json.loads(text_data)
            if not isinstance(contenido, dict) or set(contenido) != {'tipo', 'acceso'} or contenido['tipo'] != 'autorizar':
                raise AuthenticationFailed()
            origen = dict(self.scope.get('headers', [])).get(b'origin', b'').decode('ascii')
            self.referencia = await database_sync_to_async(consumir_acceso)(contenido['acceso'], origen)
            self.vencimiento.cancel()
            self.grupo = grupo_usuario(self.referencia['usuario'])
            await self.channel_layer.group_add(self.grupo, self.channel_name)
            await database_sync_to_async(auditar_canal)(self.referencia, 'abrir_canal_chat')
            if await self.enviar_estado(inicial=True):
                self.control = asyncio.create_task(self.controlar())
        except (AuthenticationFailed, PermissionDenied):
            await self.close(code=4401)
        except (ValueError, TypeError, UnicodeError):
            await self.close(code=4400)
        except Exception:
            await self.close(code=1013)

    async def controlar(self):
        try:
            while True:
                await asyncio.sleep(15)
                await self.channel_layer.send(self.channel_name, {'type': 'chat.cambio'})
        except asyncio.CancelledError:
            return
        except Exception:
            await self.close(code=1013)

    async def enviar_estado(self, inicial=False):
        try:
            datos = await database_sync_to_async(consultar_canal)(self.referencia)
            await self.send_json({'tipo': 'estado', 'inicial': inicial, 'datos': datos})
            return True
        except (AuthenticationFailed, PermissionDenied):
            await self.close(code=4401)
        except Exception:
            await self.close(code=1013)
        return False

    async def chat_cambio(self, evento):
        if self.referencia:
            await self.enviar_estado()

    async def disconnect(self, close_code):
        tareas = [tarea for tarea in (self.vencimiento, self.control) if tarea]
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
            await database_sync_to_async(auditar_canal)(self.referencia, 'cerrar_canal_chat')
