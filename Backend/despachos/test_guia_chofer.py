import copy
import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.http import Http404
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import PermissionDenied, ValidationError, Throttled, AuthenticationFailed
from auditoria.models import RegistroActividad
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla
from pedidos.models import Pedido
from usuarios.models import Usuario, SesionMovil
from .test_rutas_carretera import DatosRutas
from .seguimiento import iniciar_seguimiento, detener_seguimiento
from .guia_chofer import consultar_guia
from .models import ConsultaGuiaChofer, PlanRutaDespacho, OperacionDespacho
from .servicios import version_despacho, ConflictoDespacho
from .rutas_osrm import ErrorCalculoRuta


def camino_prueba(puntos):
    coordenadas=[[float(p['longitud']),float(p['latitud'])] for p in puntos]
    return {'geometria':{'type':'LineString','coordinates':coordenadas},'distancia_m':Decimal('1500.00'),'duracion_s':Decimal('300.00'),
        'version_datos':'prueba','tramos':[{'orden':i+1,'distancia_m':'500','duracion_s':'100',
            'geometria':{'type':'LineString','coordinates':coordenadas[i:i+2]}} for i in range(len(puntos)-1)]}


class DatosGuia(DatosRutas):
    @classmethod
    def preparar_datos_guia(cls):
        cls.preparar_rutas()
        cls.chofer=Usuario.objects.create_user(email='guia@chofer.test',cedula_identidad='788001')
        cls.otro=Usuario.objects.create_user(email='otra.guia@chofer.test',cedula_identidad='788002')
        permisos=Permission.objects.filter(content_type__app_label='despachos',codename__in=[
            'conducir_despacho','ver_despachos_propios','operar_despachos_propios'])
        cls.chofer.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)

    def preparar_guia(self):
        self.viaje=self.crear_despacho(chofer=self.chofer.pk)
        with patch('despachos.rutas_carretera.consultar_osrm',side_effect=camino_prueba):
            self.calcular(self.viaje)
        # DatosRutas.calcular tiene su propio proveedor; dotar al plan de tramos
        # sintéticos explícitos permite comprobar el recorte sin red real.
        self.plan=self.viaje.planes_ruta.get()
        self.plan.tramos=camino_prueba(self.plan.puntos)['tramos']
        self.plan.save(update_fields=['tramos'])
        self.aprobar(self.viaje)
        self.operar(self.viaje,'enviar')
        self.operar(self.viaje,'iniciar')
        self.viaje.refresh_from_db()
        self.plan.refresh_from_db()
        self.navegador=APIClient(enforce_csrf_checks=True)
        self.navegador.force_login(self.chofer)
        csrf=self.navegador.get('/api/v1/auth/csrf/',secure=True).json()['csrfToken']
        self.navegador.credentials(HTTP_X_CSRFTOKEN=csrf,HTTP_REFERER='https://testserver/')
        self.assertEqual(self.navegador.post('/api/v1/chofer/acceso/',{},format='json',secure=True).status_code,200)
        self.acceso=SesionMovil.objects.filter(usuario=self.chofer).latest('creada_en')
        self.sesion=iniciar_seguimiento(self.chofer,self.acceso,self.viaje.pk,{'version':version_despacho(self.viaje),'clave_operacion':str(uuid.uuid4())})
        self.ruta=f'/api/v1/chofer/mis-viajes/{self.viaje.pk}/guia-destino/'

    def datos(self,**cambios):
        self.viaje.refresh_from_db()
        return {'clave_operacion':str(uuid.uuid4()),'sesion':self.sesion['id'],'plan':self.plan.pk,'tramo':1,
            'version':version_despacho(self.viaje),'posicion':{'id':str(uuid.uuid4()),'latitud':'-16.5000000','longitud':'-68.1500000',
            'precision_m':'10.00','capturada_en':timezone.now().isoformat()},**cambios}

    def consultar(self,datos=None,proveedor=camino_prueba):
        with patch('despachos.guia_chofer.consultar_osrm',side_effect=proveedor):
            return consultar_guia(self.chofer,self.acceso,self.viaje.pk,datos or self.datos())


