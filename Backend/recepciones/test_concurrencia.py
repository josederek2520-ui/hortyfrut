from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from rest_framework.exceptions import APIException
from usuarios.models import Usuario
from inventario.models import MovimientoInventario
from .tests import DatosRecepciones
from .models import Recepcion
from .servicios import confirmar_recepcion
from .consultas import avance_compra
from compras.models import Compra
from compras.servicios import cancelar_compra, version_compra


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaRecepciones(DatosRecepciones, TransactionTestCase):
    def setUp(self):
        self.preparar_datos()

    def test_dos_recepciones_no_superan_la_compra(self):
        compra = self.compra()
        recepciones = [self.crear(compra), self.crear(compra)]
        barrera = Barrier(2)

        def confirmar(recepcion):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                instancia = Recepcion.objects.get(pk=recepcion.pk)
                barrera.wait(timeout=10)
                try:
                    confirmar_recepcion(actor, instancia, self.accion(instancia))
                    return 'confirmada'
                except APIException:
                    return 'rechazada'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(confirmar, recepciones))
        self.assertCountEqual(resultados, ['confirmada', 'rechazada'])
        self.assertEqual(MovimientoInventario.objects.count(), 1)
        self.assertEqual(str(avance_compra(compra.pk)[compra.detalles.get().pk]), '8.000')

    def test_reintentos_simultaneos_confirmacion_solo_crean_un_ingreso(self):
        recepcion = self.crear()
        accion = self.accion(recepcion)
        barrera = Barrier(2)

        def confirmar(_):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                instancia = Recepcion.objects.get(pk=recepcion.pk)
                barrera.wait(timeout=10)
                return confirmar_recepcion(actor, instancia, accion).pk
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(confirmar, [0, 1]))
        self.assertEqual(resultados, [recepcion.pk, recepcion.pk])
        self.assertEqual(MovimientoInventario.objects.count(), 1)

    def test_crear_recepcion_y_cancelar_compra_comparten_bloqueo(self):
        compra = self.compra()
        datos = self.datos(compra)
        barrera = Barrier(2)

        def ejecutar(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                instancia = Compra.objects.get(pk=compra.pk)
                barrera.wait(timeout=10)
                try:
                    if indice == 0:
                        from .servicios import guardar_recepcion
                        guardar_recepcion(actor, datos)
                    else:
                        from uuid import uuid4
                        cancelar_compra(actor, instancia, {'version': version_compra(instancia), 'clave_operacion': str(uuid4()), 'motivo': 'Revisión'})
                    return 'aceptada'
                except APIException:
                    return 'rechazada'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            resultados = list(ejecutor.map(ejecutar, [0, 1]))
        self.assertCountEqual(resultados, ['aceptada', 'rechazada'])
        compra.refresh_from_db()
        self.assertFalse(compra.estado == 'cancelada' and compra.recepciones.exclude(estado='cancelada').exists())
