import uuid
from datetime import timedelta
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.contrib.auth.models import Permission
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import PermissionDenied, ValidationError
from preparaciones.tests import DatosPreparaciones
from preparaciones.servicios import guardar_preparacion, confirmar_preparacion
from preparaciones.consultas import version_preparacion
from cajillas.models import MovimientoCajilla
from cajillas.consultas import cajillas_con_saldos, pendiente_sucursal, saldo_almacen
from cajillas.servicios import registrar_movimiento
from cajillas.consultas import version_cajilla
from inventario.models import MovimientoInventario
from auditoria.models import RegistroActividad
from vehiculos.servicios import guardar_vehiculo, cambiar_estado_vehiculo, version_vehiculo
from .models import Despacho, CargaDespacho, OperacionDespacho
from .servicios import guardar_despacho, ejecutar_accion, version_despacho, ConflictoDespacho


class DatosDespachos(DatosPreparaciones):
    @classmethod
    def preparar_datos_despachos(cls):
        cls.preparar_datos()
        cls.vehiculo = guardar_vehiculo(cls.actor, {'placa': '1234-ABC', 'tipo': 'Camión', 'capacidad_kg': '1000'})
        cls.preparacion = guardar_preparacion(cls.actor, {
            'cliente': cls.cliente.pk, 'fecha_pedidos': str(cls.hoy), 'almacen': cls.almacen.pk, 'clave_operacion': str(uuid.uuid4()),
            'lineas': [{'lote': cls.lote.pk, 'cantidad_utilizada': '50'}],
            'asignaciones': [{'detalle_pedido': cls.centro_cajas.pk, 'cantidad': 2, 'aportes': [{'lote': cls.lote.pk, 'cantidad': '20'}]},
                            {'detalle_pedido': cls.norte_cajas.pk, 'cantidad': 3, 'aportes': [{'lote': cls.lote.pk, 'cantidad': '30'}]}],
            'cajillas': [{'sucursal': cls.centro.pk, 'cajilla': cls.cajilla.pk, 'cantidad': 2}]})[0]
        confirmar_preparacion(cls.actor, cls.preparacion, {'version': version_preparacion(cls.preparacion), 'clave_operacion': str(uuid.uuid4())})
        cls.asignaciones = list(cls.preparacion.asignaciones.order_by('sucursal_id'))

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def datos_despacho(self, **cambios):
        return {'almacen': self.almacen.pk, 'vehiculo': self.vehiculo.pk, 'chofer': self.actor.pk, 'fecha_reparto': str(self.hoy),
                'asignaciones': [fila.pk for fila in self.asignaciones], 'orden_sucursales': [self.centro.pk, self.norte.pk],
                'cajillas': [{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 2},
                            {'sucursal': self.norte.pk, 'cajilla': self.cajilla.pk, 'cantidad': 3}],
                'clave_operacion': str(uuid.uuid4()), **cambios}

    def crear_despacho(self, **cambios):
        return guardar_despacho(self.actor, self.datos_despacho(**cambios))[0]

    def operar(self, despacho, accion, **cambios):
        despacho.refresh_from_db()
        return ejecutar_accion(self.actor, despacho, accion, {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4()), **cambios})


