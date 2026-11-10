import copy
import io
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.http import Http404
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from clientes.models import Sucursal
from inventario.models import MovimientoInventario
from usuarios.autenticacion_movil import crear_sesion_movil
from usuarios.models import Usuario
from .models import OperacionDespacho, ParadaDespacho, PlanRutaDespacho
from .rutas_carretera import aprobar_ruta, calcular_ruta, consultar_ruta, puntos_despacho
from .rutas_osrm import ErrorCalculoRuta, consultar_osrm, validar_resultado
from .servicios import ConflictoDespacho, version_despacho
from .tests import DatosDespachos


def resultado_prueba(puntos):
    return {'geometria': {'type': 'LineString', 'coordinates': [[float(punto['longitud']), float(punto['latitud'])] for punto in puntos]},
            'distancia_m': Decimal('12000.00'), 'duracion_s': Decimal('1800.00'),
            'tramos': [{'orden': indice, 'distancia_m': '4000.00', 'duracion_s': '600.00'} for indice in range(1, len(puntos))],
            'version_datos': 'datos-sinteticos'}


class DatosRutas(DatosDespachos):
    @classmethod
    def preparar_rutas(cls):
        cls.preparar_datos_despachos()
        for referencia, latitud, longitud in [(cls.almacen, '-16.50', '-68.14'), (cls.centro, '-16.49', '-68.12'), (cls.norte, '-16.48', '-68.10')]:
            referencia.latitud, referencia.longitud = Decimal(latitud), Decimal(longitud)
            referencia.save()
        cls.consulta_rutas = Usuario.objects.create_user(email='consulta@rutas.test', cedula_identidad='98651')
        cls.consulta_rutas.user_permissions.add(Permission.objects.get(content_type__app_label='despachos', codename='view_despacho'))

    def datos_ruta(self, despacho, **cambios):
        despacho.refresh_from_db()
        return {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4()), **cambios}

    def calcular(self, despacho):
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=resultado_prueba):
            return calcular_ruta(self.actor, despacho.pk, self.datos_ruta(despacho))

    def aprobar(self, despacho):
        return aprobar_ruta(self.actor, despacho.pk, self.datos_ruta(despacho, plan=despacho.planes_ruta.first().pk))


