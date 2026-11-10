from datetime import timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from clientes.models import Cliente, Sucursal
from pedidos.models import Pedido
from auditoria.models import RegistroActividad
from .tests import DatosPreparaciones


class PruebasJornadasPreparacion(DatosPreparaciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def consultar(self, **filtros):
        respuesta = self.client.get('/api/v1/preparaciones/jornadas/', filtros)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data

    def test_agrupa_sucursales_y_pedidos_sin_multiplicar_productos(self):
        self.crear_detalle(self.crear_pedido(self.centro), self.cajas, 1)
        fila = self.consultar()['results'][0]
        self.assertEqual((fila['cliente'], fila['fecha_pedidos']), (self.cliente.pk, str(self.hoy)))
        self.assertEqual((fila['pedidos'], fila['sucursales'], fila['productos']), (3, 2, 1))
        self.assertEqual(fila['estado'], 'pendiente')

    def test_borradores_y_cancelaciones_no_marcan_cantidades_preparadas(self):
        preparacion = self.crear()
        fila = self.consultar()['results'][0]
        self.assertEqual((fila['estado'], fila['borradores'], fila['borrador_id']), ('pendiente', 1, preparacion.pk))
        from .servicios import cancelar_preparacion
        cancelar_preparacion(self.actor, preparacion, self.accion(preparacion, motivo='No se preparo'))
        fila = self.consultar()['results'][0]
        self.assertEqual((fila['estado'], fila['borradores'], fila['canceladas']), ('pendiente', 0, 1))

    def test_varias_tandas_permanecen_en_un_grupo_y_cant_uni_se_atienden_por_separado(self):
        self.confirmar(self.crear())
        datos = self.consultar()
        self.assertEqual(datos['count'], 1)
        self.assertEqual((datos['results'][0]['estado'], datos['results'][0]['confirmadas']), ('parcial', 1))
        segunda = self.crear(lineas=[{'lote': self.lote.pk, 'cantidad_utilizada': '10'}],
            asignaciones=[self.asignacion(self.centro_uni, 4, '4'), self.asignacion(self.norte_uni, 6, '6')])
        self.assertEqual(self.consultar()['results'][0]['estado'], 'parcial')
        self.confirmar(segunda)
        datos = self.consultar(estado='preparado')
        self.assertEqual(datos['count'], 1)
        self.assertEqual((datos['results'][0]['confirmadas'], datos['results'][0]['borradores']), (2, 0))
        self.assertEqual(self.consultar(estado='parcial')['count'], 0)

    def test_clientes_y_fechas_diferentes_se_mantienen_separados(self):
        otro = Cliente.objects.create(razon_social='Otro cliente', nit='94099')
        sucursal = Sucursal.objects.create(cliente=otro, nombre='Nueva', direccion='Calle')
        self.crear_detalle(self.crear_pedido(sucursal), self.cajas, 1)
        self.crear_detalle(self.crear_pedido(self.centro, fecha_requerida=self.hoy + timedelta(days=1)), self.cajas, 1)
        self.crear_detalle(self.crear_pedido(self.centro, estado='cancelado'), self.cajas, 99)
        self.assertEqual(self.consultar()['count'], 3)
        filtrada = self.consultar(cliente=self.cliente.pk, fecha_pedidos=str(self.hoy))
        self.assertEqual(filtrada['count'], 1)
        self.assertEqual(filtrada['results'][0]['pedidos'], 2)
        self.assertEqual(self.consultar(buscar='Otro')['count'], 1)

    def test_pagina_diez_grupos_despues_de_agrupar_y_filtrar(self):
        for numero in range(1, 12):
            fecha = self.hoy + timedelta(days=numero)
            for sucursal in (self.centro, self.norte):
                self.crear_detalle(self.crear_pedido(sucursal, fecha_requerida=fecha), self.cajas, 1)
        primera, segunda = self.consultar(), self.consultar(pagina=2)
        self.assertEqual(primera['count'], 12)
        self.assertEqual((len(primera['results']), len(segunda['results'])), (10, 2))
        claves = {(fila['cliente'], fila['fecha_pedidos']) for fila in primera['results'] + segunda['results']}
        self.assertEqual(len(claves), 12)
        self.confirmar(self.crear())
        parcial = self.consultar(estado='parcial')
        self.assertEqual(parcial['count'], 1)
        self.assertEqual(parcial['results'][0]['fecha_pedidos'], str(self.hoy))

    def test_sin_pedidos_activos_no_se_presenta_como_preparado(self):
        Pedido.objects.all().update(estado='cancelado')
        fila = self.consultar()['results'][0]
        self.assertEqual((fila['estado'], fila['pedidos'], fila['sucursales'], fila['productos']), ('sin_pedidos', 0, 0, 0))

    def test_consulta_respeta_permiso_operativo_y_auditoria(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.consultar()['count'], 1)
        self.assertTrue(RegistroActividad.objects.filter(modulo='preparaciones', ruta__contains='jornadas').exists())
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/preparaciones/jornadas/').status_code, 401)

    def test_filtros_invalidos_rechazados_y_contrato_anterior_conservado(self):
        self.assertEqual(self.client.get('/api/v1/preparaciones/jornadas/', {'estado': 'borrador'}).status_code, 400)
        self.assertEqual(self.client.get('/api/v1/preparaciones/jornadas/', {'fecha_pedidos': 'invalida'}).status_code, 400)
        self.crear()
        self.assertEqual(self.client.get('/api/v1/preparaciones/').data['count'], 1)
