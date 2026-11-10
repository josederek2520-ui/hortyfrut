from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import MovimientoInventario
from usuarios.models import Usuario
from .models import CalculoOptimizacion, OperacionDespacho, PlanRutaDespacho
from .optimizacion.servicios import solicitar_optimizacion, cancelar_optimizacion, procesar_calculo
from .rutas_carretera import aprobar_ruta, calcular_ruta, consultar_ruta
from .servicios import ConflictoDespacho, version_despacho
from .tareas_optimizacion import ejecutar_optimizacion
from .test_rutas_carretera import DatosRutas


@override_settings(OPTIMIZACION_HABILITADA=True)
class PruebasOptimizacion(DatosRutas, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_rutas()
        cls.chofer = Usuario.objects.create_user(email='genetico@chofer.test', cedula_identidad='98745')
        cls.chofer.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename__in=[
            'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios']))

    def enviado(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(despacho, 'enviar')
        despacho.refresh_from_db()
        return despacho

    def solicitar(self, despacho, cuerpo=None):
        with patch('despachos.optimizacion.servicios.publicar_calculo'), self.captureOnCommitCallbacks(execute=True):
            solicitar_optimizacion(self.chofer, despacho.pk, cuerpo or self.datos_ruta(despacho))
        return despacho.calculos_optimizacion.get()

    def matriz(self, puntos):
        return {'duraciones_s': [['0', '40', '5'], ['5', '0', '40'], ['40', '5', '0']], 'version_datos': 'prueba-1'}

    def trazado(self, puntos):
        duracion = Decimal('15') if puntos[1]['sucursal'] == self.norte.pk else Decimal('120')
        return {'geometria': {'type': 'LineString', 'coordinates': [[float(punto['longitud']), float(punto['latitud'])] for punto in puntos]},
            'distancia_m': Decimal('3000'), 'duracion_s': duracion, 'version_datos': 'prueba-1',
            'tramos': [{'orden': indice, 'distancia_m': '1000', 'duracion_s': str(duracion / 3)} for indice in range(1, len(puntos))]}

    def procesar(self, calculo, matriz=None, trazado=None):
        with patch('despachos.optimizacion.servicios.consultar_matriz_osrm', side_effect=matriz or self.matriz), \
             patch('despachos.optimizacion.servicios.consultar_osrm', side_effect=trazado or self.trazado):
            procesar_calculo(calculo.pk)
        calculo.refresh_from_db()

    def test_solicitar_es_idempotente_y_no_cambia_orden_carga_o_movimientos(self):
        despacho = self.enviado()
        orden = list(despacho.paradas.values_list('pk', flat=True))
        inventario = (MovimientoCajilla.objects.count(), MovimientoInventario.objects.count())
        cuerpo = self.datos_ruta(despacho)
        calculo = self.solicitar(despacho, cuerpo)
        solicitar_optimizacion(self.chofer, despacho.pk, cuerpo)
        self.assertEqual(CalculoOptimizacion.objects.count(), 1)
        self.assertEqual(calculo.estado, 'pendiente')
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), orden)
        self.assertEqual(inventario, (MovimientoCajilla.objects.count(), MovimientoInventario.objects.count()))
        datos = consultar_ruta(self.chofer, despacho.pk, como_chofer=True)
        self.assertEqual(datos['estado'], 'sin_calcular')
        self.assertEqual(datos['optimizacion']['estado'], 'pendiente')
        self.assertFalse(datos['puede_ordenar'])
        with self.assertRaises(ConflictoDespacho):
            solicitar_optimizacion(self.chofer, despacho.pk, {**cuerpo, 'semilla': 99})

    def test_propuesta_se_guarda_y_solo_aprobar_reordena_las_paradas_existentes(self):
        despacho = self.enviado()
        orden = list(despacho.paradas.values_list('pk', flat=True))
        cargas = list(despacho.cargas.values_list('pk', 'asignacion_id', 'contenido'))
        calculo = self.solicitar(despacho)
        self.procesar(calculo)
        self.assertEqual(calculo.estado, 'lista')
        self.assertEqual(Decimal(calculo.resultado['mejora_s']), 105)
        self.assertEqual(Decimal(calculo.resultado['costo_s']), 15)
        self.assertEqual(calculo.matriz['version_datos'], 'prueba-1')
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), orden)
        datos = consultar_ruta(self.chofer, despacho.pk, como_chofer=True)
        self.assertEqual(datos['estado'], 'pendiente_aprobacion')
        self.assertEqual(Decimal(datos['plan']['optimizacion']['mejora_porcentaje']), Decimal('87.5'))
        aprobar_ruta(self.chofer, despacho.pk, self.datos_ruta(despacho, plan=calculo.plan_id), como_chofer=True)
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), list(reversed(orden)))
        self.assertEqual(list(despacho.cargas.values_list('pk', 'asignacion_id', 'contenido')), cargas)
        self.assertTrue(RegistroActividad.objects.filter(accion='completar_optimizacion').exists())

    def test_reintento_del_trabajador_no_duplica_planes(self):
        calculo = self.solicitar(self.enviado())
        self.procesar(calculo)
        with patch('despachos.optimizacion.servicios.consultar_matriz_osrm') as consultar:
            procesar_calculo(calculo.pk)
        consultar.assert_not_called()
        self.assertEqual(PlanRutaDespacho.objects.count(), 1)

    def test_cancelar_es_idempotente_y_un_trabajador_tardio_no_adopta_su_resultado(self):
        despacho = self.enviado()
        calculo = self.solicitar(despacho)
        def cancelar_y_devolver(puntos):
            cuerpo = self.datos_ruta(despacho, calculo=calculo.pk)
            cancelar_optimizacion(self.chofer, despacho.pk, cuerpo)
            cancelar_optimizacion(self.chofer, despacho.pk, cuerpo)
            return self.matriz(puntos)
        self.procesar(calculo, matriz=cancelar_y_devolver)
        self.assertEqual(calculo.estado, 'cancelada')
        self.assertFalse(PlanRutaDespacho.objects.exists())
        self.assertTrue(consultar_ruta(self.chofer, despacho.pk, como_chofer=True)['puede_optimizar'])

    def test_cambio_de_ubicaciones_invalida_sin_adoptar_plan(self):
        calculo = self.solicitar(self.enviado())
        def modificar_y_devolver(puntos):
            self.centro.latitud = Decimal('-16.51')
            self.centro.save(update_fields=['latitud'])
            return self.matriz(puntos)
        self.procesar(calculo, matriz=modificar_y_devolver)
        self.assertEqual(calculo.estado, 'obsoleta')
        self.assertFalse(PlanRutaDespacho.objects.exists())

    def test_cancelacion_de_despacho_invalida_el_trabajo_pendiente(self):
        despacho = self.enviado()
        calculo = self.solicitar(despacho)
        self.operar(despacho, 'cancelar')
        self.procesar(calculo)
        self.assertEqual(calculo.estado, 'obsoleta')
        self.assertFalse(PlanRutaDespacho.objects.exists())

    def test_permiso_revocado_antes_o_durante_el_trabajo_no_adopta_plan(self):
        calculo = self.solicitar(self.enviado())
        permiso = Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios')
        def revocar_y_devolver(puntos):
            self.chofer.user_permissions.remove(permiso)
            return self.matriz(puntos)
        with patch('despachos.optimizacion.servicios.consultar_matriz_osrm', side_effect=revocar_y_devolver), \
             patch('despachos.optimizacion.servicios.consultar_osrm', side_effect=self.trazado):
            ejecutar_optimizacion.run(calculo.pk)
        calculo.refresh_from_db()
        self.assertEqual(calculo.estado, 'obsoleta')
        self.assertFalse(PlanRutaDespacho.objects.exists())

    def test_vencimiento_no_bloquea_y_permite_solicitud_nueva(self):
        despacho = self.enviado()
        calculo = self.solicitar(despacho)
        CalculoOptimizacion.objects.filter(pk=calculo.pk).update(vence_en=timezone.now() - timedelta(seconds=1))
        datos = consultar_ruta(self.chofer, despacho.pk, como_chofer=True)
        self.assertEqual(datos['optimizacion']['estado'], 'error')
        self.assertTrue(datos['puede_optimizar'])
        with patch('despachos.optimizacion.servicios.publicar_calculo'):
            solicitar_optimizacion(self.chofer, despacho.pk, self.datos_ruta(despacho))
        calculo.refresh_from_db()
        self.assertEqual(calculo.estado, 'error')
        self.assertEqual(despacho.calculos_optimizacion.count(), 2)

    def test_no_se_puede_iniciar_o_recalcular_mientras_hay_un_trabajo_activo(self):
        despacho = self.enviado()
        self.solicitar(despacho)
        movimientos = MovimientoCajilla.objects.count()
        with self.assertRaises(ValidationError):
            self.operar(despacho, 'iniciar')
        with self.assertRaises(ValidationError):
            calcular_ruta(self.chofer, despacho.pk, self.datos_ruta(despacho), como_chofer=True)
        self.assertEqual(MovimientoCajilla.objects.count(), movimientos)
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'borrador')

    def test_no_se_anuncia_mejora_si_el_trazado_final_no_es_mejor(self):
        calculo = self.solicitar(self.enviado())
        def mismo_tiempo(puntos):
            resultado = self.trazado(puntos)
            resultado['duracion_s'] = Decimal('120')
            return resultado
        self.procesar(calculo, trazado=mismo_tiempo)
        self.assertEqual(calculo.resultado['metodo_elegido'], 'orden_actual')
        self.assertEqual(Decimal(calculo.resultado['mejora_s']), 0)
        self.assertEqual(calculo.plan.puntos, calculo.puntos)

    def test_error_osrm_es_explicito_y_no_genera_ruta_ficticia(self):
        calculo = self.solicitar(self.enviado())
        with patch('despachos.optimizacion.servicios.consultar_matriz_osrm', side_effect=ValidationError({'ruta': 'No hay conexión.'})):
            ejecutar_optimizacion.run(calculo.pk)
        calculo.refresh_from_db()
        self.assertEqual(calculo.estado, 'error')
        self.assertFalse(PlanRutaDespacho.objects.exists())

    def test_fallo_de_auditoria_revierte_la_solicitud_completa(self):
        despacho = self.enviado()
        antes = version_despacho(despacho)
        operaciones = OperacionDespacho.objects.count()
        with patch('despachos.optimizacion.servicios.registrar_actividad', side_effect=RuntimeError('Sin auditoría')):
            with self.assertRaises(RuntimeError):
                self.solicitar(despacho)
        self.assertFalse(CalculoOptimizacion.objects.exists())
        self.assertEqual(OperacionDespacho.objects.count(), operaciones)
        despacho.refresh_from_db()
        self.assertEqual(version_despacho(despacho), antes)

    def test_http_filtra_viajes_ajenos_y_no_expone_matrices_o_historial_al_celular(self):
        despacho = self.enviado()
        cliente = APIClient()
        cliente.force_authenticate(self.chofer)
        cuerpo = self.datos_ruta(despacho)
        with patch('despachos.optimizacion.servicios.publicar_calculo'):
            respuesta = cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/optimizar-ruta/', cuerpo, format='json')
        self.assertEqual(respuesta.status_code, 202, respuesta.data)
        self.assertNotIn('matriz', respuesta.data['optimizacion'])
        self.assertNotIn('resultado', respuesta.data['optimizacion'])
        despacho.chofer = self.actor
        despacho.save(update_fields=['chofer'])
        self.assertEqual(cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/optimizar-ruta/', cuerpo, format='json').status_code, 404)

    def test_datos_no_validos_no_crean_solicitud(self):
        despacho = self.enviado()
        for cambios in ({'orden_paradas': [1, 1]}, {'semilla': -1}, {'parametros': {'generaciones': 999999}}):
            with self.subTest(cambios=cambios), self.assertRaises(ValidationError):
                self.solicitar(despacho, self.datos_ruta(despacho, **cambios))
        self.assertFalse(CalculoOptimizacion.objects.exists())
