from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from usuarios.models import Usuario
from .models import Almacen
from .servicios import guardar_almacen, version_almacen, ConflictoAlmacen


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaAlmacenes(TransactionTestCase):
    def test_dos_cambios_de_coordenadas_no_sobrescriben(self):
        actor = Usuario.objects.create_superuser(email='concurrencia@almacenes.test', cedula_identidad='840004', password='AlmacenesSeguros_2026!')
        almacen = Almacen.objects.create(nombre='Concurrente', direccion='Dirección', latitud=0, longitud=0)
        version = version_almacen(almacen)
        barrera = Barrier(2)

        def editar(campo):
            close_old_connections()
            try:
                usuario = Usuario.objects.get(pk=actor.pk)
                instancia = Almacen.objects.get(pk=almacen.pk)
                barrera.wait(timeout=10)
                try:
                    guardar_almacen(usuario, {campo: '10', 'version': version}, instancia)
                    return 200
                except ConflictoAlmacen:
                    return 409
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(editar, ['latitud', 'longitud']))
        self.assertEqual(sorted(resultados), [200, 409])
        almacen.refresh_from_db()
        self.assertIn((almacen.latitud, almacen.longitud), [(Decimal('10'), Decimal('0')), (Decimal('0'), Decimal('10'))])
