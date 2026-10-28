import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from django.utils import timezone
from auditoria.models import RegistroActividad
from catalogos.models import CategoriaProducto, UnidadMedida
from productos.models import Producto
from proveedores.models import Proveedor
from usuarios.models import Usuario
from .models import Compra
from .servicios import guardar_compra, registrar_compra, version_compra, ConflictoCompra


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaCompras(TransactionTestCase):
    def setUp(self):
        self.actor = Usuario.objects.create_superuser(email='concurrencia@compras.test', cedula_identidad='830004', password='ComprasSeguras_2026!')
        categoria = CategoriaProducto.objects.create(nombre='Frutas')
        unidad = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        self.producto = Producto.objects.create(nombre='Manzana', categoria=categoria, unidad_medida=unidad)
        self.proveedor = Proveedor.objects.create(nombre='Proveedor concurrente')
        self.datos = {'fecha_pedidos': timezone.localdate().isoformat(), 'fecha_compra': timezone.localdate().isoformat(),
                      'detalles': [{'producto': self.producto.pk, 'presentacion': None, 'proveedor': self.proveedor.pk, 'cantidad': '1', 'precio_unitario': '1'}],
                      'clave_operacion': str(uuid.uuid4())}
        self.compra = guardar_compra(self.actor, self.datos)[0]

    def ejecutar(self, tarea):
        barrera = Barrier(2)

        def trabajo(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                compra = Compra.objects.get(pk=self.compra.pk)
                barrera.wait(timeout=10)
                try:
                    return tarea(actor, compra, indice)
                except ConflictoCompra:
                    return 409
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            return list(ejecutor.map(trabajo, [0, 1]))

    def test_ediciones_concurrentes_no_sobrescriben(self):
        version = version_compra(self.compra)

        def editar(actor, compra, indice):
            datos = {campo: valor for campo, valor in self.datos.items() if campo != 'clave_operacion'}
            datos.update(version=version, observaciones=f'Edición {indice}')
            guardar_compra(actor, datos, compra)
            return 200

        self.assertEqual(sorted(self.ejecutar(editar)), [200, 409])

    def test_reintentos_concurrentes_de_creacion_no_duplican(self):
        datos = {**self.datos, 'clave_operacion': str(uuid.uuid4())}

        def crear(actor, compra, indice):
            _, creada = guardar_compra(actor, datos)
            return 201 if creada else 200

        self.assertEqual(sorted(self.ejecutar(crear)), [200, 201])
        self.assertEqual(Compra.objects.count(), 2)

    def test_reintento_de_registro_concurrente_solo_audita_una_vez(self):
        datos = {'version': version_compra(self.compra), 'clave_operacion': str(uuid.uuid4())}

        def registrar(actor, compra, indice):
            registrar_compra(actor, compra, datos)
            return 200

        self.assertEqual(self.ejecutar(registrar), [200, 200])
        self.assertEqual(RegistroActividad.objects.filter(modulo='compras', accion='registrar', objeto_id=str(self.compra.pk)).count(), 1)
