import uuid
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import Http404
from django.test import TestCase, TransactionTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from cajillas.consultas import pendiente_sucursal
from inventario.models import MovimientoInventario
from pedidos.models import Pedido
from preparaciones.servicios import guardar_preparacion, confirmar_preparacion
from preparaciones.consultas import version_preparacion
from usuarios.models import Usuario
from usuarios.autenticacion_movil import crear_sesion_movil
from .models import CargaDespacho, OperacionDespacho
from .servicios import ejecutar_accion, version_despacho, ConflictoDespacho
from .tests import DatosDespachos
from . import tests as pruebas_existentes


class DatosDescargaPedidos(DatosDespachos):
    @classmethod
    def preparar_descargas(cls):
        cls.preparar_datos_despachos()
        cls.segundo_pedido = cls.crear_pedido(cls.centro)
        cls.segundo_detalle = cls.crear_detalle(cls.segundo_pedido, cls.cajas, 1)
        preparacion = guardar_preparacion(cls.actor, {
            'cliente': cls.cliente.pk, 'fecha_pedidos': str(cls.hoy), 'almacen': cls.almacen.pk, 'clave_operacion': str(uuid.uuid4()),
            'lineas': [{'lote': cls.lote.pk, 'cantidad_utilizada': '14'}],
            'asignaciones': [{'detalle_pedido': cls.centro_uni.pk, 'cantidad': 4, 'aportes': [{'lote': cls.lote.pk, 'cantidad': '4'}]},
                            {'detalle_pedido': cls.segundo_detalle.pk, 'cantidad': 1, 'aportes': [{'lote': cls.lote.pk, 'cantidad': '10'}]}], 'cajillas': []})[0]
        confirmar_preparacion(cls.actor, preparacion, {'version': version_preparacion(preparacion), 'clave_operacion': str(uuid.uuid4())})
        cls.asignaciones += list(preparacion.asignaciones.all())
        cls.chofer = Usuario.objects.create_user(email='descargas@chofer.test', cedula_identidad='98701')
        cls.chofer.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos',
            codename__in=['conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios']))

    def iniciar_descarga(self, llegada=True):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(despacho, 'enviar')
        self.operar(despacho, 'iniciar')
        parada = despacho.paradas.get(sucursal=self.centro)
        if llegada:
            self.operar(despacho, 'llegar', parada=parada.pk)
        return despacho, parada

    def datos_descarga(self, despacho, pedido, parada=None, **cambios):
        despacho.refresh_from_db()
        parada = parada or despacho.paradas.get(sucursal=pedido.sucursal_id)
        return {'parada': parada.pk, 'pedido': pedido.pk, 'version': version_despacho(despacho),
                'clave_operacion': str(uuid.uuid4()),
                'cargas_comprobadas': list(despacho.cargas.filter(parada=parada, contenido__pedido=pedido.pk).values_list('pk', flat=True)), **cambios}

    def confirmar_pedido(self, despacho, pedido, **cambios):
        return ejecutar_accion(self.chofer, despacho, 'descargar_pedido', self.datos_descarga(despacho, pedido, **cambios), como_chofer=True)

    def cliente_chofer(self, usuario=None):
        _, credencial = crear_sesion_movil(usuario or self.chofer, uuid.uuid4(), 'Android de pruebas')
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {credencial}')
        return cliente


