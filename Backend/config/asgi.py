"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
import json
import secrets

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

aplicacion_django = get_asgi_application()

from django.conf import settings
from django.urls import re_path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from despachos.consumidores_supervision import CanalSupervision
from chat.consumidor import CanalChat

aplicacion_protocolos = ProtocolTypeRouter({
    'http': aplicacion_django,
    'websocket': URLRouter([
        re_path(r'^ws/seguimiento/(?P<identificador>[1-9]\d{0,14})/?$',
            OriginValidator(CanalSupervision.as_asgi(), settings.SUPERVISION_ORIGENES)),
        # El dominio temporal pasa este primer filtro; el acceso de un solo uso
        # comprueba ademas el origen EXACTO que autoriza la API con sesion y CSRF.
        re_path(r'^ws/chat/?$', OriginValidator(CanalChat.as_asgi(),
            [*settings.SUPERVISION_ORIGENES, 'https://.trycloudflare.com'])),
    ]),
})


async def application(scope, receive, send):
    if scope['type'] == 'http' and scope['path'] == '/__supervision/control':
        encabezados = dict(scope.get('headers', []))
        clave = os.environ.get('SUPERVISION_CONTROL', '')
        recibida = encabezados.get(b'x-control-supervision', b'').decode('ascii', errors='ignore')
        permitido = (clave and secrets.compare_digest(clave, recibida)
            and scope.get('client', ('',))[0] in ('127.0.0.1', '::1'))
        contenido = {'servicio': 'hortyfru_supervision', 'pid': os.getpid(),
            'instancia': os.environ.get('SUPERVISION_INSTANCIA')} if permitido else {'detail': 'No disponible.'}
        await send({'type': 'http.response.start', 'status': 200 if permitido else 404,
            'headers': [(b'content-type', b'application/json'), (b'cache-control', b'no-store')]})
        await send({'type': 'http.response.body', 'body': json.dumps(contenido).encode('utf-8')})
        return
    await aplicacion_protocolos(scope, receive, send)
