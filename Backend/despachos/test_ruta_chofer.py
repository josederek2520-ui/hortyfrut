import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from clientes.models import Sucursal
from inventario.models import MovimientoInventario
from pedidos.models import Pedido
from usuarios.autenticacion_movil import crear_sesion_movil
from usuarios.models import Usuario
from .models import OperacionDespacho, ParadaDespacho
from .servicios import version_despacho
from .test_rutas_carretera import DatosRutas, resultado_prueba


class PruebasRecorridoChofer(DatosRutas, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_rutas()
        permisos = Permission.objects.filter(content_type__app_label='despachos', codename__in=[
            'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios'])
        cls.chofer = Usuario.objects.create_user(email='ruta-propia@chofer.test', cedula_identidad='98701')
        cls.otro = Usuario.objects.create_user(email='ruta-ajena@chofer.test', cedula_identidad='98702')
        cls.chofer.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)

    def cliente_movil(self, usuario=None):
        _, credencial = crear_sesion_movil(usuario or self.chofer, uuid.uuid4(), 'Prueba de recorrido propio')
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {credencial}')
        return cliente

    def enviado(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(despacho, 'enviar')
        return despacho

    def accion(self, cliente, despacho, accion, cuerpo=None, **datos):
        cuerpo = cuerpo or self.datos_ruta(despacho, **datos)
        return cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/{accion}/', cuerpo, format='json', secure=True)

    def calcular_movil(self, cliente, despacho, orden=None):
        orden = orden or list(despacho.paradas.order_by('-orden').values_list('pk', flat=True))
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=resultado_prueba):
            respuesta = self.accion(cliente, despacho, 'calcular-ruta', orden_paradas=orden)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta

    def aprobar_movil(self, cliente, despacho):
        respuesta = self.accion(cliente, despacho, 'aprobar-ruta', plan=despacho.planes_ruta.first().pk)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta

    def test_el_chofer_ordena_confirma_inicia_descarga_y_finaliza_sin_permisos_administrativos(self):
        despacho = self.enviado()
        cliente = self.cliente_movil()
        self.assertFalse(self.chofer.has_perm('despachos.change_despacho'))
        inventario, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        pedidos = dict(Pedido.objects.values_list('pk', 'estado'))
        cargas = list(despacho.cargas.order_by('pk').values_list('pk', 'asignacion_id', 'contenido'))
        orden_original = list(despacho.paradas.values_list('pk', flat=True))
        consulta = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/ruta/', secure=True)
        self.assertTrue(consulta.data['puede_calcular'])
        self.assertTrue(consulta.data['puede_ordenar'])
        self.assertTrue(consulta.data['preparando'])
        self.calcular_movil(cliente, despacho)
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), orden_original)
        cuerpo = self.datos_ruta(despacho, plan=despacho.planes_ruta.get().pk)
        aprobado = self.accion(cliente, despacho, 'aprobar-ruta', cuerpo)
        self.assertEqual(aprobado.status_code, 200, aprobado.data)
        self.assertEqual(aprobado.data['estado'], 'lista')
        self.assertIsNone(aprobado.data['plan']['fijada_en'])
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), orden_original[::-1])
        self.assertEqual(list(despacho.cargas.order_by('pk').values_list('pk', 'asignacion_id', 'contenido')), cargas)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (inventario, cajillas))
        self.assertEqual(self.accion(cliente, despacho, 'aprobar-ruta', cuerpo).status_code, 200)
        self.assertEqual(OperacionDespacho.objects.filter(despacho=despacho, accion='aprobar_ruta').count(), 1)
        self.assertEqual(RegistroActividad.objects.filter(accion='aprobar_ruta', objeto_id=str(despacho.pk), cambios__plan=cuerpo['plan']).count(), 1)
        salida = self.accion(cliente, despacho, 'iniciar')
        self.assertEqual(salida.status_code, 200, salida.data)
        plan = despacho.planes_ruta.get()
        self.assertEqual(plan.aprobada_por_id, self.chofer.pk)
        self.assertIsNotNone(plan.fijada_en)
        self.assertEqual(self.accion(cliente, despacho, 'calcular-ruta').status_code, 400)
        for parada in despacho.paradas.order_by('orden'):
            self.assertEqual(self.accion(cliente, despacho, 'llegar', parada=parada.pk).status_code, 200)
            pedidos_parada = parada.cargas.values_list('asignacion__pedido_id', flat=True).distinct()
            for pedido in pedidos_parada:
                comprobadas = list(parada.cargas.filter(asignacion__pedido_id=pedido).values_list('pk', flat=True))
                descarga = self.accion(cliente, despacho, 'descargar-pedido', parada=parada.pk, pedido=pedido, cargas_comprobadas=comprobadas)
                self.assertEqual(descarga.status_code, 200, descarga.data)
        cierre = self.accion(cliente, despacho, 'finalizar')
        self.assertEqual(cierre.status_code, 200, cierre.data)
        self.assertEqual(cierre.data['estado'], 'finalizado')
        self.assertEqual(MovimientoInventario.objects.count(), inventario)
        self.assertEqual(dict(Pedido.objects.values_list('pk', 'estado')), pedidos)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').count(), 2)

    def test_orden_incompleto_repetido_o_ajeno_se_rechaza_antes_de_consultar_osrm(self):
        despacho = self.enviado()
        cliente = self.cliente_movil()
        orden = list(despacho.paradas.values_list('pk', flat=True))
        with patch('despachos.rutas_carretera.consultar_osrm') as proveedor:
            for propuesta in [orden[:1], [orden[0], orden[0]], [orden[0], 999999]]:
                respuesta = self.accion(cliente, despacho, 'calcular-ruta', orden_paradas=propuesta)
                self.assertEqual(respuesta.status_code, 400, respuesta.data)
            proveedor.assert_not_called()
        self.assertEqual(despacho.planes_ruta.count(), 0)

    def test_otra_cuenta_una_cuenta_de_consulta_y_el_viaje_sin_enviar_no_pueden_planificar(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        cliente = self.cliente_movil()
        self.assertEqual(self.accion(cliente, despacho, 'calcular-ruta').status_code, 404)
        self.operar(despacho, 'enviar')
        self.assertEqual(self.accion(self.cliente_movil(self.otro), despacho, 'calcular-ruta').status_code, 404)
        permiso = Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios')
        self.chofer.user_permissions.remove(permiso)
        self.assertEqual(self.accion(cliente, despacho, 'calcular-ruta').status_code, 403)
        consulta = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/ruta/', secure=True)
        self.assertEqual(consulta.status_code, 200)
        self.assertFalse(consulta.data['puede_ordenar'])

    def test_se_revalida_la_autorizacion_despues_de_la_llamada_al_proveedor(self):
        despacho = self.enviado()
        permiso = Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios')
        def revocar(puntos):
            self.chofer.user_permissions.remove(permiso)
            return resultado_prueba(puntos)
        with patch('despachos.rutas_carretera.consultar_osrm', side_effect=revocar):
            respuesta = self.accion(self.cliente_movil(), despacho, 'calcular-ruta')
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(despacho.planes_ruta.count(), 0)

    def test_confirmacion_y_salida_rechazan_propuestas_obsoletas_sin_mover_cajillas(self):
        despacho = self.enviado()
        cliente = self.cliente_movil()
        self.calcular_movil(cliente, despacho)
        movimientos = MovimientoCajilla.objects.count()
        self.assertEqual(self.accion(cliente, despacho, 'iniciar').status_code, 400)
        self.aprobar_movil(cliente, despacho)
        self.centro.latitud = Decimal('-16.491')
        self.centro.save()
        self.assertEqual(self.accion(cliente, despacho, 'iniciar').status_code, 400)
        self.assertEqual(MovimientoCajilla.objects.count(), movimientos)
        self.assertFalse(despacho.planes_ruta.filter(fijada_en__isnull=False).exists())

    def test_error_de_auditoria_revierte_el_orden_y_la_confirmacion(self):
        despacho = self.enviado()
        cliente = self.cliente_movil()
        self.calcular_movil(cliente, despacho)
        orden = list(despacho.paradas.values_list('pk', flat=True))
        with patch('despachos.rutas_carretera.registrar_actividad', side_effect=RuntimeError('auditoria')):
            with self.assertRaises(RuntimeError):
                self.accion(cliente, despacho, 'aprobar-ruta', plan=despacho.planes_ruta.get().pk)
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), orden)
        self.assertIsNone(despacho.planes_ruta.get().aprobada_en)
        self.assertFalse(OperacionDespacho.objects.filter(despacho=despacho, accion='aprobar_ruta').exists())

    def test_mas_de_diez_paradas_se_ordenan_completas_sin_recrear_la_carga(self):
        despacho = self.enviado()
        for indice in range(3, 14):
            sucursal = Sucursal.objects.create(cliente=self.cliente, nombre=f'Destino {indice}', direccion='Prueba', latitud='-16.45', longitud='-68.10')
            ParadaDespacho.objects.create(despacho=despacho, sucursal=sucursal, orden=indice,
                cliente_nombre='Cliente de prueba', sucursal_nombre=sucursal.nombre, direccion=sucursal.direccion)
        cliente = self.cliente_movil()
        orden = list(despacho.paradas.order_by('-orden').values_list('pk', flat=True))
        respuesta = self.calcular_movil(cliente, despacho, orden)
        self.assertEqual(len(respuesta.data['plan']['puntos']), 15)
        self.aprobar_movil(cliente, despacho)
        self.assertEqual(list(despacho.paradas.values_list('pk', flat=True)), orden)

    def test_los_planes_historicos_fijados_se_conservan_sin_reinterpretar_sus_ubicaciones(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        self.calcular(despacho)
        self.aprobar(despacho)
        plan = despacho.planes_ruta.get()
        plan.fijada_en = timezone.now()
        plan.save(update_fields=['fijada_en'])
        self.operar(despacho, 'enviar')
        self.centro.latitud = Decimal('0')
        self.centro.save()
        cliente = self.cliente_movil()
        respuesta = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/ruta/', secure=True)
        # El color es presentación; las coordenadas y la evidencia histórica no se alteran.
        self.assertEqual([{clave: valor for clave, valor in punto.items() if clave != 'color'}
                          for punto in respuesta.data['plan']['puntos']], plan.puntos)
        anteriores = plan.puntos
        plan.refresh_from_db()
        self.assertEqual(plan.puntos, anteriores)
        self.assertFalse(respuesta.data['puede_calcular'])
        self.assertEqual(self.accion(cliente, despacho, 'calcular-ruta').status_code, 400)
