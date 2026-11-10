import uuid
from unittest.mock import patch, AsyncMock
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.sessions.models import Session
from django.core.cache import caches
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from usuarios.models import Usuario
from auditoria.models import RegistroActividad
from .models import Conversacion, Mensaje, BuzonChat
from .servicios import enviar_mensaje, abrir_conversacion, resumen_buzon, avisar_usuarios


class DatosChat:
    def preparar(self):
        caches['supervision'].clear()
        self.ana = Usuario.objects.create_user(email='ana@chat.test', cedula_identidad='101', first_name='Ana')
        self.luis = Usuario.objects.create_user(email='luis@chat.test', cedula_identidad='102', first_name='Luis')
        self.ajeno = Usuario.objects.create_user(email='ajeno@chat.test', cedula_identidad='103', first_name='Tercero', is_superuser=True)
        self.cliente = APIClient()
        self.cliente.force_login(self.ana)

    def iniciar(self, usuario=None, cliente=None):
        respuesta = (cliente or self.cliente).post('/api/v1/chat/conversaciones/', {'usuario': (usuario or self.luis).pk}, format='json')
        self.assertIn(respuesta.status_code, (200, 201), respuesta.data)
        return respuesta.data['id']

    def enviar(self, identificador, texto='Mensaje privado de prueba', clave=None, cliente=None):
        return (cliente or self.cliente).post(f'/api/v1/chat/conversaciones/{identificador}/mensajes/',
            {'texto': texto, 'clave_cliente': str(clave or uuid.uuid4())}, format='json')


