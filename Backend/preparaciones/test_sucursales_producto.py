from django.test import TestCase
from rest_framework.test import APIClient
from usuarios.models import Usuario
from pedidos.models import Pedido
from clientes.models import Cliente, Sucursal
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla
from .tests import DatosPreparaciones
from .models import Preparacion


class PruebasSucursalesProducto(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.navegador = APIClient()
        self.navegador.force_authenticate(self.actor)
        self.parametros = {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy), 'producto': self.producto.pk}

    def consultar(self, **cambios):
        return self.navegador.get('/api/v1/preparaciones/sucursales-producto/', {**self.parametros, **cambios})

    def test_agrupa_sucursales_antes_de_paginar_sin_duplicar_pedidos_cant_y_uni(self):
        for indice in range(12):
            pedido = self.crear_pedido(self.centro)
            pedido.sucursal_nombre = 'Centro anterior'; pedido.save()
            self.crear_detalle(pedido, self.cajas, 1)
            sucursal = Sucursal.objects.create(cliente=self.cliente, nombre=f'Sucursal {indice:02}', direccion='Prueba')
            self.crear_detalle(self.crear_pedido(sucursal), self.cajas, 1)
        primera, segunda = self.consultar(), self.consultar(pagina=2)
        self.assertEqual(primera.status_code, 200)
        self.assertEqual(primera.data['count'], 14)
        self.assertEqual((len(primera.data['results']), len(segunda.data['results'])), (10, 4))
        filas = primera.data['results'] + segunda.data['results']
        self.assertEqual(len({fila['id'] for fila in filas}), 14)
        centro = next(fila for fila in filas if fila['id'] == self.centro.pk)
        self.assertEqual((centro['pedidos'], centro['lineas']), (13, 14))

    def test_filtra_pedidos_por_sucursal_antes_de_paginar_y_conserva_consulta_anterior(self):
        for _ in range(12):
            self.crear_detalle(self.crear_pedido(self.centro), self.cajas, 1)
        primera = self.navegador.get('/api/v1/preparaciones/necesidades/', {**self.parametros, 'sucursal': self.centro.pk})
        segunda = self.navegador.get('/api/v1/preparaciones/necesidades/', {**self.parametros, 'sucursal': self.centro.pk, 'pagina': 2})
        self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (14, 10, 4))
        self.assertTrue(all(fila['sucursal'] == self.centro.pk for fila in primera.data['results'] + segunda.data['results']))
        anterior = self.navegador.get('/api/v1/preparaciones/necesidades/', self.parametros)
        self.assertEqual(anterior.data['count'], 16)

    def test_contexto_busqueda_y_estados_no_mezclan_destinos(self):
        otro_cliente = Cliente.objects.create(razon_social='Ajeno', nit='112233')
        ajena = Sucursal.objects.create(cliente=otro_cliente, nombre='Ajena', direccion='Prueba')
        self.crear_detalle(self.crear_pedido(ajena), self.cajas, 1)
        self.assertEqual(self.consultar(buscar='Centro').data['count'], 1)
        self.assertEqual(self.consultar(producto=999999).data['count'], 0)
        self.assertNotIn(ajena.pk, [fila['id'] for fila in self.consultar().data['results']])
        Pedido.objects.filter(pk=self.pedido_centro.pk).update(estado='preparado')
        self.assertEqual([fila['id'] for fila in self.consultar().data['results']], [self.norte.pk])
        Pedido.objects.filter(pk=self.pedido_norte.pk).update(estado='cancelado')
        self.assertEqual(self.consultar().data['count'], 0)

    def test_consulta_exige_contexto_y_permiso_sin_mutar_operaciones(self):
        antes = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), Preparacion.objects.count())
        self.navegador.force_authenticate(self.lector)
        self.assertEqual(self.consultar().status_code, 200)
        self.assertEqual(self.navegador.get('/api/v1/preparaciones/sucursales-producto/', {'cliente': self.cliente.pk, 'fecha_pedidos': str(self.hoy)}).status_code, 400)
        self.assertEqual(self.navegador.get('/api/v1/preparaciones/sucursales-producto/', {'producto': self.producto.pk}).status_code, 400)
        sin_acceso = Usuario.objects.create_user(email='sinacceso@sucursales.test', cedula_identidad='94005')
        self.navegador.force_authenticate(sin_acceso)
        self.assertEqual(self.consultar().status_code, 403)
        self.navegador.force_authenticate(None)
        self.assertIn(self.consultar().status_code, (401, 403))
        self.assertEqual(antes, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count(), Preparacion.objects.count()))
