import copy
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import MovimientoInventario
from pedidos.models import Pedido
from usuarios.models import Usuario
from .models import ConsultaAlternativasRuta, OperacionDespacho, CalculoOptimizacion
from .rutas_carretera import calcular_ruta, aprobar_ruta
from .rutas_osrm import consultar_alternativas_osrm, ErrorCalculoRuta
from .servicios import version_despacho
from .test_rutas_carretera import DatosRutas


def trazado_prueba(puntos):
    coordenadas = [[float(punto['longitud']), float(punto['latitud'])] for punto in puntos]
    tramos = [{'orden': indice, 'distancia_m': '1000.00', 'duracion_s': '60.00',
        'geometria': {'type': 'LineString', 'coordinates': coordenadas[indice - 1:indice + 1]}}
        for indice in range(1, len(puntos))]
    return {'geometria': {'type': 'LineString', 'coordinates': coordenadas}, 'tramos': tramos,
        'distancia_m': Decimal(1000 * len(tramos)), 'duracion_s': Decimal(60 * len(tramos)), 'version_datos': 'prueba-osrm'}


class PruebasAlternativasRuta(DatosRutas, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_rutas()
        permisos = Permission.objects.filter(content_type__app_label='despachos', codename__in=[
            'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios'])
        cls.chofer = Usuario.objects.create_user(email='caminos@chofer.test', cedula_identidad='995101')
        cls.otro = Usuario.objects.create_user(email='ajeno@caminos.test', cedula_identidad='995102')
        cls.chofer.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)

    def navegador(self, actor=None):
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(actor or self.chofer)
        token = cliente.get('/api/v1/auth/csrf/', secure=True).json()['csrfToken']
        cliente.credentials(HTTP_X_CSRFTOKEN=token, HTTP_REFERER='https://testserver/')
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 200)
        return cliente

    def preparar(self):
        viaje = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(viaje, 'enviar')
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=trazado_prueba):
            calcular_ruta(self.chofer, viaje.pk, self.datos_ruta(viaje), como_chofer=True)
        return viaje, self.navegador()

    def aprobar(self, viaje):
        return aprobar_ruta(self.chofer, viaje.pk, self.datos_ruta(viaje, plan=viaje.planes_ruta.first().pk), como_chofer=True)

    def consultar(self, viaje, cliente, tramo=1, proveedor=None, **cambios):
        plan = viaje.planes_ruta.first()
        documento = self.datos_ruta(viaje, plan=plan.pk, tramo=tramo, **cambios)
        def opciones(puntos):
            resultado = trazado_prueba(puntos)
            otra = copy.deepcopy(resultado)
            primero, ultimo = otra['tramos'][0]['geometria']['coordinates']
            otra['tramos'][0]['geometria']['coordinates'] = [primero, [(primero[0] + ultimo[0])/2, (primero[1] + ultimo[1])/2 + 0.001], ultimo]
            otra['distancia_m'], otra['duracion_s'] = Decimal('1400.00'), Decimal('100.00')
            resultado['calles'], otra['calles'] = ['Calle original'], ['Camino alternativo']
            return [resultado, otra, copy.deepcopy(otra)]
        with patch('despachos.alternativas_ruta.consultar_alternativas_osrm', side_effect=proveedor or opciones) as motor:
            respuesta = cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/consultar-alternativas/', documento, format='json', secure=True)
        return respuesta, documento, motor

    def elegir(self, viaje, cliente, consulta, opcion=1, **cambios):
        documento = self.datos_ruta(viaje, consulta=consulta, opcion=opcion, **cambios)
        return cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/elegir-alternativa/', documento, format='json', secure=True), documento

    def test_consulta_deduplica_y_conserva_version_plan_confirmacion_y_reintento(self):
        viaje, cliente = self.preparar()
        self.aprobar(viaje)
        version = self.datos_ruta(viaje)['version']
        respuesta, documento, motor = self.consultar(viaje, cliente)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(len(respuesta.data['opciones']), 2)
        self.assertTrue(respuesta.data['opciones'][0]['actual'])
        self.assertFalse(respuesta.data['trafico_en_vivo'])
        self.assertEqual(respuesta.data['opciones'][1]['calles'], ['Camino alternativo'])
        viaje.refresh_from_db()
        self.assertEqual(version_despacho(viaje), version)
        self.assertIsNotNone(viaje.planes_ruta.get().aprobada_en)
        with patch('despachos.alternativas_ruta.consultar_alternativas_osrm') as repetido:
            otra = cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/consultar-alternativas/', documento, format='json', secure=True)
        repetido.assert_not_called()
        self.assertEqual(otra.data['consulta'], respuesta.data['consulta'])
        self.assertEqual(ConsultaAlternativasRuta.objects.count(), 1)
        self.assertEqual(RegistroActividad.objects.filter(accion='consultar_alternativas_ruta').count(), 1)

    def test_elegir_crea_propuesta_exacta_sin_mover_carga_y_exige_confirmar_antes_de_salir(self):
        viaje, cliente = self.preparar()
        self.aprobar(viaje)
        base = viaje.planes_ruta.first()
        evidencia = (copy.deepcopy(base.geometria), copy.deepcopy(base.tramos), base.aprobada_en)
        estado = (list(viaje.paradas.values_list('pk','orden')), list(viaje.cargas.values_list('pk','contenido')),
                  MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), list(Pedido.objects.values_list('pk','estado')))
        consulta, _, _ = self.consultar(viaje, cliente)
        elegido, documento = self.elegir(viaje, cliente, consulta.data['consulta'])
        self.assertEqual(elegido.status_code, 200, elegido.data)
        self.assertEqual(elegido.data['estado'], 'pendiente_aprobacion')
        nuevo = viaje.planes_ruta.first()
        self.assertNotEqual(base.pk, nuevo.pk)
        self.assertEqual((nuevo.distancia_m, nuevo.duracion_s), (Decimal('3400'), Decimal('220')))
        self.assertEqual(nuevo.tramos[0]['geometria'], consulta.data['opciones'][1]['geometria'])
        self.assertEqual(nuevo.puntos, base.puntos)
        base.refresh_from_db()
        self.assertEqual((base.geometria, base.tramos, base.aprobada_en), evidencia)
        self.assertEqual(estado, (list(viaje.paradas.values_list('pk','orden')), list(viaje.cargas.values_list('pk','contenido')),
                  MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), list(Pedido.objects.values_list('pk','estado'))))
        repetida = cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/elegir-alternativa/', documento, format='json', secure=True)
        self.assertEqual(repetida.status_code, 200)
        self.assertEqual(viaje.planes_ruta.count(), 2)
        self.assertEqual(OperacionDespacho.objects.filter(accion='elegir_alternativa_ruta').count(), 1)
        conflicto = cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/elegir-alternativa/', {**documento, 'opcion': 0}, format='json', secure=True)
        self.assertEqual(conflicto.status_code, 409)
        self.assertEqual(cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/iniciar/', self.datos_ruta(viaje), format='json', secure=True).status_code, 400)
        self.aprobar(viaje)
        self.assertEqual(cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/iniciar/', self.datos_ruta(viaje), format='json', secure=True).status_code, 200)
        nuevo.refresh_from_db()
        self.assertIsNotNone(nuevo.fijada_en)

    def test_alternativa_de_regreso_conserva_almacen_y_colores(self):
        viaje, cliente = self.preparar()
        base = cliente.get(f'/api/v1/chofer/mis-viajes/{viaje.pk}/ruta/', secure=True).data
        consulta, _, _ = self.consultar(viaje, cliente, tramo=3)
        respuesta, _ = self.elegir(viaje, cliente, consulta.data['consulta'])
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['plan']['puntos'], base['plan']['puntos'])
        self.assertEqual(respuesta.data['plan']['tramos'][-1]['color'], '#16803c')
        self.assertEqual(respuesta.data['plan']['geometria']['coordinates'][-1], respuesta.data['plan']['geometria']['coordinates'][0])

    def test_sin_alternativas_o_con_otro_acceso_se_conserva_solo_la_actual(self):
        viaje, cliente = self.preparar()
        def sin_otro_acceso(puntos):
            resultado = trazado_prueba(puntos)
            resultado['tramos'][0]['geometria']['coordinates'][0][0] += 0.005
            resultado['calles'] = []
            return [resultado]
        respuesta, _, _ = self.consultar(viaje, cliente, proveedor=sin_otro_acceso)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(len(respuesta.data['opciones']), 1)
        actual, _ = self.elegir(viaje, cliente, respuesta.data['consulta'], opcion=0)
        self.assertEqual(actual.status_code, 200)
        self.assertEqual(viaje.planes_ruta.count(), 1)

    def test_alcance_csrf_y_permisos_se_revalidan(self):
        viaje, cliente = self.preparar()
        ajeno = self.navegador(self.otro)
        respuesta, _, _ = self.consultar(viaje, ajeno)
        self.assertEqual(respuesta.status_code, 404)
        cliente.credentials()
        respuesta, _, _ = self.consultar(viaje, cliente)
        self.assertEqual(respuesta.status_code, 403)
        cliente = self.navegador()
        def revocar(puntos):
            self.chofer.user_permissions.remove(Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios'))
            resultado = trazado_prueba(puntos); resultado['calles'] = []
            return [resultado]
        respuesta, _, _ = self.consultar(viaje, cliente, proveedor=revocar)
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(ConsultaAlternativasRuta.objects.count(), 0)

    def test_cambio_de_coordenadas_durante_consulta_no_guarda_opciones(self):
        viaje, cliente = self.preparar()
        def cambiar(puntos):
            self.centro.latitud = Decimal('-16.499'); self.centro.save()
            resultado = trazado_prueba(puntos); resultado['calles'] = []
            return [resultado]
        respuesta, _, _ = self.consultar(viaje, cliente, proveedor=cambiar)
        self.assertEqual(respuesta.status_code, 409)
        self.assertFalse(ConsultaAlternativasRuta.objects.exists())

    def test_consulta_vencida_y_plan_obsoleto_no_se_aplican(self):
        viaje, cliente = self.preparar()
        respuesta, _, _ = self.consultar(viaje, cliente)
        consulta = ConsultaAlternativasRuta.objects.get(pk=respuesta.data['consulta'])
        consulta.vence_en = timezone.now() - timedelta(seconds=1); consulta.save()
        self.assertEqual(self.elegir(viaje, cliente, consulta.pk)[0].status_code, 409)
        otra, _, _ = self.consultar(viaje, cliente)
        self.centro.latitud = Decimal('-16.495'); self.centro.save()
        self.assertEqual(self.elegir(viaje, cliente, otra.data['consulta'])[0].status_code, 409)
        self.assertEqual(viaje.planes_ruta.count(), 1)

    @override_settings(OPTIMIZACION_HABILITADA=True)
    def test_trabajo_activo_e_inicio_bloquean_consulta_y_eleccion(self):
        viaje, cliente = self.preparar()
        respuesta, _, _ = self.consultar(viaje, cliente)
        plan = viaje.planes_ruta.first()
        calculo = CalculoOptimizacion.objects.create(despacho=viaje, clave_operacion=uuid.uuid4(), huella_solicitud='a'*64,
            version_despacho=self.datos_ruta(viaje)['version'], huella_puntos=plan.huella_puntos, puntos=plan.puntos,
            vence_en=timezone.now()+timedelta(minutes=5), responsable=self.chofer, responsable_nombre='Prueba')
        self.assertEqual(self.consultar(viaje, cliente)[0].status_code, 400)
        self.assertEqual(self.elegir(viaje, cliente, respuesta.data['consulta'])[0].status_code, 400)
        calculo.estado = 'cancelada'; calculo.save()
        self.aprobar(viaje); self.operar(viaje, 'iniciar')
        self.assertEqual(self.consultar(viaje, cliente)[0].status_code, 400)
        self.assertEqual(self.elegir(viaje, cliente, respuesta.data['consulta'])[0].status_code, 400)

    def test_cliente_no_puede_enviar_geometria_y_auditoria_fallida_revierte_eleccion(self):
        viaje, cliente = self.preparar()
        respuesta, _, _ = self.consultar(viaje, cliente)
        documento = self.datos_ruta(viaje, consulta=respuesta.data['consulta'], opcion=1, geometria={})
        self.assertEqual(cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/elegir-alternativa/', documento, format='json', secure=True).status_code, 400)
        with patch('despachos.alternativas_ruta.registrar_actividad', side_effect=RuntimeError('auditoria')):
            with self.assertRaises(RuntimeError):
                self.elegir(viaje, cliente, respuesta.data['consulta'])
        self.assertEqual(viaje.planes_ruta.count(), 1)
        self.assertFalse(OperacionDespacho.objects.filter(accion='elegir_alternativa_ruta').exists())

    def test_adaptador_osrm_valida_cada_ruta_y_pide_alternativas(self):
        puntos = [{'longitud':'-68.14', 'latitud':'-16.5'}, {'longitud':'-68.12','latitud':'-16.49'}]
        coordenadas = [[-68.14,-16.5],[-68.12,-16.49]]
        ruta = {'geometry': {'type':'LineString','coordinates':coordenadas}, 'distance':1000, 'duration':60,
            'legs':[{'distance':1000,'duration':60,'steps':[{'distance':1000,'name':'Calle Prueba','geometry':{'type':'LineString','coordinates':coordenadas}}]}]}
        datos = {'code':'Ok', 'routes':[ruta,copy.deepcopy(ruta)], 'waypoints':[{'location':p,'distance':0} for p in coordenadas]}
        with patch('despachos.rutas_osrm.solicitar_datos_osrm', return_value=datos) as solicitar:
            respuesta = consultar_alternativas_osrm(puntos)
        self.assertEqual(solicitar.call_args.args[2]['alternatives'], '2')
        self.assertEqual(respuesta[0]['calles'], ['Calle Prueba'])
        datos['routes'][1]['legs'][0]['duration'] = 500
        with patch('despachos.rutas_osrm.solicitar_datos_osrm', return_value=datos):
            with self.assertRaises(ErrorCalculoRuta): consultar_alternativas_osrm(puntos)
