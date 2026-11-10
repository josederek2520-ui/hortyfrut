"""API, PostgreSQL, Redis, Daphne y upgrade de la pasarela, sin datos habituales."""
import os
import json
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

raiz = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(raiz / 'Backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.pruebas_chat_red'
os.environ['CHAT_PRUEBA_PREFIJO'] = 'hortyfru_chat_prueba_' + uuid.uuid4().hex
import django
django.setup()
from django.conf import settings
from django.test import TransactionTestCase
from django.test.utils import get_runner
from rest_framework.test import APIClient
from usuarios.models import Usuario
from chat.models import Mensaje


class PruebaChatDistribuido(TransactionTestCase):
    def test_aviso_privado_por_redis_y_proxy_websocket_real(self):
        ana = Usuario.objects.create_user(email='ana@chatred.test', cedula_identidad='1101', first_name='Ana')
        luis = Usuario.objects.create_user(email='luis@chatred.test', cedula_identidad='1102', first_name='Luis')
        receptor = APIClient()
        receptor.force_login(ana)
        respuesta = receptor.post('/api/v1/chat/acceso/', {}, format='json', HTTP_ORIGIN='https://chat-prueba.trycloudflare.com')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        with socket.socket() as reserva:
            reserva.bind(('127.0.0.1', 0))
            puerto = reserva.getsockname()[1]
        with tempfile.TemporaryFile() as registro:
            servidor = subprocess.Popen([sys.executable, '-m', 'daphne', '-b', '127.0.0.1', '-p', str(puerto), 'config.asgi:application'],
                cwd=raiz / 'Backend', env=os.environ.copy(), stdin=subprocess.DEVNULL, stdout=registro, stderr=registro)
            navegador = None
            try:
                for _ in range(100):
                    try:
                        with socket.create_connection(('127.0.0.1', puerto), timeout=0.1):
                            break
                    except OSError:
                        time.sleep(0.1)
                else:
                    self.fail('No inicio el servidor ASGI aislado.')
                navegador = subprocess.Popen(['node', str(raiz / 'herramientas' / 'comprobar_canal_chat.mjs')],
                    cwd=raiz, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                navegador.stdin.write(json.dumps({'puerto': puerto, 'acceso': respuesta.data['acceso']}))
                navegador.stdin.close()
                navegador.stdin = None
                with ThreadPoolExecutor(max_workers=1) as lector:
                    inicio = lector.submit(navegador.stdout.readline).result(timeout=12)
                self.assertEqual(inicio.strip(), 'LISTO')
                emisor = APIClient()
                emisor.force_login(luis)
                conversacion = emisor.post('/api/v1/chat/conversaciones/', {'usuario': ana.pk}, format='json')
                self.assertEqual(conversacion.status_code, 201, conversacion.data)
                mensaje = emisor.post(f"/api/v1/chat/conversaciones/{conversacion.data['id']}/mensajes/", {
                    'clave_cliente': str(uuid.uuid4()), 'texto': 'Comprobacion privada aislada'}, format='json')
                self.assertEqual(mensaje.status_code, 201, mensaje.data)
                salida, errores = navegador.communicate(timeout=15)
                self.assertEqual(navegador.returncode, 0, errores[-1000:])
                datos = json.loads(salida.strip())
                self.assertEqual(datos['usuario'], ana.pk)
                self.assertEqual(datos['ultimo_recibido']['id'], mensaje.data['id'])
                self.assertNotIn('Comprobacion privada aislada', salida)
                self.assertEqual(Mensaje.objects.count(), 1)
            finally:
                for proceso in (navegador, servidor):
                    if proceso and proceso.poll() is None:
                        proceso.terminate()
                        try:
                            proceso.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            proceso.kill()
                            proceso.wait(timeout=5)


if __name__ == '__main__':
    if not getattr(settings, 'ENTORNO_PRUEBAS_AISLADAS', False):
        raise RuntimeError('Esta comprobacion requiere la base aislada.')
    raise SystemExit(bool(get_runner(settings)(interactive=False, keepdb=True, verbosity=1).run_tests(['__main__.PruebaChatDistribuido'])))
