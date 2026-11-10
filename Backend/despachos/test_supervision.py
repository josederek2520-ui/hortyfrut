"""Supervision de lectura: permisos, commit, reconexion y canal ASGI."""
import hashlib
import uuid
from datetime import timedelta
from unittest.mock import patch, AsyncMock
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import Permission
from django.contrib.sessions.models import Session
from django.core.cache import caches
from django.db import transaction
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import AuthenticationFailed
from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import MovimientoInventario
from usuarios.models import Usuario
from usuarios.autenticacion_movil import crear_sesion_movil
from .tests import DatosDespachos
from .eventos_supervision import avisar_cambio_despacho, nombre_grupo
from .supervision import consumir_acceso_supervision
from .servicios import version_despacho


class DatosSupervision(DatosDespachos):
    def preparar_supervision(self):
        caches['supervision'].clear()
        self.viaje = self.crear_despacho()
        self.web = APIClient()
        self.web.force_login(self.actor)

    def acceso(self, cliente=None):
        respuesta = (cliente or self.web).post(
            f'/api/v1/despachos/{self.viaje.pk}/acceso-supervision/', {}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data['acceso']

    def consulta(self, cliente=None):
        return (cliente or self.web).get(f'/api/v1/despachos/{self.viaje.pk}/supervision/')


class PruebasAccesoSupervision(DatosSupervision, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()

    def setUp(self):
        super().setUp()
        self.preparar_supervision()

    def test_acceso_un_solo_uso_ligado_al_viaje_y_sin_secretos_en_auditoria(self):
        acceso = self.acceso()
        self.assertRegex(acceso, r'^[A-Za-z0-9_-]{43}$')
        referencia = consumir_acceso_supervision(acceso, self.viaje.pk)
        self.assertEqual(referencia['usuario'], self.actor.pk)
        with self.assertRaises(AuthenticationFailed):
            consumir_acceso_supervision(acceso, self.viaje.pk)
        registro = RegistroActividad.objects.get(accion='autorizar_supervision')
        self.assertNotIn(acceso, str(registro.__dict__))
        self.assertNotIn(self.web.session.session_key, str(registro.__dict__))
        otro = self.acceso()
        with self.assertRaises(AuthenticationFailed):
            consumir_acceso_supervision(otro, self.viaje.pk + 1)

    def test_acceso_vencido_y_sesion_cerrada_se_rechazan(self):
        acceso = self.acceso()
        caches['supervision'].delete('acceso:' + hashlib.sha256(acceso.encode()).hexdigest())
        with self.assertRaises(AuthenticationFailed):
            consumir_acceso_supervision(acceso, self.viaje.pk)
        acceso = self.acceso()
        Session.objects.filter(session_key=self.web.session.session_key).delete()
        with self.assertRaises(AuthenticationFailed):
            consumir_acceso_supervision(acceso, self.viaje.pk)

    def test_consulta_y_acceso_exigen_permiso_administrativo(self):
        chofer = Usuario.objects.create_user(email='solo-chofer@supervision.test', cedula_identidad='99891')
        chofer.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos',
            codename__in=['conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios']))
        cliente = APIClient()
        cliente.force_login(chofer)
        self.assertEqual(self.consulta(cliente).status_code, 403)
        self.assertEqual(cliente.get('/api/v1/despachos/viajes-actuales/').status_code, 403)
        self.assertEqual(cliente.post(f'/api/v1/despachos/{self.viaje.pk}/acceso-supervision/', {}).status_code, 403)
        self.assertIn(self.consulta(APIClient()).status_code, (401, 403))

    def test_viajes_actuales_filtra_antes_de_paginar_e_incluye_repartos_de_otras_fechas(self):
        self.operar(self.viaje, 'iniciar')
        from .models import Despacho
        campos = dict(almacen=self.almacen, almacen_nombre='Almacen de prueba',
            vehiculo=self.vehiculo, vehiculo_placa=self.vehiculo.placa,
            chofer=self.actor, chofer_nombre='Chofer de prueba',
            responsable=self.actor, responsable_nombre='Responsable',
            fecha_reparto=self.hoy - timedelta(days=7), huella_creacion='a' * 64)
        pendientes = [Despacho.objects.create(**campos, estado='borrador', enviado_en=timezone.now(),
            clave_operacion=uuid.uuid4()) for _ in range(12)]
        Despacho.objects.create(**campos, estado='borrador', clave_operacion=uuid.uuid4())
        Despacho.objects.create(**campos, estado='finalizado', salida_en=timezone.now(), retorno_en=timezone.now(),
            enviado_en=timezone.now(), clave_operacion=uuid.uuid4())
        Despacho.objects.create(**campos, estado='cancelado', enviado_en=timezone.now(), clave_operacion=uuid.uuid4())
        direccion = '/api/v1/despachos/viajes-actuales/'
        primera = self.web.get(direccion)
        segunda = self.web.get(direccion, {'pagina': 2})
        self.assertEqual(primera.status_code, 200, primera.data)
        self.assertEqual(primera.data['count'], 13)
        self.assertEqual(len(primera.data['results']), 10)
        self.assertEqual(len(segunda.data['results']), 3)
        self.assertEqual(primera.data['results'][0]['id'], self.viaje.pk)
        recibidos = {fila['id'] for fila in primera.data['results'] + segunda.data['results']}
        self.assertEqual(recibidos, {self.viaje.pk, *(fila.pk for fila in pendientes)})
        filtrado = self.web.get(direccion, {'buscar': pendientes[-1].codigo})
        self.assertEqual(filtrado.data['count'], 1)
        self.assertEqual(filtrado.data['results'][0]['id'], pendientes[-1].pk)
        self.assertEqual(self.web.get(direccion, {'estado': 'en_ruta'}).data['count'], 1)
        self.assertEqual(self.web.get(direccion, {'estado': 'borrador'}).data['count'], 12)

    def test_autorizar_exige_csrf_y_consulta_no_inventa_posicion_ni_mueve_carga(self):
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(self.actor)
        self.assertEqual(cliente.post(f'/api/v1/despachos/{self.viaje.pk}/acceso-supervision/', {}).status_code, 403)
        antes = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), version_despacho(self.viaje))
        respuesta = self.consulta()
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta['Cache-Control'], 'no-store')
        self.assertIsNone(respuesta.data['seguimiento'])
        self.assertEqual(respuesta.data['progreso']['total'], 2)
        self.viaje.refresh_from_db()
        self.assertEqual(antes, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), version_despacho(self.viaje)))

    def test_aviso_espera_commit_y_rollback_no_publica(self):
        capa = type('CapaPrueba', (), {'group_send': AsyncMock()})()
        with patch('channels.layers.get_channel_layer', return_value=capa):
            with self.captureOnCommitCallbacks(execute=True):
                avisar_cambio_despacho(self.viaje.pk)
                capa.group_send.assert_not_awaited()
            capa.group_send.assert_awaited_once_with(nombre_grupo(self.viaje.pk), {'type': 'seguimiento.cambio'})
            capa.group_send.reset_mock()
            with self.captureOnCommitCallbacks(execute=True):
                try:
                    with transaction.atomic():
                        avisar_cambio_despacho(self.viaje.pk)
                        raise ValueError('revertir')
                except ValueError:
                    pass
            capa.group_send.assert_not_awaited()

    def test_redis_caido_no_revierte_hechos_confirmados(self):
        with patch('channels.layers.get_channel_layer', side_effect=ConnectionError), self.assertLogs('despachos.eventos_supervision', 'WARNING'):
            with self.captureOnCommitCallbacks(execute=True):
                avisar_cambio_despacho(self.viaje.pk)
        self.assertEqual(self.consulta().status_code, 200)

    @override_settings(SUPERVISION_HABILITADA=False)
    def test_interruptor_deshabilita_acceso_y_consulta(self):
        self.assertEqual(self.consulta().status_code, 503)
        self.assertEqual(self.web.post(f'/api/v1/despachos/{self.viaje.pk}/acceso-supervision/', {}).status_code, 503)


