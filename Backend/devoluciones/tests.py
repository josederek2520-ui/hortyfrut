import uuid
from datetime import timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from despachos.test_descarga_pedidos import DatosDescargaPedidos
from entregas.models import Entrega
from entregas.vistas import representar as representar_entrega
from entregas.servicios import guardar_hoja, ejecutar_accion as accion_entrega
from entregas.consultas import version_entrega as version_recepcion
from inventario.models import Lote, MovimientoInventario
from inventario.consultas import lotes_con_saldo
from inventario.servicios import cambiar_estado_lote, version_lote
from usuarios.models import Usuario
from .models import Devolucion, OperacionDevolucion
from .consultas import version_entrega, version_devolucion
from .servicios import guardar_recepcion, recibir, guardar_revision, revisar, cancelar, ConflictoDevolucion


class DatosDevoluciones(DatosDescargaPedidos):
    def preparar_entrega_confirmada(self):
        self.centro.encargado_pedidos = self.actor
        self.centro.save(update_fields=['encargado_pedidos'])
        despacho, _ = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.pedido_centro)
        hoja = representar_entrega(self.actor, despacho.pk, self.pedido_centro.pk)
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': hoja['version'], 'fecha_recepcion': str(self.hoy), 'recibido_por': 'Sucursal',
            'lineas': [{'producto': p['producto'], 'cajas_recibidas': p['cajas'], 'unidades_recibidas': p['unidades'], 'peso_recibido_kg': p['peso_kg'],
                'peso_rechazado_kg': '0', 'motivo_rechazo': ''} for p in hoja['origen']['productos']],
            'aportes': [{'carga': a['carga'], 'lote': a['lote'], 'peso_recibido_kg': a['peso_kg'], 'peso_rechazado_kg': '0'}
                for p in hoja['origen']['productos'] for a in p['aportes']]}
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        for accion in ['enviar', 'confirmar']:
            accion_entrega(self.actor, despacho.pk, self.pedido_centro.pk, accion, {'clave_operacion': str(uuid.uuid4()), 'version': version_recepcion(entrega, entrega.origen)})
            entrega.refresh_from_db()
        return entrega

    def datos_devolucion(self, entrega, cantidad='4', **cambios):
        return {'clave_operacion': str(uuid.uuid4()), 'version': version_entrega(entrega), 'entrega': entrega.pk, 'almacen': self.almacen.pk,
            'fecha_recepcion': str(self.hoy), 'motivo': 'Retorno físico de sucursal',
            'lineas': [{'aporte': entrega.aportes.order_by('pk').first().pk, 'cantidad_recibida': cantidad, 'peso_kg_recibido': cantidad}], **cambios}

    def recibir_devolucion(self, entrega, cantidad='4'):
        devolucion = guardar_recepcion(self.actor, self.datos_devolucion(entrega, cantidad))
        return recibir(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})

    def datos_revision(self, devolucion, aprovechable='3', merma='1'):
        return {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion), 'motivo_revision': 'Separación por calidad',
            'lineas': [{'aporte': devolucion.lineas.first().aporte_id, 'cantidad_aprovechable': aprovechable, 'cantidad_merma': merma,
                'peso_kg_aprovechable': aprovechable, 'peso_kg_merma': merma}]}


