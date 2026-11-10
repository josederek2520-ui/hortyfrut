import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.test import TestCase, TransactionTestCase
from django.db import close_old_connections, connections
from django.utils import timezone
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla
from usuarios.models import Usuario
from usuarios.autenticacion_movil import crear_sesion_movil, revocar_sesion_movil
from .tests import DatosDespachos
from .modelos_seguimiento import SesionSeguimiento, PosicionSeguimiento, LotePosiciones
from .servicios import version_despacho
from .seguimiento import iniciar_seguimiento, recibir_posiciones


class PruebasSeguimiento(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()
        cls.chofer = Usuario.objects.create_user(email='gps@chofer.test', cedula_identidad='98901')
        cls.otro = Usuario.objects.create_user(email='ajeno@chofer.test', cedula_identidad='98902')
        permisos = Permission.objects.filter(content_type__app_label='despachos', codename__in=[
            'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios'])
        cls.chofer.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)

    def setUp(self):
        super().setUp()
        self.viaje = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(self.viaje, 'enviar')
        self.operar(self.viaje, 'iniciar')
        self.viaje.refresh_from_db()
        self.acceso, self.cliente = self.movil(self.chofer)
        self.inicio = {'clave_operacion': str(uuid.uuid4()), 'version': version_despacho(self.viaje)}

    def movil(self, usuario, dispositivo=None):
        acceso, credencial = crear_sesion_movil(usuario, dispositivo or uuid.uuid4(), 'Pruebas GPS')
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION='Bearer ' + credencial)
        return acceso, cliente

    def enviar(self, accion, cuerpo=None, cliente=None, viaje=None):
        direccion = f'/api/v1/movil/mis-despachos/{(viaje or self.viaje).pk}/{accion}/'
        return (cliente or self.cliente).post(direccion, cuerpo or {}, format='json', secure=True)

    def abrir(self):
        respuesta = self.enviar('iniciar-seguimiento', self.inicio)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data['id']

    def punto(self, **cambios):
        return {'id': str(uuid.uuid4()), 'latitud': '-16.5000000', 'longitud': '-68.1400000',
            'precision_m': '8.00', 'velocidad_m_s': None, 'rumbo': None,
            'capturada_en': timezone.now().isoformat(), **cambios}

    def datos_lote(self, sesion, posiciones=None):
        return {'sesion': sesion, 'clave_operacion': str(uuid.uuid4()), 'posiciones': posiciones or [self.punto()]}

    def permitir_otro_lote(self):
        SesionSeguimiento.objects.update(ultima_recepcion_en=timezone.now() - timedelta(seconds=3))

    def test_inicio_idempotente_y_no_modifica_version_inventario_ni_cajillas(self):
        version = version_despacho(self.viaje)
        cantidades = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
        sesion = self.abrir()
        self.assertEqual(self.enviar('iniciar-seguimiento', self.inicio).data['id'], sesion)
        self.assertEqual(SesionSeguimiento.objects.count(), 1)
        self.enviar('enviar-posiciones', self.datos_lote(sesion))
        self.viaje.refresh_from_db()
        self.assertEqual(version_despacho(self.viaje), version)
        self.assertEqual(cantidades, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()))
        self.assertTrue(RegistroActividad.objects.filter(accion='iniciar_seguimiento').exists())

    def test_solo_viaje_iniciado_y_version_vigente(self):
        self.viaje.estado, self.viaje.salida_en = 'borrador', None
        self.viaje.save()
        self.inicio['version'] = version_despacho(self.viaje)
        self.assertEqual(self.enviar('iniciar-seguimiento', self.inicio).status_code, 400)
        self.viaje.estado, self.viaje.salida_en = 'en_ruta', timezone.now()
        self.viaje.save()
        self.assertEqual(self.enviar('iniciar-seguimiento', self.inicio).status_code, 409)

    def test_otra_cuenta_y_sesion_web_no_acceden(self):
        _, ajeno = self.movil(self.otro)
        sesion = self.abrir()
        for accion, cuerpo in [('iniciar-seguimiento', self.inicio), ('enviar-posiciones', self.datos_lote(sesion)),
                ('detener-seguimiento', {'sesion': sesion, 'motivo': 'chofer'})]:
            self.assertEqual(self.enviar(accion, cuerpo, cliente=ajeno).status_code, 404)
        web = APIClient()
        web.force_login(self.chofer)
        self.assertEqual(self.enviar('iniciar-seguimiento', self.inicio, cliente=web).status_code, 401)

    def test_otro_dispositivo_no_envia_ni_detiene_y_no_duplica_seguimiento(self):
        sesion = self.abrir()
        _, segundo = self.movil(self.chofer)
        self.assertEqual(self.enviar('iniciar-seguimiento', {**self.inicio, 'clave_operacion': str(uuid.uuid4())}, cliente=segundo).status_code, 409)
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion), cliente=segundo).status_code, 404)
        self.assertEqual(self.enviar('detener-seguimiento', {'sesion': sesion, 'motivo': 'chofer'}, cliente=segundo).status_code, 404)

    def test_repetir_lote_no_duplica_y_uuid_con_otro_cuerpo_se_rechaza(self):
        sesion = self.abrir()
        lote = self.datos_lote(sesion)
        primera = self.enviar('enviar-posiciones', lote)
        self.assertEqual(primera.status_code, 200, primera.data)
        self.assertEqual(self.enviar('enviar-posiciones', lote).status_code, 200)
        self.assertEqual(PosicionSeguimiento.objects.count(), 1)
        lote['posiciones'][0]['latitud'] = '-16.4'
        self.assertEqual(self.enviar('enviar-posiciones', lote).status_code, 409)
        self.assertEqual(LotePosiciones.objects.count(), 1)

    def test_punto_repetido_en_otro_lote_y_zona_horaria_no_duplica(self):
        sesion = self.abrir()
        punto = self.punto()
        self.enviar('enviar-posiciones', self.datos_lote(sesion, [punto]))
        self.permitir_otro_lote()
        respuesta = self.enviar('enviar-posiciones', self.datos_lote(sesion, [punto]))
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['guardadas'], 0)
        self.assertEqual(PosicionSeguimiento.objects.count(), 1)

    def test_punto_tardio_no_reemplaza_el_mas_reciente(self):
        sesion = self.abrir()
        reciente = self.punto()
        self.enviar('enviar-posiciones', self.datos_lote(sesion, [reciente]))
        self.permitir_otro_lote()
        antigua = self.punto(capturada_en=(timezone.now() - timedelta(seconds=15)).isoformat())
        respuesta = self.enviar('enviar-posiciones', self.datos_lote(sesion, [antigua]))
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['sesion']['ultima_posicion']['id'], reciente['id'])
        self.assertEqual(PosicionSeguimiento.objects.count(), 2)

    def test_calidad_tamano_fechas_y_duplicados_invalidos_revierten_el_lote(self):
        sesion = self.abrir()
        for cambios in [{'latitud': '91'}, {'longitud': 'NaN'}, {'precision_m': '101'}, {'precision_m': '-1'},
                {'rumbo': '360'}, {'velocidad_m_s': '-1'},
                {'capturada_en': (timezone.now() + timedelta(minutes=5)).isoformat()},
                {'capturada_en': (timezone.now() - timedelta(hours=1)).isoformat()}]:
            respuesta = self.enviar('enviar-posiciones', self.datos_lote(sesion, [self.punto(), self.punto(**cambios)]))
            self.assertEqual(respuesta.status_code, 400, respuesta.data)
        punto = self.punto()
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion, [punto, punto])).status_code, 400)
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion, [self.punto() for _ in range(31)])).status_code, 400)
        self.assertEqual(PosicionSeguimiento.objects.count(), 0)
        self.assertEqual(LotePosiciones.objects.count(), 0)

    def test_detener_es_idempotente_y_un_reintento_de_inicio_no_reactiva(self):
        sesion = self.abrir()
        lote = self.datos_lote(sesion)
        self.enviar('enviar-posiciones', lote)
        cierre = {'sesion': sesion, 'motivo': 'chofer'}
        self.assertEqual(self.enviar('detener-seguimiento', cierre).status_code, 200)
        self.assertEqual(self.enviar('detener-seguimiento', cierre).status_code, 200)
        self.assertFalse(self.enviar('iniciar-seguimiento', self.inicio).data['activa'])
        self.assertEqual(self.enviar('enviar-posiciones', lote).status_code, 200)
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion)).status_code, 409)
        self.assertEqual(RegistroActividad.objects.filter(accion='detener_seguimiento', descripcion='Seguimiento detenido').count(), 1)

    def test_revocar_acceso_y_rotar_dispositivo_cierran_la_captura(self):
        sesion = self.abrir()
        revocar_sesion_movil(self.chofer, self.acceso.pk)
        self.assertIsNotNone(SesionSeguimiento.objects.get(pk=sesion).cerrada_en)
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion)).status_code, 401)
        self.acceso, self.cliente = self.movil(self.chofer)
        self.inicio['clave_operacion'] = str(uuid.uuid4())
        segunda = self.abrir()
        self.movil(self.chofer, self.acceso.identificador_dispositivo)
        self.assertIsNotNone(SesionSeguimiento.objects.get(pk=segunda).cerrada_en)

    def test_finalizar_viaje_cierra_seguimiento(self):
        sesion = self.abrir()
        for parada in self.viaje.paradas.all():
            self.operar(self.viaje, 'llegar', parada=parada.pk)
            self.operar(self.viaje, 'descargar', parada=parada.pk)
        self.operar(self.viaje, 'finalizar')
        seguimiento = SesionSeguimiento.objects.get(pk=sesion)
        self.assertEqual(seguimiento.motivo_cierre, 'viaje')
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion)).status_code, 409)

    def test_paginacion_diez_y_alcance_historial(self):
        sesion = self.abrir()
        self.enviar('enviar-posiciones', self.datos_lote(sesion, [self.punto() for _ in range(11)]))
        direccion = f'/api/v1/movil/mis-despachos/{self.viaje.pk}/posiciones-seguimiento/'
        respuesta = self.cliente.get(direccion, secure=True)
        self.assertEqual(respuesta.data['count'], 11)
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(len(self.cliente.get(direccion + '?page=2', secure=True).data['results']), 1)
        _, ajeno = self.movil(self.otro)
        self.assertEqual(ajeno.get(direccion, secure=True).status_code, 404)

    def test_frecuencia_y_limite_por_minuto(self):
        sesion = self.abrir()
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion, [self.punto() for _ in range(30)])).status_code, 200)
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion)).status_code, 429)
        self.permitir_otro_lote()
        self.assertEqual(self.enviar('enviar-posiciones', self.datos_lote(sesion)).status_code, 429)
        self.assertEqual(PosicionSeguimiento.objects.count(), 30)

    def test_servicio_revalida_permisos_y_fallo_auditoria_revierte(self):
        with patch('despachos.seguimiento.registrar_actividad', side_effect=RuntimeError('auditoria')):
            with self.assertRaises(RuntimeError):
                iniciar_seguimiento(self.chofer, self.acceso, self.viaje.pk, self.inicio)
        self.assertEqual(SesionSeguimiento.objects.count(), 0)
        self.chofer.user_permissions.clear()
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            iniciar_seguimiento(self.chofer, self.acceso, self.viaje.pk, self.inicio)


