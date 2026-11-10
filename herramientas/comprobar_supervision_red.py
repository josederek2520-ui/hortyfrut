"""Comprueba PostgreSQL -> Redis entre procesos -> ASGI sin usar datos reales.

Desde la raiz: Backend/.venv/Scripts/python.exe herramientas/comprobar_supervision_red.py
Requiere Redis local y las dependencias de requirements-supervision.txt.
"""
import asyncio
import json
import os
from pathlib import Path
import sys
import uuid
import subprocess

raiz = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(raiz / 'Backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.pruebas_aisladas'
import django
django.setup()
from channels.db import database_sync_to_async
from django.conf import settings
from django.test import TransactionTestCase, override_settings
from django.test.utils import get_runner
from despachos.test_supervision import DatosSupervision, PruebasCanalSupervision

prefijo = 'hortyfru_prueba_supervision_' + uuid.uuid4().hex
capas = {'default': {'BACKEND': 'channels_redis.core.RedisChannelLayer',
    'CONFIG': {'hosts': ['redis://127.0.0.1:6379/1'], 'prefix': prefijo, 'expiry': 10, 'group_expiry': 30}}}
almacenamientos = {**settings.CACHES, 'supervision': {'BACKEND': 'django.core.cache.backends.redis.RedisCache',
    'LOCATION': 'redis://127.0.0.1:6379/2', 'KEY_PREFIX': prefijo}}


@override_settings(CHANNEL_LAYERS=capas, CACHES=almacenamientos)
class PruebaDistribucionSupervision(DatosSupervision, TransactionTestCase):
    def setUp(self):
        self.preparar_datos_despachos()
        super().setUp()
        # No limpiar Redis: cada ejecucion tiene un prefijo exclusivo y TTL.
        self.viaje = self.crear_despacho()
        self.operar(self.viaje, 'iniciar')
        from rest_framework.test import APIClient
        self.web = APIClient()
        self.web.force_login(self.actor)

    canal = PruebasCanalSupervision.canal
    abrir_canal = PruebasCanalSupervision.abrir_canal

    async def test_web_chofer_otro_proceso_publica_solo_despues_de_guardar(self):
        canal = await self.abrir_canal()
        self.assertIsNone((await canal.receive_json_from(timeout=5))['datos']['seguimiento'])
        codigo = '''
import sys,json,os,uuid
os.environ['DJANGO_SETTINGS_MODULE']='config.pruebas_aisladas'
import django
django.setup()
from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient
from usuarios.models import Usuario
from despachos.models import Despacho
from despachos.servicios import version_despacho
datos=json.load(sys.stdin)
settings.CHANNEL_LAYERS=datos['capas']
settings.ALLOWED_HOSTS=['testserver']
cliente=APIClient()
cliente.force_login(Usuario.objects.get(pk=datos['usuario']))
acceso=cliente.post('/api/v1/chofer/acceso/',{},format='json',secure=True)
assert acceso.status_code==200, acceso.status_code
viaje=Despacho.objects.get(pk=datos['viaje'])
base=f'/api/v1/chofer/mis-viajes/{viaje.pk}/'
inicio=cliente.post(base+'iniciar-seguimiento/',{'version':version_despacho(viaje),'clave_operacion':str(uuid.uuid4())},format='json',secure=True)
assert inicio.status_code==200, (inicio.status_code, inicio.data)
punto={'id':str(uuid.uuid4()),'latitud':'-16.5000000','longitud':'-68.1400000','precision_m':'8.00','capturada_en':timezone.now().isoformat(),'velocidad_m_s':None,'rumbo':None}
respuesta=cliente.post(base+'enviar-posiciones/',{'sesion':inicio.data['id'],'clave_operacion':str(uuid.uuid4()),'posiciones':[punto]},format='json',secure=True)
assert respuesta.status_code==200, respuesta.status_code
print(json.dumps({'punto':punto['id']}))
'''
        # El selector de asyncio usado con psycopg en Windows no crea subprocesos.
        # Ejecutarlo en un hilo permite que ASGI siga escuchando Redis mientras tanto.
        resultado = await asyncio.to_thread(subprocess.run, [sys.executable, '-c', codigo],
            cwd=str(raiz / 'Backend'), input=json.dumps({
                'usuario': self.actor.pk, 'viaje': self.viaje.pk, 'capas': capas,
            }), capture_output=True, text=True, timeout=20)
        self.assertEqual(resultado.returncode, 0, resultado.stderr[-2000:])
        punto = json.loads(resultado.stdout)['punto']
        recibido = None
        for _ in range(3):
            recibido = (await canal.receive_json_from(timeout=5))['datos']['seguimiento']
            if recibido and recibido['ultima_posicion']:
                break
        self.assertEqual(recibido['ultima_posicion']['id'], punto)
        from despachos.modelos_seguimiento import PosicionSeguimiento
        self.assertTrue(await database_sync_to_async(PosicionSeguimiento.objects.filter(pk=punto).exists)())
        await canal.disconnect()


if __name__ == '__main__':
    if not getattr(settings, 'ENTORNO_PRUEBAS_AISLADAS', False):
        raise RuntimeError('Solo se permite usar la base aislada de pruebas.')
    fallos = get_runner(settings)(interactive=False, keepdb=True, verbosity=1).run_tests([
        '__main__.PruebaDistribucionSupervision'])
    raise SystemExit(bool(fallos))