class PruebasDevoluciones(DatosDevoluciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()

    def test_borrador_no_mueve_inventario_y_reintento_no_duplica(self):
        entrega = self.preparar_entrega_confirmada()
        movimientos = MovimientoInventario.objects.count()
        datos = self.datos_devolucion(entrega)
        devolucion = guardar_recepcion(self.actor, datos)
        repetida = guardar_recepcion(self.actor, datos)
        self.assertEqual(devolucion.pk, repetida.pk)
        self.assertEqual(Devolucion.objects.count(), 1)
        self.assertEqual(OperacionDevolucion.objects.count(), 1)
        self.assertEqual(MovimientoInventario.objects.count(), movimientos)
        self.assertIsNone(devolucion.lineas.first().lote_retenido)
        with self.assertRaises(ConflictoDevolucion):
            guardar_recepcion(self.actor, {**datos, 'motivo': 'Otro cuerpo'})

    def test_recibir_crea_lote_bloqueado_y_no_modifica_la_entrega_ni_cajillas(self):
        entrega = self.preparar_entrega_confirmada()
        original = representar_entrega(self.actor, entrega.despacho_id, entrega.pedido_id)
        cajillas = MovimientoCajilla.objects.count()
        devolucion = self.recibir_devolucion(entrega)
        linea = devolucion.lineas.get()
        lote = lotes_con_saldo().get(pk=linea.lote_retenido_id)
        self.assertEqual((lote.estado, lote.calidad, lote.saldo), ('bloqueado', 'devuelto', Decimal('4')))
        self.assertEqual(lote.lote_origen_id, linea.aporte.lote_id)
        self.assertEqual(MovimientoCajilla.objects.count(), cajillas)
        self.assertEqual(representar_entrega(self.actor, entrega.despacho_id, entrega.pedido_id), original)
        self.assertTrue(RegistroActividad.objects.filter(modulo='devoluciones', accion='recibir', objeto_id=str(devolucion.pk)).exists())

    def test_revision_solo_aprovechable_y_merma_con_movimientos_exactos(self):
        devolucion = self.recibir_devolucion(self.preparar_entrega_confirmada())
        guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion))
        devolucion.refresh_from_db()
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)}
        resultado = revisar(self.actor, devolucion.pk, datos)
        revisar(self.actor, devolucion.pk, datos)
        linea = resultado.lineas.get()
        self.assertEqual(lotes_con_saldo().get(pk=linea.lote_retenido_id).saldo, Decimal('0'))
        lote = lotes_con_saldo().get(pk=linea.lote_aprovechable_id)
        self.assertEqual((lote.saldo, lote.estado, lote.calidad), (Decimal('3'), 'bloqueado', 'aprovechable'))
        self.assertEqual(resultado.movimiento_merma.detalles.get().cantidad, Decimal('1'))
        self.assertEqual(MovimientoInventario.objects.filter(referencia_tipo='devolucion', referencia_id=devolucion.pk).count(), 4)
        with self.assertRaises(ValidationError):
            cambiar_estado_lote(self.actor, lote, {'version': version_lote(lote), 'estado': 'disponible'})

    def test_lote_retenido_no_se_puede_desbloquear(self):
        devolucion = self.recibir_devolucion(self.preparar_entrega_confirmada())
        lote = devolucion.lineas.get().lote_retenido
        with self.assertRaises(ValidationError):
            cambiar_estado_lote(self.actor, lote, {'version': version_lote(lote), 'estado': 'disponible'})

    def test_revision_exige_suma_exacta_y_ningun_campo_disponible(self):
        devolucion = self.recibir_devolucion(self.preparar_entrega_confirmada())
        movimientos = MovimientoInventario.objects.count()
        with self.assertRaises(ValidationError):
            guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion, '3', '0.999'))
        datos = self.datos_revision(devolucion)
        datos['lineas'][0]['cantidad_disponible'] = '1'
        with self.assertRaises(ValidationError):
            guardar_revision(self.actor, devolucion.pk, datos)
        self.assertEqual(MovimientoInventario.objects.count(), movimientos)

    def test_pesos_y_unidades_independientes_sin_conversion(self):
        entrega = self.preparar_entrega_confirmada()
        from catalogos.models import UnidadMedida
        unidad = UnidadMedida.objects.create(nombre='Unidad física de retorno', abreviatura='uni-ret')
        aporte = entrega.aportes.order_by('pk').first()
        lote = aporte.lote
        lote.unidad = unidad
        lote.unidad_nombre, lote.unidad_abreviatura = unidad.nombre, unidad.abreviatura
        lote.save(update_fields=['unidad', 'unidad_nombre', 'unidad_abreviatura'])
        datos = self.datos_devolucion(entrega, '2')
        datos['lineas'][0]['peso_kg_recibido'] = '4'
        devolucion = guardar_recepcion(self.actor, datos)
        devolucion = recibir(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        revision = self.datos_revision(devolucion, '1', '1')
        revision['lineas'][0].update(peso_kg_aprovechable='3', peso_kg_merma='1')
        guardar_revision(self.actor, devolucion.pk, revision)
        devolucion.refresh_from_db()
        revisar(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        linea = devolucion.lineas.get()
        self.assertEqual(linea.lote_aprovechable.unidad_id, unidad.pk)
        self.assertEqual(lotes_con_saldo().get(pk=linea.lote_aprovechable_id).saldo, Decimal('1'))
        self.assertEqual(linea.lote_aprovechable.peso_kg_ingreso, Decimal('3'))

    def test_retorno_parcial_acumula_y_no_permite_exceso(self):
        entrega = self.preparar_entrega_confirmada()
        self.recibir_devolucion(entrega, '15')
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, self.datos_devolucion(entrega, '6'))
        devolucion = self.recibir_devolucion(entrega, '5')
        respuesta = self.client.get('/api/v1/devoluciones/origen/', {'entrega': entrega.pk})
        aporte = next(fila for fila in respuesta.data['results'] if fila['id'] == devolucion.lineas.get().aporte_id)
        self.assertEqual(Decimal(aporte['maximo_cantidad']), 0)
        self.assertEqual(Decimal(aporte['maximo_peso']), 0)

    def test_dos_borradores_no_reservan_y_recibir_revalida_el_limite(self):
        entrega = self.preparar_entrega_confirmada()
        primero = guardar_recepcion(self.actor, self.datos_devolucion(entrega, '15'))
        segundo = guardar_recepcion(self.actor, self.datos_devolucion(entrega, '15'))
        recibir(self.actor, primero.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(primero)})
        with self.assertRaises(ValidationError):
            recibir(self.actor, segundo.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(segundo)})
        segundo.refresh_from_db()
        self.assertEqual(segundo.estado, 'borrador')
        self.assertIsNone(segundo.movimiento_ingreso)

    def test_recibir_y_revisar_tienen_permisos_separados_y_se_revalidan(self):
        entrega = self.preparar_entrega_confirmada()
        operador = Usuario.objects.create_user(email='retornos@pruebas.test', cedula_identidad='191911')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='devoluciones', codename__in=['view_devolucion', 'add_devolucion', 'recibir_devolucion']))
        devolucion = guardar_recepcion(operador, self.datos_devolucion(entrega))
        with self.assertRaises(PermissionDenied):
            guardar_revision(operador, devolucion.pk, self.datos_revision(devolucion))
        operador.user_permissions.remove(Permission.objects.get(content_type__app_label='devoluciones', codename='recibir_devolucion'))
        with self.assertRaises(PermissionDenied):
            recibir(operador, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})

    def test_solo_entregas_confirmadas_y_aportes_propios(self):
        entrega = self.preparar_entrega_confirmada()
        datos = self.datos_devolucion(entrega)
        datos['lineas'][0]['aporte'] = 9999999
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, datos)
        entrega.estado, entrega.confirmado_en = 'revision', None
        entrega.save(update_fields=['estado', 'confirmado_en'])
        self.assertEqual(self.client.get('/api/v1/devoluciones/origen/', {'entrega': entrega.pk}).status_code, 404)

    def test_vencido_se_recibe_bloqueado_y_solo_admite_merma(self):
        entrega = self.preparar_entrega_confirmada()
        lote = entrega.aportes.order_by('pk').first().lote
        lote.fecha_ingreso, lote.fecha_vencimiento = self.hoy - timedelta(days=5), self.hoy - timedelta(days=1)
        lote.save(update_fields=['fecha_ingreso', 'fecha_vencimiento'])
        devolucion = self.recibir_devolucion(entrega)
        with self.assertRaises(ValidationError):
            guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion))
        guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion, '0', '4'))
        devolucion.refresh_from_db()
        resultado = revisar(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        self.assertIsNone(resultado.movimiento_aprovechable)
        self.assertEqual(resultado.movimiento_merma.detalles.get().cantidad, Decimal('4'))

    def test_fallo_de_auditoria_revierte_entrada_y_lotes(self):
        entrega = self.preparar_entrega_confirmada()
        devolucion = guardar_recepcion(self.actor, self.datos_devolucion(entrega))
        movimientos, lotes = MovimientoInventario.objects.count(), Lote.objects.count()
        with patch('devoluciones.servicios.registrar_actividad', side_effect=RuntimeError('Fallo de prueba')):
            with self.assertRaises(RuntimeError):
                recibir(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        devolucion.refresh_from_db()
        self.assertEqual((MovimientoInventario.objects.count(), Lote.objects.count()), (movimientos, lotes))
        self.assertEqual(devolucion.estado, 'borrador')

    def test_cancelacion_solo_borrador_y_revision_confirmada_inmutable(self):
        entrega = self.preparar_entrega_confirmada()
        borrador = guardar_recepcion(self.actor, self.datos_devolucion(entrega))
        cancelar(self.actor, borrador.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(borrador)})
        devolucion = self.recibir_devolucion(entrega)
        with self.assertRaises(ConflictoDevolucion):
            cancelar(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion))
        devolucion.refresh_from_db()
        revisar(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        devolucion.refresh_from_db()
        with self.assertRaises(ConflictoDevolucion):
            guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion))

    def test_api_filtros_y_paginas_de_diez_antes_de_paginar(self):
        entrega = self.preparar_entrega_confirmada()
        for indice in range(12):
            guardar_recepcion(self.actor, self.datos_devolucion(entrega, motivo=f'Retorno {indice}'))
        primera = self.client.get('/api/v1/devoluciones/?page_size=100')
        self.assertEqual((primera.data['count'], len(primera.data['results'])), (12, 10))
        segunda = self.client.get('/api/v1/devoluciones/?pagina=2')
        self.assertEqual(len(segunda.data['results']), 2)
        self.assertEqual(self.client.get('/api/v1/devoluciones/?estado=recibida').data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/devoluciones/?buscar=Retorno').data['count'], 0)

    def test_flujo_http_con_csrf_y_solo_permisos_de_devoluciones(self):
        entrega = self.preparar_entrega_confirmada()
        operador = Usuario.objects.create_user(email='recepcion-retornos@pruebas.test', cedula_identidad='191912')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='devoluciones', codename__in=[
            'view_devolucion', 'add_devolucion', 'recibir_devolucion', 'revisar_devolucion']))
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(operador)
        self.assertFalse(operador.has_perm('entregas.view_entrega'))
        self.assertFalse(operador.has_perm('inventario.view_lote'))
        origen = cliente.get('/api/v1/devoluciones/origen/', {'entrega': entrega.pk})
        self.assertEqual(origen.status_code, 200)
        self.assertEqual(cliente.get('/api/v1/devoluciones/almacenes/').status_code, 200)
        datos = self.datos_devolucion(entrega, '4.001')
        self.assertEqual(cliente.post('/api/v1/devoluciones/', datos, format='json').status_code, 403)
        csrf = cliente.get('/api/v1/auth/csrf/').json()['csrfToken']

        def enviar(ruta, cuerpo):
            respuesta = cliente.post(ruta, cuerpo, format='json', HTTP_X_CSRFTOKEN=csrf)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            return respuesta.data

        borrador = enviar('/api/v1/devoluciones/', datos)
        ruta = f'/api/v1/devoluciones/{borrador["id"]}/'
        accion = {'clave_operacion': str(uuid.uuid4()), 'version': borrador['version']}
        recibida = enviar(ruta + 'recibir/', accion)
        repetida = enviar(ruta + 'recibir/', accion)
        self.assertEqual(recibida, repetida)
        revision = {'clave_operacion': str(uuid.uuid4()), 'version': recibida['version'], 'motivo_revision': 'Producto separado',
            'lineas': [{'aporte': recibida['lineas'][0]['aporte'], 'cantidad_aprovechable': '3.001', 'cantidad_merma': '1',
                'peso_kg_aprovechable': '3.001', 'peso_kg_merma': '1'}]}
        guardada = enviar(ruta + 'revision/', revision)
        revisada = enviar(ruta + 'revisar/', {'clave_operacion': str(uuid.uuid4()), 'version': guardada['version']})
        self.assertEqual(revisada['estado'], 'revisada')
        self.assertEqual(len(revisada['movimientos']), 4)
        self.assertEqual(cliente.get(ruta + 'lineas/').data['count'], 1)
        self.assertEqual(Decimal(revisada['lineas'][0]['peso_kg_aprovechable']), Decimal('3.001'))

    def test_fallo_de_auditoria_revierte_toda_la_revision(self):
        devolucion = self.recibir_devolucion(self.preparar_entrega_confirmada())
        guardar_revision(self.actor, devolucion.pk, self.datos_revision(devolucion))
        devolucion.refresh_from_db()
        movimientos, lotes = MovimientoInventario.objects.count(), Lote.objects.count()
        with patch('devoluciones.servicios.registrar_actividad', side_effect=RuntimeError('Fallo de prueba')):
            with self.assertRaises(RuntimeError):
                revisar(self.actor, devolucion.pk, {'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(devolucion)})
        devolucion.refresh_from_db()
        linea = devolucion.lineas.get()
        self.assertEqual(devolucion.estado, 'recibida')
        self.assertIsNone(linea.lote_aprovechable_id)
        self.assertEqual(lotes_con_saldo().get(pk=linea.lote_retenido_id).saldo, Decimal('4'))
        self.assertEqual((MovimientoInventario.objects.count(), Lote.objects.count()), (movimientos, lotes))

    def test_solo_anotados_filtra_aportes_del_origen_antes_de_paginar(self):
        entrega = self.preparar_entrega_confirmada()
        aporte = entrega.aportes.order_by('pk').first()
        respuesta = self.client.get('/api/v1/devoluciones/origen/', {
            'entrega': entrega.pk, 'solo_anotados': 'true', 'aportes': f'{aporte.pk},99999999'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual((respuesta.data['count'], respuesta.data['results'][0]['id']), (1, aporte.pk))
        self.assertEqual(set(respuesta.data['orden_aportes']), set(entrega.aportes.values_list('pk', flat=True)))
        vacia = self.client.get('/api/v1/devoluciones/origen/', {'entrega': entrega.pk, 'solo_anotados': 'true'})
        self.assertEqual(vacia.data['count'], 0)

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_https_no_publica_devoluciones_y_retira_sus_permisos(self):
        self.assertEqual(self.client.get('/api/v1/devoluciones/').status_code, 404)
        respuesta = self.client.get('/api/v1/auth/me/')
        self.assertFalse(any(respuesta.data['permisos_devoluciones'].values()))


class PruebasConcurrenciaDevoluciones(DatosDevoluciones, TransactionTestCase):
    def setUp(self):
        self.preparar_descargas()
        super().setUp()

    def test_dos_recepciones_concurrentes_no_superan_el_mismo_aporte(self):
        entrega = self.preparar_entrega_confirmada()
        devoluciones = [guardar_recepcion(self.actor, self.datos_devolucion(entrega, '15')) for _ in range(2)]
        datos = [{'clave_operacion': str(uuid.uuid4()), 'version': version_devolucion(fila)} for fila in devoluciones]
        barrera = Barrier(2)
        def ejecutar(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    recibir(actor, devoluciones[indice].pk, datos[indice])
                    return 'recibida'
                except ValidationError:
                    return 'rechazada'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as grupo:
            resultados = list(grupo.map(ejecutar, range(2)))
        self.assertEqual(sorted(resultados), ['rechazada', 'recibida'])
        self.assertEqual(Devolucion.objects.filter(estado='recibida').count(), 1)
        self.assertEqual(MovimientoInventario.objects.filter(tipo='entrada_devolucion').count(), 1)
