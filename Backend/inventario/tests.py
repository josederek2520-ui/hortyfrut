from datetime import date, timedelta
from unittest.mock import patch
from django.db import transaction
from django.test import TestCase
from rest_framework.test import APIClient
from almacenes.models import Almacen
from recepciones.tests import DatosRecepciones
from .models import Lote, SecuenciaLote
from .servicios import _crear_lote_con_codigo, cambiar_estado_lote, version_lote


class PruebasCodigosLote(DatosRecepciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def datos_lote(self, fecha, almacen=None):
        almacen = almacen or self.almacen
        return {
            'producto': self.producto, 'unidad': self.kg, 'almacen_origen': almacen,
            'producto_nombre': self.producto.nombre, 'unidad_nombre': self.kg.nombre,
            'unidad_abreviatura': self.kg.abreviatura, 'almacen_nombre': almacen.nombre,
            'fecha_ingreso': fecha,
        }

    def test_fecha_ingreso_y_consecutivo_compartido_entre_almacenes(self):
        fecha = date(2026, 10, 28)
        otro_almacen = Almacen.objects.create(nombre='Norte', direccion='Calle Dos')
        primero = _crear_lote_con_codigo(**self.datos_lote(fecha))
        segundo = _crear_lote_con_codigo(**self.datos_lote(fecha, otro_almacen))
        siguiente_dia = _crear_lote_con_codigo(**self.datos_lote(fecha + timedelta(days=1)))
        self.assertEqual(primero.codigo, 'L281026-01')
        self.assertEqual(segundo.codigo, 'L281026-02')
        self.assertEqual(siguiente_dia.codigo, 'L291026-01')
        self.assertEqual(SecuenciaLote.objects.get(fecha=fecha).ultimo, 2)

    def test_contador_admite_mas_de_noventa_y_nueve_lotes(self):
        fecha = date(2026, 10, 28)
        SecuenciaLote.objects.create(fecha=fecha, ultimo=99)
        lote = _crear_lote_con_codigo(**self.datos_lote(fecha))
        self.assertEqual(lote.codigo, 'L281026-100')

    def test_codigo_historico_y_codigo_nuevo_se_conservan_al_bloquear(self):
        historico = Lote.objects.create(**self.datos_lote(self.hoy))
        codigo_anterior = f'LOT-{historico.pk:06d}'
        nuevo = _crear_lote_con_codigo(**self.datos_lote(self.hoy))
        codigo_nuevo = nuevo.codigo
        for lote in (historico, nuevo):
            cambiar_estado_lote(self.actor, lote, {'estado': 'bloqueado', 'version': version_lote(lote)})
            lote.refresh_from_db()
        self.assertEqual(historico.codigo, codigo_anterior)
        self.assertIsNone(historico.codigo_lote)
        self.assertEqual(nuevo.codigo, codigo_nuevo)
        self.assertEqual(SecuenciaLote.objects.get(fecha=self.hoy).ultimo, 1)

    def test_fallo_de_auditoria_revierte_lote_y_consecutivo_en_la_misma_transaccion(self):
        recepcion = self.crear()
        with patch('inventario.servicios.registrar_actividad', side_effect=RuntimeError('Fallo de auditoría')):
            with self.assertRaises(RuntimeError):
                self.confirmar(recepcion)
        self.assertFalse(Lote.objects.exists())
        self.assertFalse(SecuenciaLote.objects.exists())
        recepcion.refresh_from_db()
        self.confirmar(recepcion)
        self.assertEqual(Lote.objects.get().codigo, f'L{self.hoy:%d%m%y}-01')

    def test_una_transaccion_revertida_no_consume_el_consecutivo(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                _crear_lote_con_codigo(**self.datos_lote(self.hoy))
                raise RuntimeError('Revertir operación')
        self.assertFalse(SecuenciaLote.objects.exists())
        self.assertTrue(_crear_lote_con_codigo(**self.datos_lote(self.hoy)).codigo.endswith('-01'))

    def test_busqueda_por_codigo_nuevo_parcial_antiguo_y_numero(self):
        nuevo = _crear_lote_con_codigo(**self.datos_lote(self.hoy))
        historico = Lote.objects.create(**self.datos_lote(self.hoy))
        cliente = APIClient()
        cliente.force_authenticate(self.actor)
        ruta = '/api/v1/inventario/lotes/'
        for buscar in (nuevo.codigo, nuevo.codigo.lower(), nuevo.codigo[:-2]):
            respuesta = cliente.get(ruta, {'buscar': buscar})
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            self.assertIn(nuevo.pk, [fila['id'] for fila in respuesta.data['results']])
        for buscar in (historico.codigo, str(historico.pk)):
            self.assertEqual(cliente.get(ruta, {'buscar': buscar}).data['results'][0]['id'], historico.pk)
        self.assertEqual(cliente.get(ruta, {'buscar': self.producto.nombre}).data['count'], 2)
        for buscar in ('9' * 150, '²', 'LOT-9223372036854775808'):
            self.assertEqual(cliente.get(ruta, {'buscar': buscar}).status_code, 200)
