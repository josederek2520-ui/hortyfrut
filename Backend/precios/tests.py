import uuid
from decimal import Decimal
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.exceptions import PermissionDenied, ValidationError
from clientes.models import Cliente
from productos.models import Producto
from usuarios.models import Usuario
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla
from auditoria.models import RegistroActividad
from devoluciones.tests import DatosDevoluciones
from .models import AcuerdoPrecio, OperacionPrecio
from .consultas import version_acuerdo, precio_para_entrega
from .servicios import guardar, actuar, ConflictoPrecio


class DatosPrecios(DatosDevoluciones):
    def datos_precio(self, **cambios):
        return {'clave_operacion': str(uuid.uuid4()), 'version': '', 'cliente': self.cliente.pk, 'alcance': 'periodo',
            'desde': str(self.hoy), 'hasta': str(self.hoy + timedelta(days=6)), 'referencia_propuesta': 'Lista semanal del supermercado',
            'lineas': [{'producto': self.producto.pk, 'precio_kg': '5.25'}], 'entregas': [], **cambios}

    def accion(self, acuerdo, accion, actor=None, **cambios):
        acuerdo.refresh_from_db()
        return actuar(actor or self.actor, acuerdo.pk, accion, {'clave_operacion': str(uuid.uuid4()), 'version': version_acuerdo(acuerdo), **cambios})

    def aceptado(self, **cambios):
        acuerdo = guardar(self.actor, self.datos_precio(**cambios))
        self.accion(acuerdo, 'presentar')
        return self.accion(acuerdo, 'aceptar')


