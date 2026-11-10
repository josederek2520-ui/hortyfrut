"""Configuración optativa para verificar HortyFru en una base separada.

Uso: manage.py test --settings=config.pruebas_aisladas --keepdb --noinput
No se importa desde la configuración habitual del servidor.
"""

import os
import re
import tempfile
from copy import deepcopy as copiar_configuracion
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured as ConfiguracionInvalida

from .settings import *  # noqa: F403
from .settings import DATABASES as bases_habituales


nombre_base_pruebas = os.environ.get(
    'HORTYFRU_BD_PRUEBAS', 'pruebas_hortyfru_movil'
)
if (
    not re.fullmatch(r'pruebas_[a-z0-9_]+', nombre_base_pruebas)
    or len(nombre_base_pruebas) > 63
):
    raise ConfiguracionInvalida(
        'La base aislada debe comenzar por pruebas_ y usar hasta 63 caracteres '
        'en minúsculas, números o guiones bajos.'
    )

if set(bases_habituales) != {'default'}:
    raise ConfiguracionInvalida(
        'Revisa el aislamiento de todos los alias antes de usar esta configuración.'
    )
if nombre_base_pruebas.casefold() == str(bases_habituales['default']['NAME']).casefold():
    raise ConfiguracionInvalida('La base de pruebas no puede ser la base habitual.')

DATABASES = copiar_configuracion(bases_habituales)
DATABASES['default']['NAME'] = nombre_base_pruebas
DATABASES['default']['CONN_MAX_AGE'] = 0
DATABASES['default']['TEST'] = {'NAME': nombre_base_pruebas}

# Incluso un comando de Django sin el test runner apunta a la base aislada.
MEDIA_ROOT = Path(tempfile.gettempdir()) / 'hortyfru_pruebas' / nombre_base_pruebas
ENTREGAS_ARCHIVOS_DIR = MEDIA_ROOT / 'comprobantes_entregas'
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': nombre_base_pruebas,
    }
}
CACHES['supervision'] = {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'accesos_supervision_pruebas'}
CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
ENTORNO_PRUEBAS_AISLADAS = True