class PruebasGuiaChofer(DatosGuia,TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_guia()

    def setUp(self):
        super().setUp()
        self.preparar_guia()

    def test_guia_desde_gps_hasta_destino_fijado_sin_modificar_operaciones(self):
        version=version_despacho(self.viaje)
        original=copy.deepcopy(self.plan.geometria),copy.deepcopy(self.plan.tramos),copy.deepcopy(self.plan.puntos)
        conteos=MovimientoInventario.objects.count(),MovimientoCajilla.objects.count(),OperacionDespacho.objects.count(),PlanRutaDespacho.objects.count()
        pedidos=list(Pedido.objects.values_list('pk','estado'))
        respuesta=self.consultar()
        self.assertEqual(respuesta['estado'],'lista')
        self.assertEqual(respuesta['geometria']['coordinates'][0],[-68.15,-16.5])
        self.assertEqual(respuesta['geometria']['coordinates'][-1],self.plan.tramos[0]['geometria']['coordinates'][-1])
        self.plan.refresh_from_db();self.viaje.refresh_from_db()
        self.assertEqual(version_despacho(self.viaje),version)
        self.assertEqual((self.plan.geometria,self.plan.tramos,self.plan.puntos),original)
        self.assertEqual((MovimientoInventario.objects.count(),MovimientoCajilla.objects.count(),OperacionDespacho.objects.count(),PlanRutaDespacho.objects.count()),conteos)
        self.assertEqual(list(Pedido.objects.values_list('pk','estado')),pedidos)
        self.assertEqual(RegistroActividad.objects.filter(accion='consultar_guia_chofer').count(),1)
        self.assertNotIn('latitud',str(RegistroActividad.objects.get(accion='consultar_guia_chofer').cambios))

    def test_uuid_reintenta_sin_llamar_motor_y_cuerpo_distinto_se_rechaza(self):
        datos=self.datos();primera=self.consultar(datos)
        with patch('despachos.guia_chofer.consultar_osrm') as motor:
            self.assertEqual(consultar_guia(self.chofer,self.acceso,self.viaje.pk,datos),primera)
            motor.assert_not_called()
        otro=copy.deepcopy(datos);otro['posicion']['longitud']='-68.1510000'
        with self.assertRaises(ConflictoDespacho):self.consultar(otro)
        self.assertEqual(ConsultaGuiaChofer.objects.count(),1)

    def test_falta_consentimiento_y_sesion_ajena_no_consultan_calles(self):
        datos=self.datos(sesion=str(uuid.uuid4()))
        with self.assertRaises(Http404):self.consultar(datos)
        detener_seguimiento(self.chofer,self.acceso,self.viaje.pk,{'sesion':self.sesion['id'],'motivo':'chofer'})
        with self.assertRaises(ConflictoDespacho):self.consultar()

    def test_alcance_propio_se_exige_incluso_para_administradores(self):
        with self.assertRaises((PermissionDenied,Http404)):
            consultar_guia(self.actor,self.acceso,self.viaje.pk,self.datos())
        datos=self.datos(tramo=2)
        with self.assertRaises(ConflictoDespacho):self.consultar(datos)
        with self.assertRaises(Http404):self.consultar(self.datos(plan=999999))

    def test_gps_antiguo_invalido_o_impreciso_no_dispara_motor(self):
        for cambios in [{'precision_m':'100.01'},{'precision_m':'-1'},{'latitud':'91'},{'longitud':'NaN'},
            {'capturada_en':(timezone.now()-timedelta(seconds=31)).isoformat()},
            {'capturada_en':(timezone.now()+timedelta(seconds=31)).isoformat()}]:
            datos=self.datos();datos['posicion'].update(cambios)
            with self.subTest(cambios=cambios),patch('despachos.guia_chofer.consultar_osrm') as motor:
                with self.assertRaises(ValidationError):consultar_guia(self.chofer,self.acceso,self.viaje.pk,datos)
                motor.assert_not_called()

    def test_limite_de_consultas_se_comparte_entre_claves(self):
        self.consultar()
        with self.assertRaises(Throttled):self.consultar()
        ConsultaGuiaChofer.objects.update(creado_en=timezone.now()-timedelta(seconds=16))
        self.assertEqual(self.consultar()['estado'],'lista')

    def test_no_hay_linea_inventada_si_osrm_falla_o_cambia_el_destino(self):
        for proveedor in [lambda puntos: (_ for _ in ()).throw(ErrorCalculoRuta()),
            lambda puntos:camino_prueba([puntos[0],{'longitud':'-67.00','latitud':'-16.00'}])]:
            respuesta=self.consultar(proveedor=proveedor)
            self.assertEqual(respuesta['estado'],'error')
            self.assertIsNone(respuesta['geometria'])
            ConsultaGuiaChofer.objects.update(creado_en=timezone.now()-timedelta(seconds=16))

    def test_salida_demasiado_lejana_del_gps_se_rechaza(self):
        def proveedor(puntos):
            return camino_prueba([{'longitud':'-68.00','latitud':'-16.50'},puntos[1]])
        self.assertEqual(self.consultar(proveedor=proveedor)['estado'],'error')

    def test_plan_historico_sin_geometria_por_tramo_conserva_su_linea(self):
        original=copy.deepcopy(self.plan.geometria)
        self.plan.tramos=[{campo:valor for campo,valor in tramo.items() if campo!='geometria'} for tramo in self.plan.tramos]
        self.plan.save(update_fields=['tramos'])
        self.assertEqual(self.consultar()['estado'],'lista')
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.geometria,original)

    def test_consulta_abandonada_pasa_a_error_sin_repetir_osrm(self):
        datos=self.datos()
        self.consultar(datos)
        consulta=ConsultaGuiaChofer.objects.get()
        consulta.estado='pendiente';consulta.resuelto_en=None;consulta.geometria={}
        consulta.creado_en=timezone.now()-timedelta(seconds=26)
        consulta.save(update_fields=['estado','resuelto_en','geometria','creado_en'])
        with patch('despachos.guia_chofer.consultar_osrm') as motor:
            respuesta=consultar_guia(self.chofer,self.acceso,self.viaje.pk,datos)
            self.assertEqual(respuesta['estado'],'error');motor.assert_not_called()

    def test_al_descargar_avanza_y_al_completar_conserva_el_regreso(self):
        paradas=list(self.viaje.paradas.order_by('orden'))
        paradas[0].llegada_en=paradas[0].descargada_en=timezone.now();paradas[0].save(update_fields=['llegada_en','descargada_en'])
        with self.assertRaises(ConflictoDespacho):self.consultar()
        respuesta=self.consultar(self.datos(tramo=2))
        self.assertEqual(respuesta['tramo'],2)
        ConsultaGuiaChofer.objects.update(creado_en=timezone.now()-timedelta(seconds=16))
        self.viaje.paradas.update(llegada_en=timezone.now(),descargada_en=timezone.now())
        respuesta=self.consultar(self.datos(tramo=3))
        self.assertEqual(respuesta['geometria']['coordinates'][-1],self.plan.tramos[-1]['geometria']['coordinates'][-1])

    def test_descarga_parcial_y_llegada_conservan_el_destino(self):
        parada=self.viaje.paradas.first();parada.llegada_en=timezone.now();parada.save(update_fields=['llegada_en'])
        self.assertEqual(self.consultar()['tramo'],1)

    def test_no_se_publica_respuesta_tras_revocar_permiso_o_detener_gps(self):
        def detener(puntos):
            detener_seguimiento(self.chofer,self.acceso,self.viaje.pk,{'sesion':self.sesion['id'],'motivo':'chofer'})
            return camino_prueba(puntos)
        with self.assertRaises(ConflictoDespacho):self.consultar(proveedor=detener)
        self.assertFalse(ConsultaGuiaChofer.objects.filter(estado='lista').exists())

    def test_permiso_y_version_se_revalidan_al_responder_osrm(self):
        def revocar(puntos):
            self.chofer.user_permissions.remove(Permission.objects.get(content_type__app_label='despachos',codename='operar_despachos_propios'))
            return camino_prueba(puntos)
        with self.assertRaises(PermissionDenied):self.consultar(proveedor=revocar)

    def test_cambio_de_version_durante_calculo_no_se_aplica(self):
        def cambiar(puntos):
            self.viaje.save()
            return camino_prueba(puntos)
        with self.assertRaises(ConflictoDespacho):self.consultar(proveedor=cambiar)
        self.assertFalse(ConsultaGuiaChofer.objects.filter(estado='lista').exists())

    def test_error_de_auditoria_no_guarda_geometria_parcial(self):
        with patch('despachos.guia_chofer.registrar_actividad',side_effect=RuntimeError('auditoria')):
            with self.assertRaises(RuntimeError):self.consultar()
        self.assertEqual(ConsultaGuiaChofer.objects.count(),0)

    def test_api_csrf_sesion_privada_y_compatibilidad_movil(self):
        datos=self.datos()
        with patch('despachos.guia_chofer.consultar_osrm',side_effect=camino_prueba):
            respuesta=self.navegador.post(self.ruta,datos,format='json',secure=True)
        self.assertEqual(respuesta.status_code,200,respuesta.data)
        self.navegador.credentials()
        self.assertEqual(self.navegador.post(self.ruta,datos,format='json',secure=True).status_code,403)
        self.assertEqual(self.navegador.get(self.ruta,secure=True).status_code,405)
        self.assertEqual(self.navegador.post(f'/api/v1/movil/mis-despachos/{self.viaje.pk}/guia-destino/',datos,format='json',secure=True).status_code,404)

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_endpoint_publico_sigue_exigiendo_chofer_propio(self):
        with patch('despachos.guia_chofer.consultar_osrm',side_effect=camino_prueba):
            respuesta=self.navegador.post(self.ruta,self.datos(),format='json',secure=True)
        self.assertEqual(respuesta.status_code,200,respuesta.data)
        self.assertEqual(self.navegador.get('/api/v1/despachos/',secure=True).status_code,404)


class PruebasConcurrenciaGuia(DatosGuia,TransactionTestCase):
    def setUp(self):
        self.preparar_datos_guia();super().setUp();self.preparar_guia()

    def test_consulta_concurrente_misma_clave_reutiliza_el_calculo_pendiente(self):
        iniciada=Event();terminar=Event();datos=self.datos()
        def proveedor(puntos):
            iniciada.set();terminar.wait(timeout=8)
            return camino_prueba(puntos)
        def ejecutar():
            close_old_connections()
            try:return self.consultar(datos,proveedor=proveedor)
            finally:close_old_connections()
        with ThreadPoolExecutor(max_workers=1) as grupo,patch('despachos.guia_chofer.consultar_osrm',side_effect=proveedor) as motor:
            tarea=grupo.submit(ejecutar)
            try:
                self.assertTrue(iniciada.wait(timeout=5))
                repetida=consultar_guia(self.chofer,self.acceso,self.viaje.pk,datos)
                self.assertEqual(repetida['estado'],'pendiente')
            finally:terminar.set()
            self.assertEqual(tarea.result(timeout=10)['estado'],'lista')
        self.assertEqual(ConsultaGuiaChofer.objects.count(),1)