class PruebasConcurrenciaSeguimiento(DatosDespachos, TransactionTestCase):
    def setUp(self):
        type(self).preparar_datos_despachos()
        super().setUp()

    def test_dos_reintentos_simultaneos_del_mismo_lote_se_guardan_una_vez(self):
        viaje = self.crear_despacho()
        self.operar(viaje, 'enviar')
        self.operar(viaje, 'iniciar')
        viaje.refresh_from_db()
        acceso, _ = crear_sesion_movil(self.actor, uuid.uuid4(), 'Concurrencia GPS')
        sesion = iniciar_seguimiento(self.actor, acceso, viaje.pk,
            {'clave_operacion': str(uuid.uuid4()), 'version': version_despacho(viaje)})
        cuerpo = {'sesion': sesion['id'], 'clave_operacion': str(uuid.uuid4()), 'posiciones': [{
            'id': str(uuid.uuid4()), 'latitud': '-16.5', 'longitud': '-68.14',
            'precision_m': '5', 'capturada_en': timezone.now().isoformat()}]}
        barrera = Barrier(2)

        def enviar():
            close_old_connections()
            try:
                barrera.wait(timeout=10)
                return recibir_posiciones(self.actor, acceso, viaje.pk, cuerpo)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(lambda _: enviar(), range(2)))
        self.assertEqual([resultado['guardadas'] for resultado in resultados], [1, 1])
        self.assertEqual(PosicionSeguimiento.objects.count(), 1)
        self.assertEqual(LotePosiciones.objects.count(), 1)
        self.assertEqual(RegistroActividad.objects.filter(accion='recibir_posiciones').count(), 1)