class PruebasPlanesRuta(DatosRutas, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_rutas()

    def test_calcular_aprobar_y_fijar_conserva_inventario_y_la_misma_version(self):
        despacho = self.crear_despacho()
        productos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        self.calcular(despacho)
        documento = consultar_ruta(self.actor, despacho.pk)
        self.assertEqual(documento['estado'], 'pendiente_aprobacion')
        self.assertEqual(documento['plan']['puntos'][0]['latitud'], documento['plan']['puntos'][-1]['latitud'])
        self.assertEqual([punto['tipo'] for punto in documento['plan']['puntos']], ['almacen', 'sucursal', 'sucursal', 'retorno'])
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (productos, cajillas))
        self.aprobar(despacho)
        self.operar(despacho, 'enviar')
        plan = despacho.planes_ruta.get()
        self.assertIsNone(plan.fijada_en)
        self.assertEqual(consultar_ruta(self.actor, despacho.pk)['plan']['geometria'], plan.geometria)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (productos, cajillas))
        self.operar(despacho, 'iniciar')
        plan.refresh_from_db()
        self.assertIsNotNone(plan.fijada_en)
        self.assertEqual(MovimientoInventario.objects.count(), productos)
        self.assertEqual(RegistroActividad.objects.filter(accion='calcular_ruta', objeto_id=str(despacho.pk)).count(), 1)

    def test_reintentos_no_duplican_planes_ni_aprobaciones(self):
        despacho = self.crear_despacho()
        datos = self.datos_ruta(despacho)
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=resultado_prueba) as proveedor:
            calcular_ruta(self.actor, despacho.pk, datos)
            calcular_ruta(self.actor, despacho.pk, datos)
        self.assertEqual(proveedor.call_count, 1)
        self.assertEqual(despacho.planes_ruta.count(), 1)
        datos_aprobacion = self.datos_ruta(despacho, plan=despacho.planes_ruta.first().pk)
        aprobar_ruta(self.actor, despacho.pk, datos_aprobacion)
        aprobar_ruta(self.actor, despacho.pk, datos_aprobacion)
        self.assertEqual(OperacionDespacho.objects.filter(accion='aprobar_ruta').count(), 1)
        with self.assertRaises(ConflictoDespacho):
            calcular_ruta(self.actor, despacho.pk, {**datos, 'version': 'b' * 64})

    def test_lectores_y_choferes_no_calculan_y_los_servicios_revalidan_alcance(self):
        despacho = self.crear_despacho()
        self.assertEqual(consultar_ruta(self.consulta_rutas, despacho.pk)['estado'], 'sin_calcular')
        with self.assertRaises(PermissionDenied):
            calcular_ruta(self.consulta_rutas, despacho.pk, self.datos_ruta(despacho))
        for indice in (1, 2):
            usuario = Usuario.objects.create_user(email=f'chofer{indice}@rutas.test', cedula_identidad=f'9866{indice}')
            usuario.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename__in=['conducir_despacho', 'ver_despachos_propios']))
            if indice == 1:
                chofer = usuario
        despacho.chofer = chofer
        despacho.save()
        self.calcular(despacho)
        self.aprobar(despacho)
        self.operar(despacho, 'enviar')
        sesion, credencial = crear_sesion_movil(chofer, uuid.uuid4(), 'Prueba de mapa')
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {credencial}')
        respuesta = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/ruta/', secure=True)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['plan']['id'], despacho.planes_ruta.get().pk)
        self.assertFalse(respuesta.data['puede_calcular'])
        with self.assertRaises(Http404):
            consultar_ruta(usuario, despacho.pk, como_chofer=True)

    def test_cambios_de_coordenadas_orden_y_ubicaciones_pendientes_invalidan_el_borrador(self):
        despacho = self.crear_despacho()
        self.calcular(despacho)
        self.centro.latitud = Decimal('-16.491')
        self.centro.save()
        self.assertEqual(consultar_ruta(self.actor, despacho.pk)['estado'], 'obsoleta')
        with self.assertRaises(ConflictoDespacho):
            self.aprobar(despacho)
        self.calcular(despacho)
        self.aprobar(despacho)
        self.norte.latitud, self.norte.longitud = None, None
        self.norte.save()
        self.assertEqual(consultar_ruta(self.actor, despacho.pk)['estado'], 'obsoleta')
        self.operar(despacho, 'enviar')
        self.assertEqual(consultar_ruta(self.actor, despacho.pk)['estado'], 'obsoleta')
        self.assertFalse(despacho.planes_ruta.filter(fijada_en__isnull=False).exists())

    def test_sin_coordenadas_o_error_del_proveedor_conserva_el_despacho(self):
        despacho = self.crear_despacho()
        self.almacen.latitud, self.almacen.longitud = None, None
        self.almacen.save()
        self.assertEqual(consultar_ruta(self.actor, despacho.pk)['estado'], 'faltan_ubicaciones')
        with patch('despachos.rutas_carretera.consultar_osrm') as proveedor:
            with self.assertRaises(ValidationError):
                calcular_ruta(self.actor, despacho.pk, self.datos_ruta(despacho))
            proveedor.assert_not_called()
        self.almacen.latitud, self.almacen.longitud = Decimal('-16.5'), Decimal('-68.14')
        self.almacen.save()
        version = self.datos_ruta(despacho)['version']
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=ErrorCalculoRuta):
            with self.assertRaises(ErrorCalculoRuta):
                calcular_ruta(self.actor, despacho.pk, self.datos_ruta(despacho))
        despacho.refresh_from_db()
        self.assertEqual(version_despacho(despacho), version)
        self.assertEqual(despacho.planes_ruta.count(), 0)

    def test_el_viaje_iniciado_conserva_sus_coordenadas_aunque_cambie_el_catalogo(self):
        despacho = self.crear_despacho()
        self.calcular(despacho)
        self.aprobar(despacho)
        self.operar(despacho, 'enviar')
        self.operar(despacho, 'iniciar')
        antes = consultar_ruta(self.actor, despacho.pk)
        self.almacen.latitud = Decimal('0')
        self.almacen.save()
        self.assertEqual(consultar_ruta(self.actor, despacho.pk)['plan'], antes['plan'])
        with self.assertRaises(ValidationError):
            self.calcular(despacho)

    def test_cambios_mientras_osrm_responde_y_fallos_de_auditoria_no_guardan_planes(self):
        despacho = self.crear_despacho()
        def cambiar_durante_calculo(puntos):
            self.centro.latitud = Decimal('-16.492')
            self.centro.save()
            return resultado_prueba(puntos)
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=cambiar_durante_calculo):
            with self.assertRaises(ConflictoDespacho):
                calcular_ruta(self.actor, despacho.pk, self.datos_ruta(despacho))
        with patch('despachos.rutas_carretera.registrar_actividad', side_effect=RuntimeError('auditoria')):
            with self.assertRaises(RuntimeError):
                self.calcular(despacho)
        self.assertEqual(despacho.planes_ruta.count(), 0)
        self.assertFalse(OperacionDespacho.objects.filter(accion='calcular_ruta').exists())

    def test_el_calculo_considera_mas_de_diez_paradas_y_el_retorno(self):
        despacho = self.crear_despacho()
        for indice in range(3, 14):
            sucursal = Sucursal.objects.create(cliente=self.cliente, nombre=f'Destino {indice}', direccion='Prueba', latitud='-16.45', longitud='-68.10')
            ParadaDespacho.objects.create(despacho=despacho, sucursal=sucursal, orden=indice,
                cliente_nombre='Cliente de prueba', sucursal_nombre=sucursal.nombre, direccion=sucursal.direccion)
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=resultado_prueba) as proveedor:
            calcular_ruta(self.actor, despacho.pk, self.datos_ruta(despacho))
        self.assertEqual(len(proveedor.call_args.args[0]), 15)
        self.assertEqual(len(despacho.planes_ruta.get().puntos), 15)

    def test_api_administrativa_exige_editar_y_version_y_no_acepta_geometria_del_cliente(self):
        despacho = self.crear_despacho()
        self.client.force_authenticate(self.consulta_rutas)
        self.assertEqual(self.client.post(f'/api/v1/despachos/{despacho.pk}/calcular-ruta/', self.datos_ruta(despacho), format='json').status_code, 403)
        self.client.force_authenticate(self.actor)
        self.assertEqual(self.client.post(f'/api/v1/despachos/{despacho.pk}/calcular-ruta/', self.datos_ruta(despacho, geometria={}), format='json').status_code, 400)
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=resultado_prueba):
            respuesta = self.client.post(f'/api/v1/despachos/{despacho.pk}/calcular-ruta/', self.datos_ruta(despacho), format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertFalse(respuesta.data['trafico_en_vivo'])


class PruebasRespuestaOSRM(TestCase):
    def respuesta(self):
        return {'code': 'Ok', 'waypoints': [{'location': [-68.14, -16.5], 'distance': 0}] * 3,
                'routes': [{'distance': 12, 'duration': 6, 'geometry': {'type': 'LineString', 'coordinates': [[-68.14, -16.5], [-68.12, -16.49], [-68.14, -16.5]]},
                            'legs': [{'distance': 6, 'duration': 3}, {'distance': 6, 'duration': 3}]}]}

    def test_rechaza_errores_rutas_incompletas_metricas_invalidas_y_coordenadas_falsas(self):
        original = self.respuesta()
        self.assertEqual(validar_resultado(original, 3)['distancia_m'], Decimal('12.00'))
        for alterar in [lambda dato: dato.update(waypoints=[]), lambda dato: dato['routes'][0].update(duration=float('nan')),
                        lambda dato: dato['routes'][0].update(legs=[]), lambda dato: dato['routes'][0]['geometry'].update(coordinates=[[999, 0], [0, 0]]),
                        lambda dato: dato['routes'][0].update(distance=150)]:
            datos = copy.deepcopy(original)
            alterar(datos)
            with self.assertRaises(ErrorCalculoRuta):
                validar_resultado(datos, 3)
        with self.assertRaises(ValidationError):
            validar_resultado({'code': 'NoRoute'}, 3)

    @override_settings(OSRM_URL='https://rutas.test', OSRM_MAX_PUNTOS=100)
    def test_transporte_sin_credenciales_pide_geometria_completa_y_limita_la_respuesta(self):
        puntos = [{'longitud': '-68.14', 'latitud': '-16.5'}] * 3
        with patch('despachos.rutas_osrm.build_opener') as creador:
            creador.return_value.open.return_value.__enter__.return_value = io.BytesIO(json.dumps(self.respuesta()).encode())
            consultar_osrm(puntos)
            solicitud = creador.return_value.open.call_args.args[0]
            self.assertIn('geometries=geojson', solicitud.full_url)
            self.assertIn('overview=full', solicitud.full_url)
            self.assertNotIn('Authorization', solicitud.headers)
        for direccion in ['file:///secreto', 'http://[', 'http://127.0.0.1:invalido']:
            with override_settings(OSRM_URL=direccion):
                with self.assertRaises(ErrorCalculoRuta):
                    consultar_osrm(puntos)


class PruebasConcurrenciaRuta(DatosRutas, TransactionTestCase):
    def setUp(self):
        self.preparar_rutas()
        super().setUp()

    def test_dos_reintentos_concurrentes_guardan_un_solo_plan(self):
        despacho = self.crear_despacho()
        datos = self.datos_ruta(despacho)
        barrera = Barrier(2)
        def proveedor(puntos):
            barrera.wait(timeout=10)
            return resultado_prueba(puntos)
        def ejecutar(_):
            close_old_connections()
            try:
                return calcular_ruta(self.actor, despacho.pk, datos).pk
            finally:
                close_old_connections()
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=proveedor):
            with ThreadPoolExecutor(max_workers=2) as ejecutor:
                self.assertEqual(list(ejecutor.map(ejecutar, range(2))), [despacho.pk, despacho.pk])
        self.assertEqual(PlanRutaDespacho.objects.count(), 1)
        self.assertEqual(OperacionDespacho.objects.filter(accion='calcular_ruta').count(), 1)

    def test_uuid_concurrente_entre_despachos_no_produce_error_interno(self):
        despachos = [self.crear_despacho(asignaciones=[fila.pk], orden_sucursales=[fila.sucursal_id], cajillas=[])
                     for fila in self.asignaciones]
        clave = str(uuid.uuid4())
        solicitudes = [(despacho.pk, self.datos_ruta(despacho, clave_operacion=clave)) for despacho in despachos]
        barrera = Barrier(2)

        def proveedor(puntos):
            barrera.wait(timeout=10)
            return resultado_prueba(puntos)

        def ejecutar(solicitud):
            close_old_connections()
            try:
                calcular_ruta(self.actor, *solicitud)
                return 'creado'
            except ConflictoDespacho:
                return 'conflicto'
            finally:
                close_old_connections()

        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=proveedor):
            with ThreadPoolExecutor(max_workers=2) as ejecutor:
                self.assertCountEqual(ejecutor.map(ejecutar, solicitudes), ['creado', 'conflicto'])
        self.assertEqual(PlanRutaDespacho.objects.count(), 1)
        self.assertEqual(OperacionDespacho.objects.filter(accion='calcular_ruta').count(), 1)