class PruebasPrecios(DatosPrecios, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()

    def test_borrador_no_autocompleta_precios_y_uuid_conserva_cuerpo(self):
        datos = self.datos_precio(lineas=[{'producto': self.producto.pk, 'precio_kg': None}])
        acuerdo = guardar(self.actor, datos)
        self.assertIsNone(acuerdo.lineas.get().precio_kg)
        self.assertEqual(guardar(self.actor, datos).pk, acuerdo.pk)
        self.assertEqual(OperacionPrecio.objects.count(), 1)
        with self.assertRaises(ConflictoPrecio):
            guardar(self.actor, {**datos, 'referencia_propuesta': 'Otra lista'})
        with self.assertRaises(ValidationError):
            self.accion(acuerdo, 'presentar')

    def test_precio_por_producto_exacto_y_propuesta_aceptacion_separadas(self):
        movimientos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        acuerdo = guardar(self.actor, self.datos_precio())
        propuesta = self.accion(acuerdo, 'presentar')
        self.assertEqual(propuesta.estado, 'propuesta')
        self.assertIsNone(propuesta.revisado_en)
        aceptado = self.accion(acuerdo, 'aceptar')
        self.assertEqual(aceptado.lineas.get().precio_kg, Decimal('5.25'))
        self.assertEqual(aceptado.estado, 'aceptado')
        self.assertTrue(RegistroActividad.objects.filter(modulo='precios', accion='aceptar', objeto_id=str(acuerdo.pk)).exists())
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (movimientos, cajillas))

    def test_propuesta_registrada_y_aceptada_no_se_editan(self):
        acuerdo = guardar(self.actor, self.datos_precio())
        self.accion(acuerdo, 'presentar')
        acuerdo.refresh_from_db()
        with self.assertRaises(ConflictoPrecio):
            guardar(self.actor, self.datos_precio(version=version_acuerdo(acuerdo)), acuerdo.pk)
        self.accion(acuerdo, 'aceptar')
        with self.assertRaises(ConflictoPrecio):
            self.accion(acuerdo, 'cancelar')

    def test_validacion_dos_decimales_positivos_y_productos_unicos(self):
        with self.assertRaises(ValidationError):
            guardar(self.actor, self.datos_precio(hasta=str(self.hoy - timedelta(days=1))))
        for precio in ['0', '-1', '1.001', '10000000000.00', 'NaN']:
            with self.subTest(precio=precio), self.assertRaises(ValidationError):
                guardar(self.actor, self.datos_precio(lineas=[{'producto': self.producto.pk, 'precio_kg': precio}]))
        datos = self.datos_precio()
        with self.assertRaises(ValidationError):
            guardar(self.actor, {**datos, 'lineas': datos['lineas'] * 2})

    def test_solapamiento_de_producto_se_rechaza_y_otro_periodo_se_admite(self):
        self.aceptado()
        segundo = guardar(self.actor, self.datos_precio())
        self.accion(segundo, 'presentar')
        with self.assertRaises(ValidationError):
            self.accion(segundo, 'aceptar')
        otro = self.aceptado(desde=str(self.hoy + timedelta(days=7)), hasta=str(self.hoy + timedelta(days=13)))
        self.assertEqual(otro.estado, 'aceptado')

    def test_cliente_y_producto_diferentes_no_comparten_precio(self):
        entrega = self.preparar_entrega_confirmada()
        otro = Cliente.objects.create(razon_social='Supermercado distinto', nit='929292')
        self.aceptado(cliente=otro.pk)
        self.assertIsNone(precio_para_entrega(entrega, self.producto.pk))
        producto = Producto.objects.create(nombre='Tomate de pruebas', categoria=self.categoria, unidad_medida=self.kg)
        self.aceptado(lineas=[{'producto': producto.pk, 'precio_kg': '8.10'}])
        self.assertIsNone(precio_para_entrega(entrega, self.producto.pk))

    def test_vigencia_se_resuelve_por_fecha_requerida_y_no_fecha_de_recepcion(self):
        entrega = self.preparar_entrega_confirmada()
        entrega.pedido.fecha_requerida = self.hoy - timedelta(days=4)
        entrega.pedido.save(update_fields=['fecha_requerida'])
        self.aceptado()
        self.assertIsNone(precio_para_entrega(entrega, self.producto.pk))
        precio = self.aceptado(desde=str(self.hoy - timedelta(days=4)), hasta=str(self.hoy - timedelta(days=1)))
        self.assertEqual(precio_para_entrega(entrega, self.producto.pk).acuerdo_id, precio.pk)

    def test_entrega_especifica_tiene_prioridad_sin_alterar_precio_del_periodo(self):
        entrega = self.preparar_entrega_confirmada()
        periodo = self.aceptado()
        especifico = self.aceptado(alcance='entregas', desde=None, hasta=None, entregas=[entrega.pk],
            lineas=[{'producto': self.producto.pk, 'precio_kg': '4.50'}])
        self.assertEqual(precio_para_entrega(entrega, self.producto.pk).acuerdo_id, especifico.pk)
        periodo.refresh_from_db()
        self.assertEqual(periodo.lineas.get().precio_kg, Decimal('5.25'))

    def test_entregas_ajenas_y_producto_no_entregado_se_rechazan(self):
        entrega = self.preparar_entrega_confirmada()
        otro = Cliente.objects.create(razon_social='Supermercado ajeno', nit='929293')
        with self.assertRaises(ValidationError):
            guardar(self.actor, self.datos_precio(cliente=otro.pk, alcance='entregas', desde=None, hasta=None, entregas=[entrega.pk]))
        producto = Producto.objects.create(nombre='Producto no entregado', categoria=self.categoria, unidad_medida=self.kg)
        acuerdo = guardar(self.actor, self.datos_precio(alcance='entregas', desde=None, hasta=None, entregas=[entrega.pk],
            lineas=[{'producto': producto.pk, 'precio_kg': '3'}]))
        with self.assertRaises(ValidationError):
            self.accion(acuerdo, 'presentar')

    def test_nueva_version_preserva_el_original_y_resuelve_precio_nuevo(self):
        entrega = self.preparar_entrega_confirmada()
        original = self.aceptado()
        nuevo = self.accion(original, 'nueva_version', motivo='Nueva lista del supermercado')
        self.assertEqual(nuevo.numero_version, 2)
        self.assertEqual(precio_para_entrega(entrega, self.producto.pk).precio_kg, Decimal('5.25'))
        guardar(self.actor, self.datos_precio(version=version_acuerdo(nuevo), lineas=[{'producto': self.producto.pk, 'precio_kg': '4.50'}]), nuevo.pk)
        self.accion(nuevo, 'presentar')
        self.accion(nuevo, 'aceptar')
        self.assertEqual(precio_para_entrega(entrega, self.producto.pk).precio_kg, Decimal('4.50'))
        original.refresh_from_db()
        self.assertEqual((original.estado, original.lineas.get().precio_kg), ('aceptado', Decimal('5.25')))
        self.assertFalse(self.client.get(f'/api/v1/precios-acordados/{original.pk}/').data['es_actual'])
        with self.assertRaises(ConflictoPrecio):
            self.accion(original, 'nueva_version', motivo='Otra copia')

    def test_version_conserva_alcance_y_otro_borrador_no_puede_reemplazar_version_posterior(self):
        original = self.aceptado()
        primero = self.accion(original, 'nueva_version', motivo='Corrección')
        segundo = self.accion(original, 'nueva_version', motivo='Otra corrección')
        with self.assertRaises(ValidationError):
            guardar(self.actor, self.datos_precio(version=version_acuerdo(primero), hasta=str(self.hoy + timedelta(days=8))), primero.pk)
        self.accion(primero, 'presentar')
        self.accion(primero, 'aceptar')
        with self.assertRaises(ConflictoPrecio):
            self.accion(segundo, 'presentar')

    def test_rechazo_exige_motivo_y_reintento_no_duplica_aceptacion(self):
        acuerdo = guardar(self.actor, self.datos_precio())
        self.accion(acuerdo, 'presentar')
        with self.assertRaises(ValidationError):
            self.accion(acuerdo, 'rechazar')
        self.accion(acuerdo, 'rechazar', motivo='Falta confirmar el producto')
        otro = guardar(self.actor, self.datos_precio())
        self.accion(otro, 'presentar')
        otro.refresh_from_db()
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': version_acuerdo(otro)}
        actuar(self.actor, otro.pk, 'aceptar', datos)
        actuar(self.actor, otro.pk, 'aceptar', datos)
        self.assertEqual(OperacionPrecio.objects.filter(acuerdo=otro, accion='aceptar').count(), 1)

    def test_permisos_separados_y_revocacion_revalidada_incluso_en_reintentos(self):
        operador = Usuario.objects.create_user(email='precios@pruebas.test', cedula_identidad='70701')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='precios', codename__in=[
            'view_acuerdoprecio', 'add_acuerdoprecio', 'presentar_acuerdoprecio']))
        acuerdo = guardar(operador, self.datos_precio())
        self.accion(acuerdo, 'presentar', actor=operador)
        with self.assertRaises(PermissionDenied):
            self.accion(acuerdo, 'aceptar', actor=operador)
        datos = {'clave_operacion': str(uuid.uuid4()), 'version': version_acuerdo(acuerdo)}
        self.accion(acuerdo, 'aceptar')
        operador.user_permissions.clear()
        with self.assertRaises(PermissionDenied):
            actuar(operador, acuerdo.pk, 'presentar', datos)

    def test_fallo_de_auditoria_revierte_aceptacion(self):
        acuerdo = guardar(self.actor, self.datos_precio())
        self.accion(acuerdo, 'presentar')
        with patch('precios.servicios.registrar_actividad', side_effect=RuntimeError('Fallo de prueba')):
            with self.assertRaises(RuntimeError):
                self.accion(acuerdo, 'aceptar')
        acuerdo.refresh_from_db()
        self.assertEqual(acuerdo.estado, 'propuesta')
        self.assertIsNone(acuerdo.revisado_en)

    def test_listados_y_catalogos_filtran_antes_de_paginar_de_diez(self):
        for indice in range(12):
            guardar(self.actor, self.datos_precio(referencia_propuesta=f'Lista {indice}'))
        primera = self.client.get('/api/v1/precios-acordados/?page_size=200')
        segunda = self.client.get('/api/v1/precios-acordados/?pagina=2')
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (12, 10, 2))
        self.assertEqual(self.client.get('/api/v1/precios-acordados/?estado=aceptado').data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/precios-acordados/?buscar=Papaya').data['count'], 12)

    def test_flujo_http_csrf_sin_permiso_de_catalogos(self):
        operador = Usuario.objects.create_user(email='comercial@pruebas.test', cedula_identidad='70702')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='precios'))
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(operador)
        self.assertFalse(operador.has_perm('productos.view_producto'))
        self.assertEqual(cliente.get('/api/v1/precios-acordados/productos/').status_code, 200)
        self.assertEqual(cliente.get('/api/v1/precios-acordados/clientes/').status_code, 200)
        datos = self.datos_precio()
        self.assertEqual(cliente.post('/api/v1/precios-acordados/', datos, format='json').status_code, 403)
        csrf = cliente.get('/api/v1/auth/csrf/').json()['csrfToken']
        respuesta = cliente.post('/api/v1/precios-acordados/', datos, format='json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        for accion in ['presentar', 'aceptar']:
            respuesta = cliente.post(f'/api/v1/precios-acordados/{respuesta.data["id"]}/{accion}/',
                {'clave_operacion': str(uuid.uuid4()), 'version': respuesta.data['version']}, format='json', HTTP_X_CSRFTOKEN=csrf)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['estado'], 'aceptado')

    @override_settings(ROOT_URLCONF='config.rutas_chofer_https')
    def test_no_se_publica_en_https_ni_se_exponen_permisos(self):
        self.assertEqual(self.client.get('/api/v1/precios-acordados/').status_code, 404)
        self.assertFalse(any(self.client.get('/api/v1/auth/me/').data['permisos_precios'].values()))


class PruebasConcurrenciaPrecios(DatosPrecios, TransactionTestCase):
    def setUp(self):
        self.preparar_descargas()
        super().setUp()

    def test_dos_aceptaciones_simultaneas_no_generan_precios_ambiguos(self):
        acuerdos = [guardar(self.actor, self.datos_precio()) for _ in range(2)]
        for acuerdo in acuerdos:
            self.accion(acuerdo, 'presentar')
            acuerdo.refresh_from_db()
        barrera = Barrier(2)
        datos = [{'clave_operacion': str(uuid.uuid4()), 'version': version_acuerdo(a)} for a in acuerdos]
        def ejecutar(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    actuar(actor, acuerdos[indice].pk, 'aceptar', datos[indice])
                    return 'aceptado'
                except ValidationError:
                    return 'conflicto'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as grupo:
            resultados = list(grupo.map(ejecutar, range(2)))
        self.assertEqual(sorted(resultados), ['aceptado', 'conflicto'])
        self.assertEqual(AcuerdoPrecio.objects.filter(estado='aceptado').count(), 1)