class PruebasDespachos(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()

    def test_disponibles_incluye_preparacion_parcial_y_no_exige_administrar_catalogos(self):
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
        self.client.force_authenticate(self.lector)
        respuesta = self.client.get('/api/v1/despachos/disponibles/', {'almacen': self.almacen.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 2)
        self.assertEqual(respuesta.data['results'][0]['aportes'][0]['codigo_lote'], self.lote.codigo)
        self.assertEqual(self.client.get('/api/v1/despachos/vehiculos/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/despachos/choferes/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/vehiculos/').status_code, 403)

    def test_borrador_no_mueve_productos_ni_cajillas_y_no_duplica_carga(self):
        productos = MovimientoInventario.objects.count()
        cajillas = MovimientoCajilla.objects.count()
        despacho = self.crear_despacho()
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (productos, cajillas))
        self.assertEqual(despacho.cargas.count(), 2)
        with self.assertRaises(ConflictoDespacho):
            self.crear_despacho()
        self.assertEqual(Despacho.objects.count(), 1)

    def test_guardar_reintento_y_clave_con_otros_datos(self):
        datos = self.datos_despacho()
        primero, creado = guardar_despacho(self.actor, datos)
        segundo, creado_otra_vez = guardar_despacho(self.actor, datos)
        self.assertTrue(creado)
        self.assertFalse(creado_otra_vez)
        self.assertEqual(primero.pk, segundo.pk)
        with self.assertRaises(ConflictoDespacho):
            guardar_despacho(self.actor, {**datos, 'observaciones': 'Otro contenido'})

    def test_preparaciones_muestra_saldo_disponible_sin_cajillas_en_transito(self):
        despacho = self.crear_despacho()
        self.operar(despacho, 'iniciar')
        respuesta = self.client.get('/api/v1/preparaciones/colores/', {'almacen': self.almacen.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['results'][0]['saldo'], 95)
        borrador = self.crear(cajillas=[{'sucursal': self.centro.pk, 'producto': self.producto.pk, 'cajilla': self.cajilla.pk, 'cantidad': 2}])
        detalle = self.client.get(f'/api/v1/preparaciones/{borrador.pk}/')
        self.assertEqual(detalle.status_code, 200, detalle.data)
        self.assertEqual(detalle.data['cajillas'][0]['saldo_almacen'], 95)
        self.assertEqual(detalle.data['lineas'][0]['saldo_lote'], '150.000')

    def test_editar_borrador_conserva_version_y_reordena_paradas(self):
        despacho = self.crear_despacho()
        version = version_despacho(despacho)
        datos = self.datos_despacho(version=version, orden_sucursales=[self.norte.pk, self.centro.pk])
        actualizado, _ = guardar_despacho(self.actor, datos, despacho)
        self.assertEqual(list(actualizado.paradas.values_list('sucursal_id', flat=True)), [self.norte.pk, self.centro.pk])
        with self.assertRaises(ConflictoDespacho):
            guardar_despacho(self.actor, datos, despacho)

    def test_cancelar_libera_carga_y_conserva_historial_sin_movimientos(self):
        despacho = self.crear_despacho()
        self.operar(despacho, 'cancelar')
        self.assertFalse(CargaDespacho.objects.filter(despacho=despacho, activa=True).exists())
        self.assertEqual(despacho.cargas.count(), 2)
        self.crear_despacho()
        self.assertEqual(MovimientoCajilla.objects.count(), 1)
        self.assertTrue(RegistroActividad.objects.filter(modulo='despachos', accion='cancelar_despacho').exists())

    def test_iniciar_y_descargar_conservan_total_y_separan_transito_de_pendiente(self):
        despacho = self.crear_despacho()
        productos = MovimientoInventario.objects.count()
        self.operar(despacho, 'iniciar')
        saldo = cajillas_con_saldos().get(pk=self.cajilla.pk)
        self.assertEqual((saldo.en_almacen, saldo.en_transito, saldo.en_sucursales, saldo.total), (95, 5, 0, 100))
        self.assertEqual(pendiente_sucursal(self.cajilla.pk, self.centro.pk), 0)
        parada = despacho.paradas.get(sucursal=self.centro)
        self.operar(despacho, 'llegar', parada=parada.pk)
        self.operar(despacho, 'descargar', parada=parada.pk)
        saldo = cajillas_con_saldos().get(pk=self.cajilla.pk)
        self.assertEqual((saldo.en_almacen, saldo.en_transito, saldo.en_sucursales, saldo.total), (95, 3, 2, 100))
        self.assertEqual(MovimientoInventario.objects.count(), productos)
        self.assertEqual(pendiente_sucursal(self.cajilla.pk, self.centro.pk), 2)

    def test_reintento_acciones_no_duplica_movimientos_y_rechaza_otra_cuenta(self):
        despacho = self.crear_despacho()
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}
        ejecutar_accion(self.actor, despacho, 'iniciar', datos)
        ejecutar_accion(self.actor, despacho, 'iniciar', datos)
        self.assertEqual(MovimientoCajilla.objects.filter(tipo='carga').count(), 1)
        self.assertEqual(OperacionDespacho.objects.count(), 1)
        with self.assertRaises(ConflictoDespacho):
            ejecutar_accion(self.actor, despacho, 'cancelar', datos)

    def test_reintento_descarga_no_duplica_pendientes_y_protege_cuenta(self):
        from usuarios.models import Usuario
        despacho = self.crear_despacho()
        self.operar(despacho, 'iniciar')
        parada = despacho.paradas.get(sucursal=self.centro)
        self.operar(despacho, 'llegar', parada=parada.pk)
        despacho.refresh_from_db()
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4()), 'parada': parada.pk}
        ejecutar_accion(self.actor, despacho, 'descargar', datos)
        ejecutar_accion(self.actor, despacho, 'descargar', datos)
        self.assertEqual(pendiente_sucursal(self.cajilla.pk, self.centro.pk), 2)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').count(), 1)
        otro = Usuario.objects.create_superuser(email='reintento@despachos.test', cedula_identidad='98098')
        with self.assertRaises(ConflictoDespacho):
            ejecutar_accion(otro, despacho, 'descargar', datos)

    def test_chofer_y_destino_se_revalidan_antes_de_salir(self):
        despacho = self.crear_despacho()
        self.centro.activo = False
        self.centro.save(update_fields=['activo'])
        with self.assertRaises(ValidationError):
            self.operar(despacho, 'iniciar')
        self.centro.activo = True
        self.centro.save(update_fields=['activo'])
        self.vehiculo.activo = False
        self.vehiculo.save(update_fields=['activo'])
        with self.assertRaises(ValidationError):
            self.operar(despacho, 'iniciar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'borrador')
        self.assertFalse(MovimientoCajilla.objects.filter(despacho=despacho).exists())

    def test_impide_iniciar_con_cajillas_insuficientes_y_revierte_todo(self):
        despacho = self.crear_despacho(cajillas=[{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 101}])
        with self.assertRaises(ValidationError):
            self.operar(despacho, 'iniciar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'borrador')
        self.assertEqual(MovimientoCajilla.objects.count(), 1)

    def test_no_descargar_sin_llegada_ni_fuera_de_orden_ni_finalizar_pendientes(self):
        despacho = self.crear_despacho()
        self.operar(despacho, 'iniciar')
        centro = despacho.paradas.get(sucursal=self.centro)
        norte = despacho.paradas.get(sucursal=self.norte)
        for accion, datos in [('descargar', {'parada': centro.pk}), ('llegar', {'parada': norte.pk}), ('finalizar', {})]:
            with self.assertRaises(ValidationError):
                self.operar(despacho, accion, **datos)

    def test_finalizar_no_exige_entregas_y_devuelve_cajillas_por_servicio_existente(self):
        despacho = self.crear_despacho()
        productos = MovimientoInventario.objects.count()
        self.operar(despacho, 'iniciar')
        for parada in despacho.paradas.all():
            self.operar(despacho, 'llegar', parada=parada.pk)
            self.operar(despacho, 'descargar', parada=parada.pk)
        self.operar(despacho, 'finalizar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'finalizado')
        self.assertIsNotNone(despacho.retorno_en)
        self.assertEqual(cajillas_con_saldos().get(pk=self.cajilla.pk).en_transito, 0)
        registrar_movimiento(self.actor, self.cajilla.pk, {'tipo': 'devolucion', 'cantidad': 2, 'almacen': self.almacen.pk,
            'sucursal': self.centro.pk, 'version': version_cajilla(self.cajilla), 'clave_operacion': str(uuid.uuid4())})
        self.assertEqual(saldo_almacen(self.cajilla.pk, self.almacen.pk), 97)
        self.assertEqual(MovimientoInventario.objects.count(), productos)

    def test_permisos_crear_editar_iniciar_independientes_y_fuera_http(self):
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename__in=['view_despacho', 'add_despacho']))
        self.lector.refresh_from_db()
        despacho, _ = guardar_despacho(self.lector, self.datos_despacho())
        with self.assertRaises(PermissionDenied):
            guardar_despacho(self.lector, self.datos_despacho(version=version_despacho(despacho)), despacho)
        with self.assertRaises(PermissionDenied):
            ejecutar_accion(self.lector, despacho, 'iniciar', {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())})

    def test_destinos_ajenos_y_chofer_sin_autorizacion_se_rechazan(self):
        for cambios in [{'orden_sucursales': [self.centro.pk]}, {'chofer': self.lector.pk}, {'asignaciones': [self.asignaciones[0].pk] * 2}]:
            with self.assertRaises(ValidationError):
                self.crear_despacho(**cambios)

    def test_auditoria_fallida_revierte_carga_y_operacion(self):
        despacho = self.crear_despacho()
        registros = RegistroActividad.objects.count()
        with patch('despachos.servicios.registrar_actividad', side_effect=RuntimeError('fallo de auditoría')):
            with self.assertRaises(RuntimeError):
                self.operar(despacho, 'iniciar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'borrador')
        self.assertEqual(MovimientoCajilla.objects.count(), 1)
        self.assertEqual(RegistroActividad.objects.count(), registros)

    def test_no_editar_cancelar_ni_desactivar_vehiculo_en_ruta(self):
        despacho = self.crear_despacho()
        self.operar(despacho, 'iniciar')
        despacho.refresh_from_db()
        with self.assertRaises(ValidationError):
            guardar_despacho(self.actor, self.datos_despacho(version=version_despacho(despacho)), despacho)
        with self.assertRaises(ValidationError):
            self.operar(despacho, 'cancelar')
        with self.assertRaises(ValidationError):
            cambiar_estado_vehiculo(self.actor, self.vehiculo, {'version': version_vehiculo(self.vehiculo), 'activo': False})

    def test_api_detalle_y_filtros_validan_sin_modificar_stock(self):
        respuesta = self.client.post('/api/v1/despachos/', self.datos_despacho(), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['resumen']['cajas'], 5)
        self.assertEqual(len(respuesta.data['paradas']), 2)
        self.assertEqual(self.client.get('/api/v1/despachos/disponibles/', {'almacen': self.almacen.pk}).data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/despachos/', {'fecha': 'no-es-fecha'}).status_code, 400)

    def test_api_paginacion_diez_y_borrador_vacio_no_inicia(self):
        for _ in range(12):
            self.crear_despacho(asignaciones=[], orden_sucursales=[], cajillas=[])
        respuesta = self.client.get('/api/v1/despachos/', {'page_size': 200})
        self.assertEqual(respuesta.data['count'], 12)
        self.assertEqual(len(respuesta.data['results']), 10)
        with self.assertRaises(ValidationError):
            self.operar(Despacho.objects.first(), 'iniciar')

    def test_listado_agrupa_antes_de_paginar_y_prioriza_rutas_de_cualquier_fecha(self):
        viaje = self.crear_despacho(fecha_reparto=str(self.hoy - timedelta(days=1)))
        self.operar(viaje, 'iniciar')
        for _ in range(11):
            self.crear_despacho(asignaciones=[], orden_sucursales=[], cajillas=[])
        cancelado = self.crear_despacho(asignaciones=[], orden_sucursales=[], cajillas=[])
        self.operar(cancelado, 'cancelar')
        movimientos = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
        activos = self.client.get('/api/v1/despachos/', {'vista': 'activos', 'page_size': 200})
        self.assertEqual(activos.status_code, 200, activos.data)
        self.assertEqual((activos.data['count'], len(activos.data['results'])), (12, 10))
        self.assertEqual(activos.data['results'][0]['id'], viaje.pk)
        segunda = self.client.get('/api/v1/despachos/', {'vista': 'activos', 'pagina': 2})
        self.assertEqual(len(segunda.data['results']), 2)
        self.assertFalse({fila['id'] for fila in activos.data['results']} & {fila['id'] for fila in segunda.data['results']})
        historial = self.client.get('/api/v1/despachos/', {'vista': 'historial'})
        self.assertEqual(historial.data['count'], 1)
        self.assertEqual(historial.data['results'][0]['id'], cancelado.pk)
        self.assertEqual(self.client.get('/api/v1/despachos/', {'vista': 'activos', 'fecha': str(self.hoy)}).data['count'], 11)
        self.assertEqual(self.client.get('/api/v1/despachos/', {'vista': 'activos', 'estado': 'cancelado'}).data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/despachos/').data['count'], 13)
        self.assertEqual(self.client.get('/api/v1/despachos/', {'vista': 'invalida'}).status_code, 400)
        self.assertEqual(movimientos, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()))

    def test_resumen_informa_carga_disponible_con_permiso_de_lectura(self):
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
        self.client.force_authenticate(self.lector)
        resumen = self.client.get('/api/v1/despachos/resumen/')
        self.assertEqual(resumen.status_code, 200)
        self.assertTrue(resumen.data['hay_carga_disponible'])
        viaje = self.crear_despacho()
        movimientos = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
        resumen = self.client.get('/api/v1/despachos/resumen/')
        self.assertEqual(resumen.data['total'], 1)
        self.assertEqual(resumen.data['borrador'], 1)
        self.assertFalse(resumen.data['hay_carga_disponible'])
        self.assertEqual(movimientos, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()))
        self.operar(viaje, 'cancelar')
        self.assertTrue(self.client.get('/api/v1/despachos/resumen/').data['hay_carga_disponible'])

    def test_siguiente_destino_sigue_el_orden_y_el_avance_fisico(self):
        viaje = self.crear_despacho()
        paradas = list(viaje.paradas.all())
        primero = self.client.get('/api/v1/despachos/', {'vista': 'activos'}).data['results'][0]
        self.assertEqual(primero['siguiente_destino'], {'cliente_nombre': paradas[0].cliente_nombre, 'sucursal_nombre': paradas[0].sucursal_nombre, 'orden': 1})
        self.operar(viaje, 'iniciar')
        self.operar(viaje, 'llegar', parada=paradas[0].pk)
        self.operar(viaje, 'descargar', parada=paradas[0].pk)
        siguiente = self.client.get('/api/v1/despachos/', {'vista': 'activos'}).data['results'][0]
        self.assertEqual(siguiente['resumen']['completadas'], 1)
        self.assertEqual(siguiente['siguiente_destino']['orden'], 2)
        self.operar(viaje, 'llegar', parada=paradas[1].pk)
        self.operar(viaje, 'descargar', parada=paradas[1].pk)
        self.operar(viaje, 'finalizar')
        cerrado = self.client.get('/api/v1/despachos/', {'vista': 'historial'}).data['results'][0]
        self.assertEqual(cerrado['resumen']['completadas'], 2)
        self.assertIsNone(cerrado['siguiente_destino'])


class PruebasConcurrenciaDespachos(DatosDespachos, TransactionTestCase):
    def setUp(self):
        self.preparar_datos_despachos()
        super().setUp()

    def ejecutar_paralelo(self, primera, segunda):
        barrera = Barrier(2)

        def ejecutar(tarea):
            close_old_connections()
            try:
                barrera.wait(timeout=10)
                tarea()
                return 'exito'
            except (ConflictoDespacho, ValidationError) as error:
                return error.status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            trabajos = [ejecutor.submit(ejecutar, tarea) for tarea in (primera, segunda)]
            return [trabajo.result(timeout=20) for trabajo in trabajos]

    def test_dos_operadores_no_asignan_la_misma_preparacion(self):
        from usuarios.models import Usuario
        otro = Usuario.objects.create_superuser(email='otro@despachos.test', cedula_identidad='98099')
        datos = self.datos_despacho()
        def crear(actor_id):
            guardar_despacho(Usuario.objects.get(pk=actor_id), {**datos, 'clave_operacion': str(uuid.uuid4())})
        resultados = self.ejecutar_paralelo(lambda: crear(self.actor.pk), lambda: crear(otro.pk))
        self.assertCountEqual(resultados, ['exito', 409])
        self.assertEqual(Despacho.objects.count(), 1)
        self.assertEqual(CargaDespacho.objects.filter(activa=True).count(), 2)

    def test_dos_salidas_no_ocupan_el_mismo_vehiculo_y_chofer(self):
        primero = self.crear_despacho(asignaciones=[self.asignaciones[0].pk], orden_sucursales=[self.centro.pk], cajillas=[])
        segundo = self.crear_despacho(asignaciones=[self.asignaciones[1].pk], orden_sucursales=[self.norte.pk], cajillas=[])
        resultados = self.ejecutar_paralelo(lambda: self.operar(primero, 'iniciar'), lambda: self.operar(segundo, 'iniciar'))
        self.assertCountEqual(resultados, ['exito', 409])
        self.assertEqual(Despacho.objects.filter(estado='en_ruta').count(), 1)

    def test_despacho_y_salida_manual_no_consumen_las_mismas_cajillas(self):
        despacho = self.crear_despacho(cajillas=[{'sucursal': self.centro.pk, 'cajilla': self.cajilla.pk, 'cantidad': 20}])
        datos = {'tipo': 'salida', 'cantidad': 90, 'almacen': self.almacen.pk, 'sucursal': self.centro.pk,
                 'version': version_cajilla(self.cajilla), 'clave_operacion': str(uuid.uuid4())}
        def manual():
            from cajillas.servicios import ConflictoCajillas
            try:
                registrar_movimiento(self.actor, self.cajilla.pk, datos)
            except ConflictoCajillas as error:
                raise ConflictoDespacho() from error
        resultados = self.ejecutar_paralelo(lambda: self.operar(despacho, 'iniciar'), manual)
        self.assertEqual(resultados.count('exito'), 1)
        self.assertIn(saldo_almacen(self.cajilla.pk, self.almacen.pk), (10, 80))
        saldo = cajillas_con_saldos().get(pk=self.cajilla.pk)
        self.assertEqual(saldo.en_almacen + saldo.en_transito + saldo.en_sucursales, saldo.total)