class PruebasDescargaPedidos(DatosDescargaPedidos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()

    def test_agrupa_tandas_cant_y_uni_del_pedido_sin_crear_otras_paradas(self):
        despacho, parada = self.iniciar_descarga()
        cliente = self.cliente_chofer()
        respuesta = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/pedidos/?parada={parada.pk}', secure=True)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 2)
        pedido = next(fila for fila in respuesta.data['results'] if fila['pedido'] == self.pedido_centro.pk)
        self.assertEqual((pedido['cajas'], pedido['unidades'], pedido['productos'], pedido['asignaciones']), (2, 4, 1, 2))
        self.assertEqual(pedido['peso_kg'], '24.000')
        self.assertEqual(despacho.paradas.filter(sucursal=self.centro).count(), 1)
        productos = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/productos-pedido/?parada={parada.pk}&pedido={self.pedido_centro.pk}', secure=True)
        self.assertEqual(productos.data['count'], 2)
        self.assertEqual({fila['preparacion'] for fila in productos.data['results']}, {fila.preparacion_id for fila in self.asignaciones if fila.pedido_id == self.pedido_centro.pk})
        self.assertTrue(all(fila['aportes'][0]['codigo_lote'] == self.lote.codigo for fila in productos.data['results']))

    def test_primer_pedido_conserva_parada_pendiente_y_no_entrega_cajillas(self):
        despacho, parada = self.iniciar_descarga()
        productos = MovimientoInventario.objects.count()
        estado_pedido = Pedido.objects.get(pk=self.pedido_centro.pk).estado
        self.confirmar_pedido(despacho, self.pedido_centro)
        parada.refresh_from_db()
        self.assertIsNone(parada.descargada_en)
        self.assertEqual(parada.cargas.filter(descargada_en__isnull=False).count(), 2)
        self.assertTrue(all(fila.responsable_descarga_id == self.chofer.pk for fila in parada.cargas.filter(descargada_en__isnull=False)))
        self.assertFalse(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').exists())
        self.assertEqual(MovimientoInventario.objects.count(), productos)
        self.assertEqual(Pedido.objects.get(pk=self.pedido_centro.pk).estado, estado_pedido)
        detalle = self.client.get(f'/api/v1/despachos/{despacho.pk}/').data
        centro = next(fila for fila in detalle['paradas'] if fila['id'] == parada.pk)
        self.assertEqual((centro['pedidos'], centro['pedidos_descargados']), (2, 1))
        self.assertEqual(detalle['siguiente_destino']['sucursal_nombre'], self.centro.nombre)
        self.assertEqual(detalle['resumen']['pedidos_descargados'], 1)

    def test_ultimo_pedido_entrega_cajillas_una_vez_y_permite_continuar(self):
        despacho, parada = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.segundo_pedido)
        self.confirmar_pedido(despacho, self.pedido_centro)
        parada.refresh_from_db()
        self.assertIsNotNone(parada.descargada_en)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').count(), 1)
        self.assertEqual(pendiente_sucursal(self.cajilla.pk, self.centro.pk), 2)
        with self.assertRaises(ValidationError):
            self.operar(despacho, 'finalizar')
        norte = despacho.paradas.get(sucursal=self.norte)
        self.operar(despacho, 'llegar', parada=norte.pk)
        self.confirmar_pedido(despacho, self.pedido_norte)
        self.operar(despacho, 'finalizar')
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'finalizado')

    def test_exige_llegada_y_respeta_la_siguiente_parada(self):
        despacho, _ = self.iniciar_descarga(llegada=False)
        with self.assertRaises(ValidationError):
            self.confirmar_pedido(despacho, self.pedido_centro)
        with self.assertRaises(ValidationError):
            self.confirmar_pedido(despacho, self.pedido_norte)
        self.assertFalse(despacho.cargas.filter(descargada_en__isnull=False).exists())

    def test_exige_comprobar_todos_los_productos_y_rechaza_ids_ajenos(self):
        despacho, parada = self.iniciar_descarga()
        datos = self.datos_descarga(despacho, self.pedido_centro)
        for cambios in ({'cargas_comprobadas': datos['cargas_comprobadas'][:1]},
                        {'cargas_comprobadas': datos['cargas_comprobadas'] * 2},
                        {'cargas_comprobadas': datos['cargas_comprobadas'] + [999999]},
                        {'pedido': self.pedido_norte.pk}, {'pedido': 999999}):
            with self.subTest(cambios=cambios), self.assertRaises(ValidationError):
                ejecutar_accion(self.chofer, despacho, 'descargar_pedido', {**datos, **cambios}, como_chofer=True)
        self.assertFalse(parada.cargas.filter(descargada_en__isnull=False).exists())

    def test_reintento_con_misma_clave_no_duplica_y_el_orden_de_checks_no_importa(self):
        despacho, _ = self.iniciar_descarga()
        datos = self.datos_descarga(despacho, self.pedido_centro)
        ejecutar_accion(self.chofer, despacho, 'descargar_pedido', datos, como_chofer=True)
        ejecutar_accion(self.chofer, despacho, 'descargar_pedido', {**datos, 'cargas_comprobadas': list(reversed(datos['cargas_comprobadas']))}, como_chofer=True)
        self.assertEqual(OperacionDespacho.objects.filter(despacho=despacho, accion='descargar_pedido').count(), 1)
        with self.assertRaises(ConflictoDespacho):
            ejecutar_accion(self.chofer, despacho, 'descargar_pedido', {**datos, 'pedido': self.segundo_pedido.pk}, como_chofer=True)
        with self.assertRaises(ValidationError):
            self.confirmar_pedido(despacho, self.pedido_centro)

    def test_api_del_chofer_confirma_y_audita_el_pedido(self):
        despacho, parada = self.iniciar_descarga()
        cliente = self.cliente_chofer()
        datos = self.datos_descarga(despacho, self.pedido_centro)
        respuesta = cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/descargar-pedido/', datos, format='json', secure=True)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        evidencia = RegistroActividad.objects.get(accion='descargar_pedido', objeto_id=str(despacho.pk)).cambios['descarga']
        self.assertEqual(evidencia['pedido'], self.pedido_centro.pk)
        self.assertFalse(evidencia['parada_completa'])
        self.chofer.user_permissions.remove(Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios'))
        self.assertEqual(cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/pedidos/?parada={parada.pk}', secure=True).status_code, 200)
        self.assertEqual(cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/descargar-pedido/', self.datos_descarga(despacho, self.segundo_pedido), format='json', secure=True).status_code, 403)

    def test_chofer_ajeno_no_consulta_ni_descarga_el_pedido(self):
        despacho, parada = self.iniciar_descarga()
        ajeno = Usuario.objects.create_user(email='ajeno@descarga.test', cedula_identidad='98702')
        ajeno.user_permissions.set(self.chofer.user_permissions.all())
        cliente = self.cliente_chofer(ajeno)
        for ruta in ('pedidos', 'productos-pedido'):
            self.assertEqual(cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/{ruta}/?parada={parada.pk}&pedido={self.pedido_centro.pk}', secure=True).status_code, 404)
        datos = self.datos_descarga(despacho, self.pedido_centro)
        self.assertEqual(cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/descargar-pedido/', datos, format='json', secure=True).status_code, 404)
        with self.assertRaises(Http404):
            ejecutar_accion(ajeno, despacho, 'descargar_pedido', datos, como_chofer=True)

    def test_compatibilidad_de_descarga_anterior_y_proteccion_de_varios_pedidos(self):
        despacho, parada = self.iniciar_descarga()
        despacho.refresh_from_db()
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4()), 'parada': parada.pk}
        with self.assertRaises(ValidationError):
            ejecutar_accion(self.chofer, despacho, 'descargar', datos, como_chofer=True)
        self.operar(despacho, 'descargar', parada=parada.pk)
        self.assertEqual(parada.cargas.filter(descargada_en__isnull=False).count(), 3)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').count(), 1)

    def test_fallo_de_auditoria_revierte_la_ultima_descarga_y_sus_cajillas(self):
        despacho, parada = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.pedido_centro)
        with patch('despachos.servicios.registrar_actividad', side_effect=RuntimeError('Fallo de auditoría')):
            with self.assertRaises(RuntimeError):
                self.confirmar_pedido(despacho, self.segundo_pedido)
        parada.refresh_from_db()
        self.assertIsNone(parada.descargada_en)
        self.assertEqual(parada.cargas.filter(descargada_en__isnull=False).count(), 2)
        self.assertFalse(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').exists())

    def test_seguimiento_web_respeta_permiso_y_referencias_del_viaje(self):
        despacho, parada = self.iniciar_descarga()
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
        self.client.force_authenticate(self.lector)
        prefijo = f'/api/v1/despachos/{despacho.pk}'
        self.assertEqual(self.client.get(prefijo + f'/pedidos/?parada={parada.pk}').status_code, 200)
        self.assertEqual(self.client.get(prefijo + f'/productos-pedido/?parada={parada.pk}&pedido={self.pedido_centro.pk}').status_code, 200)
        self.assertEqual(self.client.get(prefijo + '/pedidos/?parada=999999').status_code, 404)
        self.assertEqual(self.client.get(prefijo + f'/productos-pedido/?parada={parada.pk}&pedido={self.pedido_norte.pk}').status_code, 404)
        self.assertEqual(self.client.get(prefijo + '/pedidos/?parada=texto').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 403)

    def test_paginacion_agrupa_antes_de_diez_y_exige_checks_de_todas_las_paginas(self):
        nuevos = []
        primero = None
        for indice in range(11):
            pedido = self.crear_pedido(self.centro)
            detalle = self.crear_detalle(pedido, self.cajas, 11 if indice == 0 else 1)
            if primero is None:
                primero = (pedido, detalle)
            repeticiones = 11 if indice == 0 else 1
            for _ in range(repeticiones):
                preparacion = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '1'}],
                    asignaciones=[self.asignacion(detalle, 1, '1')])
                self.confirmar(preparacion)
                nuevos += list(preparacion.asignaciones.all())
        self.asignaciones += nuevos
        despacho, parada = self.iniciar_descarga()
        cliente = self.cliente_chofer()
        for ruta, cantidad in (('pedidos', 13), ('productos-pedido', 11)):
            consulta = f'/api/v1/movil/mis-despachos/{despacho.pk}/{ruta}/?parada={parada.pk}&pedido={primero[0].pk}'
            primera = cliente.get(consulta, secure=True)
            segunda = cliente.get(consulta + '&pagina=2', secure=True)
            self.assertEqual(primera.data['count'], cantidad)
            self.assertEqual(len(primera.data['results']), 10)
            self.assertEqual(len(segunda.data['results']), cantidad - 10)
        datos = self.datos_descarga(despacho, primero[0])
        with self.assertRaises(ValidationError):
            ejecutar_accion(self.chofer, despacho, 'descargar_pedido', {**datos, 'cargas_comprobadas': datos['cargas_comprobadas'][:10]}, como_chofer=True)
        self.confirmar_pedido(despacho, primero[0])
        self.assertEqual(despacho.cargas.filter(contenido__pedido=primero[0].pk, descargada_en__isnull=False).count(), 11)