class PruebasCanalSupervision(DatosSupervision, TransactionTestCase):
    def setUp(self):
        self.preparar_datos_despachos()
        super().setUp()
        self.preparar_supervision()

    def canal(self, origen='http://localhost:3000'):
        from config.asgi import application
        return WebsocketCommunicator(application, f'/ws/seguimiento/{self.viaje.pk}/',
            headers=[(b'origin', origen.encode())])

    async def abrir_canal(self, acceso=None):
        acceso = acceso or await database_sync_to_async(self.acceso)()
        canal = self.canal()
        self.assertTrue((await canal.connect())[0])
        await canal.send_json_to({'tipo': 'autorizar', 'acceso': acceso})
        return canal

    async def test_origen_ajeno_y_acceso_ajeno_no_reciben_datos(self):
        canal = self.canal('https://otro.test')
        self.assertFalse((await canal.connect())[0])
        await canal.disconnect()
        canal = await self.abrir_canal('x' * 43)
        self.assertEqual((await canal.receive_output())['code'], 4401)
        await canal.disconnect()

    async def test_revocacion_permiso_y_logout_cortan_canal(self):
        def dar_permiso_lector():
            self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
            cliente = APIClient()
            cliente.force_login(self.lector)
            return self.acceso(cliente)
        acceso = await database_sync_to_async(dar_permiso_lector)()
        canal = await self.abrir_canal(acceso)
        self.assertEqual((await canal.receive_json_from())['tipo'], 'seguimiento')
        await database_sync_to_async(self.lector.user_permissions.clear)()
        await get_channel_layer().group_send(nombre_grupo(self.viaje.pk), {'type': 'seguimiento.cambio'})
        self.assertEqual((await canal.receive_output())['code'], 4403)
        await canal.disconnect()
        canal = await self.abrir_canal()
        await canal.receive_json_from()
        await database_sync_to_async(self.web.logout)()
        await canal.send_json_to({'tipo': 'actualizar'})
        self.assertEqual((await canal.receive_output())['code'], 4401)
        await canal.disconnect()

    async def test_canal_solo_lectura_rechaza_acciones(self):
        canal = await self.abrir_canal()
        await canal.receive_json_from()
        await canal.send_json_to({'tipo': 'finalizar'})
        self.assertEqual((await canal.receive_output())['code'], 4400)
        await canal.disconnect()
        estado = await database_sync_to_async(lambda: type(self.viaje).objects.get(pk=self.viaje.pk).estado)()
        self.assertEqual(estado, 'borrador')

    async def test_gps_persistido_llega_en_vivo_y_reconexion_recupera_ultima_medicion(self):
        canal = await self.abrir_canal()
        self.assertIsNone((await canal.receive_json_from())['datos']['seguimiento'])

        def iniciar_y_medir():
            self.operar(self.viaje, 'iniciar')
            _, credencial = crear_sesion_movil(self.actor, uuid.uuid4(), 'Integracion supervisora')
            cliente = APIClient()
            cliente.credentials(HTTP_AUTHORIZATION='Bearer ' + credencial)
            self.viaje.refresh_from_db()
            base = f'/api/v1/movil/mis-despachos/{self.viaje.pk}/'
            inicio = cliente.post(base + 'iniciar-seguimiento/',
                {'version': version_despacho(self.viaje), 'clave_operacion': str(uuid.uuid4())}, format='json', secure=True)
            self.assertEqual(inicio.status_code, 200, inicio.data)
            punto = {'id': str(uuid.uuid4()), 'latitud': '-16.5000000', 'longitud': '-68.1400000',
                'precision_m': '8.00', 'capturada_en': timezone.now().isoformat(), 'velocidad_m_s': None, 'rumbo': None}
            cuerpo = {'sesion': inicio.data['id'], 'clave_operacion': str(uuid.uuid4()), 'posiciones': [punto]}
            resultado = cliente.post(base + 'enviar-posiciones/', cuerpo, format='json', secure=True)
            self.assertEqual(resultado.status_code, 200, resultado.data)
            return punto['id'], inicio.data['id'], cliente, base

        punto, sesion, cliente, base = await database_sync_to_async(iniciar_y_medir)()
        datos = None
        for _ in range(4):
            datos = (await canal.receive_json_from())['datos']
            if datos['seguimiento'] and datos['seguimiento']['ultima_posicion']:
                break
        self.assertEqual(datos['seguimiento']['ultima_posicion']['id'], punto)
        self.assertTrue(datos['seguimiento']['activa'])
        await canal.disconnect()
        canal = await self.abrir_canal()
        datos = (await canal.receive_json_from())['datos']
        self.assertEqual(datos['seguimiento']['ultima_posicion']['id'], punto)
        def detener():
            respuesta = cliente.post(base + 'detener-seguimiento/', {'sesion': sesion, 'motivo': 'chofer'}, format='json', secure=True)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
        await database_sync_to_async(detener)()
        datos = (await canal.receive_json_from())['datos']
        self.assertFalse(datos['seguimiento']['activa'])
        self.assertEqual(datos['seguimiento']['ultima_posicion']['id'], punto)
        await canal.disconnect()
