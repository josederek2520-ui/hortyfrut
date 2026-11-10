"""Solo para la comprobacion aislada de Chat entre procesos reales."""
import os
import re
from .pruebas_aisladas import *  # noqa: F403

prefijo_chat_prueba = os.environ.get('CHAT_PRUEBA_PREFIJO', '')
if not re.fullmatch(r'hortyfru_chat_prueba_[a-f0-9]{32}', prefijo_chat_prueba):
    raise RuntimeError('Usa el comprobador aislado del chat para esta configuracion.')
CHANNEL_LAYERS = {'default': {'BACKEND': 'channels_redis.core.RedisChannelLayer', 'CONFIG': {
    'hosts': ['redis://127.0.0.1:6379/1'], 'prefix': prefijo_chat_prueba, 'expiry': 15, 'group_expiry': 30}}}
CACHES['supervision'] = {'BACKEND': 'django.core.cache.backends.redis.RedisCache',
    'LOCATION': 'redis://127.0.0.1:6379/2', 'KEY_PREFIX': prefijo_chat_prueba}
CSRF_TRUSTED_ORIGINS = ['https://chat-prueba.trycloudflare.com']