class PruebasConcurrenciaDescarga(DatosDescargaPedidos, TransactionTestCase):
    ejecutar_paralelo = pruebas_existentes.PruebasConcurrenciaDespachos.ejecutar_paralelo

    def setUp(self):
        self.preparar_descargas()
        super().setUp()

    def test_dos_pedidos_simultaneos_no_duplican_la_entrega_consolidada(self):
        despacho, parada = self.iniciar_descarga()
        primero = self.datos_descarga(despacho, self.pedido_centro)
        segundo = self.datos_descarga(despacho, self.segundo_pedido)
        resultados = self.ejecutar_paralelo(
            lambda: ejecutar_accion(self.chofer, despacho, 'descargar_pedido', primero, como_chofer=True),
            lambda: ejecutar_accion(self.chofer, despacho, 'descargar_pedido', segundo, como_chofer=True))
        self.assertCountEqual(resultados, ['exito', 409])
        for pedido in (self.pedido_centro, self.segundo_pedido):
            if despacho.cargas.filter(contenido__pedido=pedido.pk, descargada_en__isnull=True).exists():
                self.confirmar_pedido(despacho, pedido)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').count(), 1)

    def test_migracion_conserva_descargas_anteriores_sin_inventar_responsable(self):
        despacho, parada = self.iniciar_descarga()
        self.operar(despacho, 'descargar', parada=parada.pk)
        parada.refresh_from_db()
        movimientos = MovimientoCajilla.objects.count()
        destinos = MigrationExecutor(connection).loader.graph.leaf_nodes()
        try:
            MigrationExecutor(connection).migrate([('despachos', '0002_acceso_movil_envio')])
            MigrationExecutor(connection).migrate(destinos)
            cargas = list(CargaDespacho.objects.filter(parada_id=parada.pk))
            self.assertTrue(all(fila.descargada_en == parada.descargada_en for fila in cargas))
            self.assertTrue(all(fila.responsable_descarga_id is None and fila.responsable_descarga_nombre == '' for fila in cargas))
            self.assertTrue(CargaDespacho.objects.filter(despacho=despacho, parada__sucursal=self.norte, descargada_en__isnull=True).exists())
            self.assertEqual(MovimientoCajilla.objects.count(), movimientos)
        finally:
            MigrationExecutor(connection).migrate(destinos)
