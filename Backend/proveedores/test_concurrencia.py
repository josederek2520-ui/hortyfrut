from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from auditoria.models import RegistroActividad
from usuarios.models import Usuario
from .models import Proveedor
from .servicios import guardar_proveedor, version_proveedor, ConflictoProveedor


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaProveedores(TransactionTestCase):
    def test_dos_ediciones_no_sobrescriben_la_misma_version(self):
        actor = Usuario.objects.create_superuser(email='concurrencia@proveedores.test', cedula_identidad='780004', password='ProveedoresSeguros_2026!')
        proveedor = Proveedor.objects.create(nombre='Proveedor concurrente')
        version = version_proveedor(proveedor)
        barrera = Barrier(2)

        def editar(telefono):
            close_old_connections()
            try:
                usuario = Usuario.objects.get(pk=actor.pk)
                instancia = Proveedor.objects.get(pk=proveedor.pk)
                barrera.wait(timeout=10)
                try:
                    guardar_proveedor(usuario, {'telefono': telefono, 'version': version}, instancia)
                    return 200
                except ConflictoProveedor:
                    return 409
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(editar, ['00111', '00222']))
        self.assertEqual(sorted(resultados), [200, 409])
        proveedor.refresh_from_db()
        self.assertIn(proveedor.telefono, ['00111', '00222'])
        self.assertEqual(RegistroActividad.objects.filter(modulo='proveedores', accion='editar', objeto_id=str(proveedor.pk)).count(), 1)
