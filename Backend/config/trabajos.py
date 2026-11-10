"""Trabajador de optimización. En Windows se ejecuta en el contenedor Linux."""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
aplicacion = Celery('hortyfru')
aplicacion.config_from_object('django.conf:settings', namespace='CELERY')
aplicacion.conf.imports = ('despachos.tareas_optimizacion',)
