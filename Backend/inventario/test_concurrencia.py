from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections, transaction
from django.test import TransactionTestCase, skipUnlessDBFeature
from productos.models import Producto
from recepciones.tests import DatosRecepciones
from usuarios.models import Usuario
from recepciones.models import Recepcion
from recepciones.servicios import confirmar_recepcion
from .models import Lote, SecuenciaLote, MovimientoInventario
from .servicios import _crear_lote_con_codigo


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaCodigos(DatosRecepciones, TransactionTestCase):
    def setUp(self):
        self.preparar_datos()

    def test_primera_secuencia_del_dia_y_numeros_sucesivos_son_unicos(self):
        barrera = Barrier(4)

        def crear(_):
            close_old_connections()
            try:
                with transaction.atomic():
                    barrera.wait(timeout=10)
                    return _crear_lote_con_codigo(
                        producto_id=self.producto.pk, unidad_id=self.kg.pk, almacen_origen_id=self.almacen.pk,
                        producto_nombre='Manzana', unidad_nombre='Kilogramo', unidad_abreviatura='kg',
                        almacen_nombre='Central', fecha_ingreso=self.hoy,
                    ).codigo
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=4) as ejecutor:
            codigos = list(ejecutor.map(crear, range(4)))
        self.assertEqual(len(set(codigos)), 4)
        self.assertEqual(set(codigos), {f'L{self.hoy:%d%m%y}-{numero:02d}' for numero in range(1, 5)})
        self.assertEqual(SecuenciaLote.objects.get(fecha=self.hoy).ultimo, 4)

    def test_recepciones_de_distintos_productos_comparten_contador_sin_duplicar(self):
        otro_producto = Producto.objects.create(nombre='Papaya', categoria=self.categoria, unidad_medida=self.kg)
        primera = self.crear()
        segunda = self.crear(detalles=[{'producto': otro_producto.pk, 'unidad_inventario': self.kg.pk, 'cantidad_inventario': '20'}])
        barrera = Barrier(2)

        def confirmar(identificador):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                recepcion = Recepcion.objects.get(pk=identificador)
                accion = self.accion(recepcion)
                barrera.wait(timeout=10)
                confirmar_recepcion(actor, recepcion, accion)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            list(ejecutor.map(confirmar, [primera.pk, segunda.pk]))
        self.assertEqual(Lote.objects.count(), 2)
        self.assertEqual(len({lote.codigo for lote in Lote.objects.all()}), 2)
        self.assertEqual(SecuenciaLote.objects.get(fecha=self.hoy).ultimo, 2)
        self.assertEqual(MovimientoInventario.objects.count(), 2)
