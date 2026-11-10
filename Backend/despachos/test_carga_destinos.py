import uuid
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.test import TestCase
from clientes.models import Sucursal
from almacenes.models import Almacen
from inventario.models import Lote
from recepciones.servicios import guardar_recepcion, confirmar_recepcion, version_recepcion
from .tests import DatosDespachos

class PruebasCargaDestinos(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()

    def destinos(self, **filtros):
        return self.client.get('/api/v1/despachos/destinos-disponibles/', {'almacen': self.almacen.pk, **filtros})

    def test_agrupa_cant_uni_y_productos_sin_duplicar_producto(self):
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '10'}],
            asignaciones=[self.asignacion(self.centro_uni, 4, '4'), self.asignacion(self.norte_uni, 6, '6')]))
        respuesta = self.destinos()
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 2)
        centro = next(fila for fila in respuesta.data['results'] if fila['sucursal'] == self.centro.pk)
        self.assertEqual((centro['asignaciones'], centro['productos'], centro['cajas'], centro['unidades'], centro['peso_kg']), (2, 1, 2, 4, '24.000'))

    def test_filtra_antes_de_paginar_y_no_confunde_fecha_reparto(self):
        respuesta = self.destinos(buscar='Centro', fecha=str(self.hoy))
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(self.destinos(fecha=str(self.hoy + timedelta(days=1))).data['count'], 0)
        self.assertEqual(self.destinos(buscar=self.cliente.razon_social).data['count'], 2)
        self.assertEqual(self.destinos(buscar=self.producto.nombre).data['count'], 0)
        otro = Almacen.objects.create(nombre='Otro', direccion='Otra')
        self.assertEqual(self.destinos(almacen=otro.pk).data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/despachos/destinos-disponibles/').status_code, 400)

    def test_diecisiete_asignaciones_no_dividen_una_sucursal_entre_paginas(self):
        nuevas = []
        for indice in range(11):
            sucursal = Sucursal.objects.create(cliente=self.cliente, nombre=f'Sucursal {indice:02}', direccion='Calle')
            detalle = self.crear_detalle(self.crear_pedido(sucursal), self.cajas, 1)
            nuevas.append(self.asignacion(detalle, 1, '1'))
        for indice in range(4):
            detalle = self.crear_detalle(self.crear_pedido(self.centro), self.cajas, 1)
            nuevas.append(self.asignacion(detalle, 1, '1'))
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '15'}], asignaciones=nuevas))
        primera = self.destinos()
        segunda = self.destinos(pagina=2)
        self.assertEqual(primera.status_code, 200, primera.data)
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (13, 10, 3))
        self.assertEqual(len({fila['sucursal'] for fila in primera.data['results'] + segunda.data['results']}), 13)
        centro = next(fila for fila in primera.data['results'] if fila['sucursal'] == self.centro.pk)
        self.assertEqual((centro['asignaciones'], centro['cajas']), (5, 6))

    def test_disponibilidad_reserva_y_borrador_propio_cancelacion_y_permisos(self):
        despacho = self.crear_despacho()
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.destinos().data['count'], 0)
        self.assertEqual(self.destinos(despacho=despacho.pk).data['count'], 2)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 403)
        self.operar(despacho, 'cancelar')
        self.assertEqual(self.destinos().data['count'], 2)
        self.assertEqual(self.destinos(despacho=despacho.pk).status_code, 404)

    def test_version_abarca_todas_las_paginas_de_la_sucursal(self):
        nuevas = []
        for indice in range(11):
            detalle = self.crear_detalle(self.crear_pedido(self.centro), self.cajas, 1)
            nuevas.append(self.asignacion(detalle, 1, '1'))
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '11'}], asignaciones=nuevas))
        ruta = '/api/v1/despachos/disponibles/'
        filtros = {'almacen': self.almacen.pk, 'sucursal': self.centro.pk}
        primera = self.client.get(ruta, filtros)
        segunda = self.client.get(ruta, {**filtros, 'pagina': 2})
        self.assertEqual(primera.status_code, 200, primera.data)
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (12, 10, 2))
        self.assertEqual(primera.data['version_carga'], segunda.data['version_carga'])
        self.crear_despacho()
        cambiada = self.client.get(ruta, filtros)
        self.assertEqual(cambiada.data['count'], 11)
        self.assertNotEqual(cambiada.data['version_carga'], primera.data['version_carga'])

    def test_cambio_durante_lectura_no_entrega_una_seleccion_inconsistente(self):
        with patch('despachos.vistas.version_carga_disponible', side_effect=['anterior', 'nueva']):
            respuesta = self.client.get('/api/v1/despachos/disponibles/', {'almacen': self.almacen.pk, 'sucursal': self.centro.pk})
        self.assertEqual(respuesta.status_code, 409)


    def test_varios_lotes_no_multiplican_cantidades_ni_peso(self):
        recepcion, _ = guardar_recepcion(self.actor, {'compra': None, 'almacen': self.almacen.pk, 'fecha_recepcion': str(self.hoy),
            'clave_operacion': str(uuid.uuid4()), 'detalles': [{'producto': self.producto.pk, 'unidad_inventario': self.kg.pk, 'cantidad_inventario': '10'}]})
        confirmar_recepcion(self.actor, recepcion, {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4())})
        otro = Lote.objects.exclude(pk=self.lote.pk).get()
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '2'}, {'lote': otro.pk, 'cantidad_utilizada': '2'}],
            asignaciones=[{'detalle_pedido': self.centro_uni.pk, 'cantidad': 4,
                'aportes': [{'lote': self.lote.pk, 'cantidad': '2'}, {'lote': otro.pk, 'cantidad': '2'}]}]))
        respuesta = self.destinos(buscar='Centro')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        fila = respuesta.data['results'][0]
        self.assertEqual((fila['asignaciones'], fila['productos'], fila['cajas'], fila['unidades'], fila['peso_kg']), (2, 1, 2, 4, '24.000'))
        self.centro.activo = False
        self.centro.save(update_fields=['activo'])
        self.assertEqual(self.destinos().data['count'], 1)
        self.cliente.activo = False
        self.cliente.save(update_fields=['activo'])
        self.assertEqual(self.destinos().data['count'], 0)

    def pedidos_carga(self, **filtros):
        return self.client.get('/api/v1/despachos/pedidos-disponibles/', {
            'almacen': self.almacen.pk, 'sucursal': self.centro.pk, **filtros})

    def test_pedidos_identifica_codigo_fecha_y_resume_cant_uni_de_la_preparacion(self):
        pedido = self.crear_pedido(self.centro)
        detalle = self.crear_detalle(pedido, self.cajas, 2)
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '8'}],
            asignaciones=[self.asignacion(self.centro_uni, 4, '4'), self.asignacion(detalle, 2, '4')]))
        respuesta = self.pedidos_carga()
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 2)
        primero = respuesta.data['results'][0]
        self.assertEqual((primero['pedido'], primero['codigo_pedido'], primero['fecha_requerida']),
                         (self.pedido_centro.pk, self.pedido_centro.codigo, str(self.hoy)))
        self.assertEqual((primero['asignaciones'], primero['productos'], primero['cajas'], primero['unidades'], primero['peso_kg']),
                         (2, 1, 2, 4, '24.000'))
        centro = next(fila for fila in self.destinos().data['results'] if fila['sucursal'] == self.centro.pk)
        self.assertEqual((centro['pedidos'], centro['asignaciones']), (2, 3))
        productos = self.client.get('/api/v1/despachos/disponibles/', {
            'almacen': self.almacen.pk, 'sucursal': self.centro.pk, 'pedido': pedido.pk})
        self.assertEqual(productos.data['count'], 1)
        self.assertTrue(all(fila['pedido'] == pedido.pk for fila in productos.data['results']))
        ajeno = self.client.get('/api/v1/despachos/disponibles/', {
            'almacen': self.almacen.pk, 'sucursal': self.norte.pk, 'pedido': pedido.pk})
        self.assertEqual(ajeno.data['count'], 0)

    def test_pedidos_filtra_fecha_requerida_antes_de_agrupar(self):
        manana = self.hoy + timedelta(days=1)
        pedido = self.crear_pedido(self.centro, fecha_requerida=manana)
        detalle = self.crear_detalle(pedido, self.cajas, 1)
        self.confirmar(self.crear(fecha_pedidos=str(manana),
            lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '5'}],
            asignaciones=[self.asignacion(detalle, 1, '5')]))
        self.assertEqual(self.pedidos_carga().data['count'], 2)
        respuesta = self.pedidos_carga(fecha=str(manana))
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(respuesta.data['results'][0]['pedido'], pedido.pk)
        self.assertEqual(self.pedidos_carga(fecha=str(self.hoy)).data['count'], 1)

    def test_pagina_diez_pedidos_completos_y_no_diez_productos(self):
        asignaciones = []
        for indice in range(11):
            pedido = self.crear_pedido(self.centro)
            cajas = self.crear_detalle(pedido, self.cajas, 1)
            unidades = self.crear_detalle(pedido, self.unidades, 1)
            asignaciones += [self.asignacion(cajas, 1, '1'), self.asignacion(unidades, 1, '1')]
        self.confirmar(self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '22'}], asignaciones=asignaciones))
        primera = self.pedidos_carga()
        segunda = self.pedidos_carga(pagina=2)
        self.assertEqual(primera.status_code, 200, primera.data)
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (12, 10, 2))
        self.assertEqual(len({fila['pedido'] for fila in primera.data['results'] + segunda.data['results']}), 12)
        self.assertEqual(segunda.data['results'][0]['asignaciones'], 2)

    def test_pedidos_solo_carga_disponible_y_permiso_operativo_sin_administrar_pedidos(self):
        despacho = self.crear_despacho()
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename='view_despacho'))
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.pedidos_carga().data['count'], 0)
        self.assertEqual(self.pedidos_carga(despacho=despacho.pk).data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/pedidos/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/despachos/pedidos-disponibles/', {'almacen': self.almacen.pk}).status_code, 400)
        self.assertEqual(self.pedidos_carga(fecha='fecha-invalida').status_code, 400)
        self.operar(despacho, 'cancelar')
        self.assertEqual(self.pedidos_carga().data['count'], 1)
        self.assertEqual(self.pedidos_carga(despacho=despacho.pk).status_code, 404)
