import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from catalogos.models import CategoriaProducto, UnidadMedida
from clientes.models import Cliente, Sucursal
from productos.models import Producto, PresentacionProducto
from usuarios.models import Usuario
from .models import Pedido
from .servicios import guardar_pedido, obtener_version, ConflictoPedido


class PruebasConcurrenciaPedidos(TransactionTestCase):
    def setUp(self):
        self.actor = Usuario.objects.create_superuser(email='concurrencia@pedidos.test', cedula_identidad='820001', password='ConcurrenciaSegura_2026!')
        cliente = Cliente.objects.create(razon_social='Cliente concurrente', nit='820001')
        self.sucursal = Sucursal.objects.create(cliente=cliente, nombre='Sucursal concurrente', direccion='Dirección de prueba')
        categoria = CategoriaProducto.objects.create(nombre='Categoría concurrente')
        unidad = UnidadMedida.objects.create(nombre='Unidad concurrente', abreviatura='uc')
        producto = Producto.objects.create(nombre='Producto concurrente', categoria=categoria, unidad_medida=unidad)
        presentacion = PresentacionProducto.objects.create(producto=producto, nombre='Caja', columna_pedido='cajas')
        self.datos = {'sucursal':self.sucursal.pk, 'fecha_requerida':str(timezone.localdate()), 'clave_operacion':str(uuid.uuid4()),
                      'detalles':[{'producto':producto.pk,'presentacion':presentacion.pk,'columna':'cajas','cantidad':2}]}

    def ejecutar_simultaneos(self, operacion):
        barrera = Barrier(2)
        def ejecutar():
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                return operacion(actor)
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            tareas = [ejecutor.submit(ejecutar) for _ in range(2)]
            return [tarea.result(timeout=20) for tarea in tareas]

    def test_dos_creaciones_simultaneas_con_la_misma_clave(self):
        resultados = self.ejecutar_simultaneos(lambda actor: guardar_pedido(actor,self.datos)[1])
        self.assertEqual(sorted(resultados),[False,True])
        self.assertEqual(Pedido.objects.count(),1)

    def test_dos_ediciones_simultaneas_no_sobrescriben_la_misma_version(self):
        pedido,_ = guardar_pedido(self.actor,self.datos)
        datos = {campo:valor for campo,valor in self.datos.items() if campo not in ('sucursal','clave_operacion')}
        datos.update(version=obtener_version(pedido),observaciones='Edición concurrente')
        def editar(actor):
            try:
                guardar_pedido(actor,datos,pedido)
                return 'guardado'
            except ConflictoPedido:
                return 'conflicto'
        self.assertEqual(sorted(self.ejecutar_simultaneos(editar)),['conflicto','guardado'])