class PruebasChat(DatosChat, TestCase):
    def setUp(self):
        self.preparar()

    def test_todos_los_usuarios_activos_pueden_usar_chat_sin_permisos_administrativos(self):
        respuesta = self.cliente.get('/api/v1/chat/usuarios/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(set(respuesta.data['results'][0]), {'id', 'nombre', 'activo'})
        self.assertNotIn(self.ana.pk, [fila['id'] for fila in respuesta.data['results']])
        self.assertIn(APIClient().get('/api/v1/chat/conversaciones/').status_code, (401, 403))
        csrf = APIClient(enforce_csrf_checks=True)
        csrf.force_login(self.ana)
        self.assertEqual(csrf.post('/api/v1/chat/conversaciones/', {'usuario': self.luis.pk}).status_code, 403)
        self.assertEqual(self.cliente.get('/api/v1/chat/conversaciones/', HTTP_X_USUARIO_CHAT=str(self.luis.pk)).status_code, 403)

    def test_conversacion_es_unica_para_ambos_sentidos(self):
        primero = self.iniciar()
        otro = APIClient()
        otro.force_login(self.luis)
        self.assertEqual(self.iniciar(self.ana, otro), primero)
        self.assertEqual(Conversacion.objects.count(), 1)
        self.assertEqual(self.cliente.post('/api/v1/chat/conversaciones/', {'usuario': self.ana.pk}).status_code, 400)

    def test_superusuario_ajeno_no_lee_ni_envia_ni_marca_mensajes_privados(self):
        conversacion = self.iniciar()
        mensaje = self.enviar(conversacion)
        self.assertEqual(mensaje.status_code, 201, mensaje.data)
        tercero = APIClient()
        tercero.force_login(self.ajeno)
        base = f'/api/v1/chat/conversaciones/{conversacion}/'
        self.assertEqual(tercero.get(base + 'mensajes/').status_code, 404)
        self.assertEqual(self.enviar(conversacion, cliente=tercero).status_code, 404)
        self.assertEqual(tercero.post(base + 'lectura/', {'mensajes': [mensaje.data['id']]}, format='json').status_code, 404)
        self.assertEqual(tercero.get('/api/v1/chat/conversaciones/').data['count'], 0)

    def test_reintentos_uuid_no_duplican_y_otro_cuerpo_conflicta(self):
        conversacion = self.iniciar()
        clave = uuid.uuid4()
        primero = self.enviar(conversacion, clave=clave)
        segundo = self.enviar(conversacion, clave=clave)
        self.assertEqual(primero.status_code, 201, primero.data)
        self.assertEqual(segundo.status_code, 200)
        self.assertEqual(primero.data['id'], segundo.data['id'])
        self.assertEqual(self.enviar(conversacion, texto='Otra cosa', clave=clave).status_code, 409)
        self.assertEqual(Mensaje.objects.count(), 1)
        self.assertNotIn('Mensaje privado de prueba', str(list(RegistroActividad.objects.values())))

    def test_paginacion_de_diez_y_corte_conservan_historia_frente_a_nuevos_mensajes(self):
        conversacion = self.iniciar()
        for _ in range(13):
            respuesta = self.enviar(conversacion)
            self.assertEqual(respuesta.status_code, 201, respuesta.data)
        base = f'/api/v1/chat/conversaciones/{conversacion}/mensajes/'
        pagina = self.cliente.get(base)
        self.assertEqual(pagina.data['count'], 13)
        self.assertEqual(len(pagina.data['results']), 10)
        self.enviar(conversacion)
        segunda = self.cliente.get(base, {'pagina': 2, 'corte': pagina.data['corte']})
        self.assertEqual(segunda.data['count'], 13)
        self.assertEqual(len(segunda.data['results']), 3)
        self.assertFalse({fila['id'] for fila in pagina.data['results']} & {fila['id'] for fila in segunda.data['results']})

    def test_lectura_es_explicita_solo_recibidos_y_lotes_de_diez(self):
        conversacion = self.iniciar()
        mensaje = self.enviar(conversacion)
        self.assertEqual(mensaje.status_code, 201, mensaje.data)
        self.assertEqual(resumen_buzon(self.luis)['no_leidos'], 1)
        cliente = APIClient()
        cliente.force_login(self.luis)
        cliente.get(f'/api/v1/chat/conversaciones/{conversacion}/mensajes/')
        self.assertEqual(resumen_buzon(self.luis)['no_leidos'], 1)
        base = f'/api/v1/chat/conversaciones/{conversacion}/lectura/'
        self.assertEqual(self.cliente.post(base, {'mensajes': [mensaje.data['id']]}, format='json').status_code, 400)
        respuesta = cliente.post(base, {'mensajes': [mensaje.data['id']]}, format='json')
        self.assertEqual(respuesta.data['marcados'], 1)
        self.assertEqual(cliente.post(base, {'mensajes': [mensaje.data['id']]}, format='json').data['marcados'], 0)
        self.assertEqual(resumen_buzon(self.luis)['no_leidos'], 0)
        self.assertIsNotNone(Mensaje.objects.get(pk=mensaje.data['id']).leido_en)

    def test_usuario_inactivo_no_es_contacto_y_no_recibe_envios(self):
        conversacion = self.iniciar()
        self.luis.is_active = False
        self.luis.save(update_fields=['is_active'])
        self.assertEqual(self.enviar(conversacion).status_code, 403)
        self.assertNotIn(self.luis.pk, [fila['id'] for fila in self.cliente.get('/api/v1/chat/usuarios/').data['results']])
        self.assertEqual(self.cliente.get(f'/api/v1/chat/conversaciones/{conversacion}/mensajes/').status_code, 200)

    def test_limites_de_texto_frecuencia_y_contactos_de_diez(self):
        conversacion = self.iniciar()
        self.assertEqual(self.enviar(conversacion, texto=' ').status_code, 400)
        self.assertEqual(self.enviar(conversacion, texto='x' * 2001).status_code, 400)
        for _ in range(30):
            self.assertEqual(self.enviar(conversacion).status_code, 201)
        self.assertEqual(self.enviar(conversacion).status_code, 429)
        ultimo = Mensaje.objects.first()
        self.assertEqual(self.enviar(conversacion, clave=ultimo.clave_cliente).status_code, 200)
        for indice in range(12):
            Usuario.objects.create_user(email=f'contacto{indice}@chat.test', cedula_identidad=str(8000 + indice), first_name='Contacto')
        lista = self.cliente.get('/api/v1/chat/usuarios/')
        self.assertEqual(lista.data['count'], 14)
        self.assertEqual(len(lista.data['results']), 10)
        self.assertEqual(len(self.cliente.get('/api/v1/chat/usuarios/?pagina=2').data['results']), 4)

    def test_aviso_post_commit_no_incluye_texto_y_fallo_redis_no_revierte(self):
        capa = type('Capa', (), {'group_send': AsyncMock()})()
        with patch('channels.layers.get_channel_layer', return_value=capa):
            with self.captureOnCommitCallbacks(execute=True):
                conversacion = self.iniciar()
                respuesta = self.enviar(conversacion)
                self.assertEqual(respuesta.status_code, 201, respuesta.data)
                capa.group_send.assert_not_awaited()
            for argumento in capa.group_send.await_args_list:
                self.assertEqual(argumento.args[1], {'type': 'chat.cambio'})
        with patch('channels.layers.get_channel_layer', side_effect=ConnectionError), self.assertLogs('chat.servicios', 'WARNING'):
            with self.captureOnCommitCallbacks(execute=True):
                respuesta = self.enviar(conversacion)
                self.assertEqual(respuesta.status_code, 201)


class PruebasCanalChat(DatosChat, TransactionTestCase):
    def setUp(self):
        self.preparar()

    def autorizar(self, cliente=None):
        respuesta = (cliente or self.cliente).post('/api/v1/chat/acceso/', {}, format='json', HTTP_ORIGIN='http://localhost:3000')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data['acceso']

    def test_dos_reintentos_concurrentes_guardan_un_mensaje(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections, connections
        conversacion, _ = abrir_conversacion(self.ana, self.luis.pk)
        barrera = Barrier(2)
        valores = {'clave_cliente': uuid.uuid4(), 'texto': 'Mensaje concurrente'}
        def intentar():
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.ana.pk)
                barrera.wait(timeout=5)
                return enviar_mensaje(actor, conversacion.pk, valores)[0].pk
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(lambda _: intentar(), range(2)))
        self.assertEqual(len(set(resultados)), 1)
        self.assertEqual(Mensaje.objects.count(), 1)
        self.assertEqual(resumen_buzon(self.luis)['no_leidos'], 1)

    async def abrir_canal(self, acceso=None, origen='http://localhost:3000'):
        from config.asgi import application
        canal = WebsocketCommunicator(application, '/ws/chat/', headers=[(b'origin', origen.encode())])
        conectado = (await canal.connect())[0]
        if conectado:
            await canal.send_json_to({'tipo': 'autorizar', 'acceso': acceso or await database_sync_to_async(self.autorizar)()})
        return canal, conectado

    async def test_canal_entrega_resumen_privado_y_avisos_tras_guardar(self):
        canal, conectado = await self.abrir_canal()
        self.assertTrue(conectado)
        inicial = await canal.receive_json_from()
        self.assertTrue(inicial['inicial'])
        self.assertEqual(inicial['datos']['usuario'], self.ana.pk)
        def enviar_desde_otro():
            conversacion, _ = abrir_conversacion(self.luis, self.ana.pk)
            enviar_mensaje(self.luis, conversacion.pk, {'clave_cliente': uuid.uuid4(), 'texto': 'Privado en vivo'})
        await database_sync_to_async(enviar_desde_otro)()
        estado = None
        for _ in range(3):
            estado = await canal.receive_json_from()
            if estado['datos']['ultimo_recibido']:
                break
        self.assertFalse(estado['inicial'])
        self.assertEqual(estado['datos']['no_leidos'], 1)
        self.assertEqual(estado['datos']['ultimo_recibido']['autor']['id'], self.luis.pk)
        self.assertNotIn('Privado en vivo', str(estado))
        await canal.disconnect()

    async def test_acceso_de_un_uso_origen_exacto_y_logout(self):
        acceso = await database_sync_to_async(self.autorizar)()
        canal, _ = await self.abrir_canal(acceso)
        await canal.receive_json_from()
        segundo, _ = await self.abrir_canal(acceso)
        self.assertEqual((await segundo.receive_output())['code'], 4401)
        await segundo.disconnect()
        await database_sync_to_async(lambda: Session.objects.filter(session_key=self.cliente.session.session_key).delete())()
        from channels.layers import get_channel_layer
        await get_channel_layer().group_send(f'chat.usuario.{self.ana.pk}', {'type': 'chat.cambio'})
        self.assertEqual((await canal.receive_output())['code'], 4401)
        await canal.disconnect()
        ajeno, conectado = await self.abrir_canal('x' * 43, 'https://atacante.test')
        self.assertFalse(conectado)
        await ajeno.disconnect()

    @override_settings(CSRF_TRUSTED_ORIGINS=['https://propio.trycloudflare.com'])
    async def test_un_otro_tunel_no_puede_consumir_el_acceso(self):
        def autorizar_publico():
            respuesta = self.cliente.post('/api/v1/chat/acceso/', {}, format='json', HTTP_ORIGIN='https://propio.trycloudflare.com')
            return respuesta.data['acceso']
        canal, conectado = await self.abrir_canal(await database_sync_to_async(autorizar_publico)(), 'https://ajeno.trycloudflare.com')
        self.assertTrue(conectado)
        self.assertEqual((await canal.receive_output())['code'], 4401)
        await canal.disconnect()
