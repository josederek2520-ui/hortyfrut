"""Configuración independiente para la prueba HTTPS, sin modificar el administrador."""
import os
import re
from django.core.exceptions import ImproperlyConfigured
from .settings import *  # noqa: F403

origen_chofer = os.environ.get('ORIGEN_HTTPS_CHOFER', '')
if not re.fullmatch(r'https://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com', origen_chofer):
    raise ImproperlyConfigured('Configura el origen HTTPS exacto emitido por el túnel de prueba.')

DEBUG = False
ROOT_URLCONF = 'config.rutas_chofer_https'
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', origen_chofer.removeprefix('https://')]
CSRF_TRUSTED_ORIGINS = [origen_chofer]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
USE_X_FORWARDED_HOST = False
# El lanzador enlaza este proceso solo a 127.0.0.1 y la pasarela sobrescribe este encabezado.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False  # La pasarela exige HTTPS; SSR usa HTTP exclusivamente por loopback.
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
