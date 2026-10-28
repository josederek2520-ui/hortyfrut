import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError, PermissionDenied
from usuarios.models import Usuario
from catalogos.models import CategoriaProducto, UnidadMedida
from catalogos.servicios import guardar_catalogo, version_catalogo
from productos.models import Producto, PresentacionProducto
from proveedores.models import Proveedor
from almacenes.models import Almacen
from compras.servicios import guardar_compra, registrar_compra, cancelar_compra, version_compra, ConflictoCompra
from inventario.models import Lote, MovimientoInventario, DetalleMovimientoInventario
from inventario.consultas import lotes_con_saldo
from inventario.servicios import habilitar_unidad, cambiar_unidad, cambiar_estado_lote, datos_unidad, version_lote, ConflictoInventario
from .models import Recepcion
from .servicios import guardar_recepcion, confirmar_recepcion, cancelar_recepcion, version_recepcion, ConflictoRecepcion
from .consultas import avance_compra


class DatosRecepciones:
    @classmethod
    def preparar_datos(cls):
        cls.hoy = timezone.localdate()
        cls.actor = Usuario.objects.create_superuser(email='admin@recepciones.test', cedula_identidad='89001', password='Recepciones_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@recepciones.test', cedula_identidad='89002')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='recepciones', codename='view_recepcion'))
        cls.categoria = CategoriaProducto.objects.create(nombre='Frutas')
        cls.kg = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        cls.unidad = UnidadMedida.objects.create(nombre='Unidad', abreviatura='uni')
        cls.producto = Producto.objects.create(nombre='Manzana', categoria=cls.categoria, unidad_medida=cls.kg)
        cls.caja = PresentacionProducto.objects.create(producto=cls.producto, nombre='Caja', uso='compra')
        cls.proveedor = Proveedor.objects.create(nombre='Productor')
        cls.almacen = Almacen.objects.create(nombre='Central', direccion='Calle Uno')

    def compra(self, presentacion=True):
        compra, _ = guardar_compra(self.actor, {'fecha_pedidos': str(self.hoy), 'fecha_compra': str(self.hoy), 'clave_operacion': str(uuid.uuid4()),
            'detalles': [{'producto': self.producto.pk, 'presentacion': self.caja.pk if presentacion else None, 'proveedor': self.proveedor.pk, 'cantidad': '10', 'precio_unitario': '40'}]})
        return registrar_compra(self.actor, compra, {'version': version_compra(compra), 'clave_operacion': str(uuid.uuid4())})

    def datos(self, compra=None, **cambios):
        linea = {'producto': self.producto.pk, 'unidad_inventario': self.kg.pk, 'cantidad_inventario': '120',
                 'detalle_compra': compra.detalles.get().pk if compra else None, 'cantidad_compra': '8' if compra else '0'}
        return {'compra': compra.pk if compra else None, 'almacen': self.almacen.pk, 'fecha_recepcion': str(self.hoy),
                'detalles': [linea], 'clave_operacion': str(uuid.uuid4()), **cambios}

    def crear(self, compra=None, **cambios):
        return guardar_recepcion(self.actor, self.datos(compra, **cambios))[0]

    def accion(self, recepcion, **cambios):
        return {'version': version_recepcion(recepcion), 'clave_operacion': str(uuid.uuid4()), **cambios}

    def confirmar(self, recepcion):
        return confirmar_recepcion(self.actor, recepcion, self.accion(recepcion))


class PruebasRecepciones(DatosRecepciones, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def test_borrador_no_genera_stock_ni_avance(self):
        compra = self.compra()
        recepcion = self.crear(compra)
        self.assertEqual(recepcion.estado, 'borrador')
        self.assertFalse(Lote.objects.exists())
        self.assertFalse(MovimientoInventario.objects.exists())
        self.assertEqual(avance_compra(compra.pk), {})
        self.assertTrue(recepcion.creado_en)

    def test_hoja_pendientes_filtra_antes_de_paginar_y_conserva_proveedores(self):
        proveedores = [Proveedor.objects.create(nombre=f'Proveedor hoja {indice:02d}') for indice in range(12)]
        compra, _ = guardar_compra(self.actor, {
            'fecha_pedidos': str(self.hoy), 'fecha_compra': str(self.hoy), 'clave_operacion': str(uuid.uuid4()),
            'detalles': [{'producto': self.producto.pk, 'presentacion': None, 'proveedor': proveedor.pk,
                          'cantidad': '10', 'precio_unitario': '5'} for proveedor in proveedores],
        })
        compra = registrar_compra(self.actor, compra, {'version': version_compra(compra), 'clave_operacion': str(uuid.uuid4())})
        primera = compra.detalles.order_by('pk').first()
        datos = self.datos()
        datos.update(compra=compra.pk, detalles=[{
            'detalle_compra': primera.pk, 'producto': self.producto.pk, 'unidad_inventario': self.kg.pk,
            'cantidad_compra': '10', 'cantidad_inventario': '10',
        }])
        recibida = guardar_recepcion(self.actor, datos)[0]
        self.confirmar(recibida)
        filtros = {'compra': compra.pk, 'solo_pendientes': 'true', 'page_size': 100}
        ruta = '/api/v1/recepciones/compra-detalles/'
        respuesta = self.client.get(ruta, filtros)
        segunda = self.client.get(ruta, {**filtros, 'pagina': 2})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['count'], 11)
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(len(segunda.data['results']), 1)
        filas = respuesta.data['results'] + segunda.data['results']
        self.assertNotIn(primera.pk, [fila['id'] for fila in filas])
        self.assertEqual(len({fila['proveedor_nombre'] for fila in filas}), 11)
        self.assertTrue(all(fila['unidad_compra'] == self.kg.pk for fila in filas))
        self.assertTrue(all('precio_unitario' not in fila for fila in filas))
        self.assertEqual(self.client.get(ruta, {'compra': compra.pk}).data['count'], 12)
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get(ruta, filtros).status_code, 200)
        self.assertEqual(self.client.get(ruta, {**filtros, 'solo_pendientes': 'invalido'}).status_code, 400)

    def test_datos_revision_identifican_proveedor_unidad_base_y_pendiente_sin_equivalencias(self):
        compra = self.compra()
        recepcion = self.crear(compra)
        respuesta = self.client.get(f'/api/v1/recepciones/{recepcion.pk}/')
        linea = respuesta.data['detalles'][0]
        self.assertEqual(linea['proveedor_nombre'], 'Productor')
        self.assertIsNone(linea['unidad_compra'])  # Caja y kg se registran por separado.
        self.assertEqual(Decimal(linea['cantidad_pendiente']), Decimal('10'))
        self.confirmar(recepcion)
        respuesta = self.client.get(f'/api/v1/recepciones/{recepcion.pk}/')
        self.assertEqual(Decimal(respuesta.data['detalles'][0]['cantidad_pendiente']), Decimal('2'))
        directa = self.crear()
        linea = self.client.get(f'/api/v1/recepciones/{directa.pk}/').data['detalles'][0]
        self.assertEqual(linea['proveedor_nombre'], '')
        self.assertIsNone(linea['unidad_compra'])
        self.assertIsNone(linea['cantidad_pendiente'])

    def test_crear_revisar_confirmar_sin_permiso_editar_y_reintento_sin_duplicar_stock(self):
        compra = self.compra()
        operador = Usuario.objects.create_user(email='operador@recepciones.test', cedula_identidad='89003')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='recepciones',
            codename__in=['view_recepcion', 'add_recepcion', 'confirmar_recepcion']))
        self.client.force_authenticate(operador)
        borrador = self.client.post('/api/v1/recepciones/', self.datos(compra), format='json')
        self.assertEqual(borrador.status_code, 201, borrador.data)
        self.assertFalse(Lote.objects.exists())
        ruta = f"/api/v1/recepciones/{borrador.data['id']}/"
        self.assertEqual(self.client.get(ruta).status_code, 200)
        self.assertEqual(self.client.patch(ruta, {}, format='json').status_code, 403)
        accion = {'version': borrador.data['version'], 'clave_operacion': str(uuid.uuid4())}
        confirmada = self.client.post(f'{ruta}confirmar/', accion, format='json')
        self.assertEqual(confirmada.status_code, 200, confirmada.data)
        repetida = self.client.post(f'{ruta}confirmar/', accion, format='json')
        self.assertEqual(repetida.status_code, 200, repetida.data)
        self.assertEqual(Lote.objects.count(), 1)
        self.assertEqual(MovimientoInventario.objects.count(), 1)
        self.assertEqual(avance_compra(compra.pk)[compra.detalles.get().pk], Decimal('8'))

    def test_cajas_recibidas_y_kg_reales_son_independientes(self):
        compra = self.compra()
        recepcion = self.confirmar(self.crear(compra))
        self.assertEqual(avance_compra(compra.pk), {compra.detalles.get().pk: Decimal('8')})
        self.assertEqual(lotes_con_saldo().get().saldo, Decimal('120'))
        self.assertEqual(Lote.objects.get().peso_kg_ingreso, Decimal('120'))
        self.assertEqual(recepcion.movimiento.referencia_id, recepcion.pk)
        detalle = self.client.get(f'/api/v1/compras/{compra.pk}/').data['detalles'][0]
        self.assertEqual(Decimal(detalle['cantidad_pendiente']), Decimal('2'))

    def test_confirmacion_reintentada_no_duplica_ingreso(self):
        recepcion = self.crear()
        accion = self.accion(recepcion)
        confirmar_recepcion(self.actor, recepcion, accion)
        confirmar_recepcion(self.actor, recepcion, accion)
        self.assertEqual(MovimientoInventario.objects.count(), 1)
        self.assertEqual(Lote.objects.count(), 1)
        self.assertEqual(DetalleMovimientoInventario.objects.count(), 1)

    def test_creacion_idempotente_y_clave_no_reutilizable(self):
        datos = self.datos()
        primero, creado = guardar_recepcion(self.actor, datos)
        segundo, creado = guardar_recepcion(self.actor, datos)
        self.assertFalse(creado)
        self.assertEqual(primero.pk, segundo.pk)
        with self.assertRaises(ConflictoRecepcion):
            guardar_recepcion(self.actor, {**datos, 'observaciones': 'Otros datos'})

    def test_parciales_no_superan_pendiente(self):
        compra = self.compra()
        otra = self.crear(compra)
        self.confirmar(self.crear(compra))
        with self.assertRaises(ValidationError):
            self.confirmar(otra)
        self.assertEqual(Lote.objects.count(), 1)
        datos = self.datos(compra)
        datos['detalles'][0]['cantidad_compra'] = '2'
        recepcion = guardar_recepcion(self.actor, datos)[0]
        self.confirmar(recepcion)
        self.assertEqual(avance_compra(compra.pk)[compra.detalles.get().pk], Decimal('10'))
        self.assertEqual(self.client.get('/api/v1/recepciones/compras/').data['count'], 0)

    def test_misma_unidad_sin_presentacion_exige_igual_medicion(self):
        recepcion = self.crear(self.compra(presentacion=False))
        with self.assertRaises(ValidationError):
            self.confirmar(recepcion)

    def test_ingreso_directo_no_inventa_compra(self):
        recepcion = self.confirmar(self.crear())
        self.assertIsNone(recepcion.compra_id)
        datos = self.datos()
        datos['detalles'][0]['cantidad_compra'] = '1'
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, datos)

    def test_kg_no_admite_peso_contradictorio(self):
        datos = self.datos()
        datos['detalles'][0]['peso_kg'] = '119'
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, datos)

    def test_unidad_extra_habilitada_sin_equivalencias(self):
        datos = self.datos()
        datos['detalles'][0].update(unidad_inventario=self.unidad.pk, cantidad_inventario='7', peso_kg='20')
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, datos)
        habilitar_unidad(self.actor, self.producto.pk, {'unidad': self.unidad.pk})
        recepcion = self.confirmar(guardar_recepcion(self.actor, datos)[0])
        lote = lotes_con_saldo().get()
        self.assertEqual(lote.saldo, Decimal('7'))
        self.assertEqual(lote.peso_kg_ingreso, Decimal('20'))
        configuracion = self.producto.unidades_inventario.get()
        cambiar_unidad(self.actor, self.producto.pk, self.unidad.pk, {'activo': False, 'version': datos_unidad(self.producto, self.unidad, configuracion)['version']})
        self.assertEqual(lotes_con_saldo().get().saldo, Decimal('7'))
        self.assertEqual(recepcion.estado, 'confirmada')

    def test_unidad_base_no_se_puede_inhabilitar(self):
        with self.assertRaises(ValidationError):
            cambiar_unidad(self.actor, self.producto.pk, self.kg.pk, {'activo': False, 'version': datos_unidad(self.producto, self.kg)['version']})

    def test_revalida_referencias_al_confirmar(self):
        for referencia in (self.producto, self.categoria, self.kg, self.almacen):
            recepcion = self.crear()
            referencia.activo = False
            referencia.save()
            with self.assertRaises(ValidationError):
                self.confirmar(recepcion)
            referencia.activo = True
            referencia.save()
        self.assertFalse(Lote.objects.exists())

    def test_unidad_inhabilitada_entre_borrador_y_confirmacion(self):
        habilitar_unidad(self.actor, self.producto.pk, {'unidad': self.unidad.pk})
        datos = self.datos()
        datos['detalles'][0]['unidad_inventario'] = self.unidad.pk
        recepcion = guardar_recepcion(self.actor, datos)[0]
        self.producto.unidades_inventario.update(activo=False)
        with self.assertRaises(ValidationError):
            self.confirmar(recepcion)

    def test_fechas_no_futuras_no_anteriores_a_compra_y_vencimiento(self):
        for fecha in (self.hoy + timedelta(days=1), self.hoy - timedelta(days=1)):
            with self.assertRaises(ValidationError):
                self.crear(self.compra(), fecha_recepcion=str(fecha))
        datos = self.datos()
        datos['detalles'][0]['fecha_vencimiento'] = str(self.hoy - timedelta(days=1))
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, datos)

    def test_stock_vencido_y_bloqueado_se_conserva_sin_disponibilidad(self):
        datos = self.datos(fecha_recepcion=str(self.hoy - timedelta(days=2)))
        datos['detalles'][0]['fecha_vencimiento'] = str(self.hoy - timedelta(days=1))
        self.confirmar(guardar_recepcion(self.actor, datos)[0])
        lote = Lote.objects.get()
        respuesta = self.client.get(f'/api/v1/inventario/lotes/{lote.pk}/').data
        self.assertTrue(respuesta['vencido'])
        self.assertFalse(respuesta['disponible'])
        self.assertEqual(Decimal(respuesta['saldo']), Decimal('120'))
        cambiar_estado_lote(self.actor, lote, {'estado': 'bloqueado', 'version': version_lote(lote)})
        lote.refresh_from_db()
        with self.assertRaises(ValidationError):
            cambiar_estado_lote(self.actor, lote, {'estado': 'disponible', 'version': version_lote(lote)})
        self.assertEqual(lotes_con_saldo().get().saldo, Decimal('120'))

    def test_bloqueo_version_y_movimientos_inmutables(self):
        self.confirmar(self.crear())
        lote = Lote.objects.get()
        version = version_lote(lote)
        cambiar_estado_lote(self.actor, lote, {'estado': 'bloqueado', 'version': version})
        with self.assertRaises(ConflictoInventario):
            cambiar_estado_lote(self.actor, lote, {'estado': 'disponible', 'version': version})
        for ruta in ('inventario/lotes', 'inventario/movimientos'):
            self.assertEqual(self.client.post(f'/api/v1/{ruta}/', {}, format='json').status_code, 405)
            self.assertEqual(self.client.patch(f'/api/v1/{ruta}/1/', {}, format='json').status_code, 405)

    def test_auditoria_fallida_revierte_todo_ingreso(self):
        recepcion = self.crear(self.compra())
        with patch('recepciones.servicios.registrar_actividad', side_effect=RuntimeError('sin evidencia')):
            with self.assertRaises(RuntimeError):
                self.confirmar(recepcion)
        recepcion.refresh_from_db()
        self.assertEqual(recepcion.estado, 'borrador')
        self.assertIsNone(recepcion.detalles.get().lote_id)
        self.assertFalse(Lote.objects.exists())
        self.assertFalse(MovimientoInventario.objects.exists())
        self.assertEqual(avance_compra(recepcion.compra_id), {})

    def test_cancelacion_solo_borradores_y_protege_compra(self):
        compra = self.compra()
        recepcion = self.crear(compra)
        with self.assertRaises(ConflictoCompra):
            cancelar_compra(self.actor, compra, {'version': version_compra(compra), 'clave_operacion': str(uuid.uuid4()), 'motivo': 'Revisar'})
        accion = self.accion(recepcion, motivo='No llegó')
        cancelar_recepcion(self.actor, recepcion, accion)
        cancelar_recepcion(self.actor, recepcion, accion)
        cancelar_compra(self.actor, compra, {'version': version_compra(compra), 'clave_operacion': str(uuid.uuid4()), 'motivo': 'Revisar'})
        confirmada = self.confirmar(self.crear())
        with self.assertRaises(ConflictoRecepcion):
            cancelar_recepcion(self.actor, confirmada, self.accion(confirmada, motivo='Error'))

    def test_confirmada_no_se_edita_ni_cambia_origen(self):
        recepcion = self.crear()
        datos = self.datos(self.compra())
        datos.pop('clave_operacion')
        datos['version'] = version_recepcion(recepcion)
        with self.assertRaises(ValidationError):
            guardar_recepcion(self.actor, datos, recepcion)
        recepcion = self.confirmar(recepcion)
        datos['compra'] = None
        datos['version'] = version_recepcion(recepcion)
        with self.assertRaises(ConflictoRecepcion):
            guardar_recepcion(self.actor, datos, recepcion)

    def test_abreviatura_usada_no_cambia_significado(self):
        self.crear()
        with self.assertRaises(ValidationError):
            guardar_catalogo(UnidadMedida, self.actor, {'abreviatura': 't', 'version': version_catalogo(self.kg)}, self.kg)

    def test_permisos_y_metadatos_sin_precios(self):
        compra = self.compra()
        self.client.force_authenticate(self.lector)
        respuesta = self.client.get('/api/v1/recepciones/compra-detalles/', {'compra': compra.pk})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertNotIn('precio_unitario', respuesta.data['results'][0])
        self.assertEqual(self.client.get('/api/v1/compras/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/inventario/lotes/').status_code, 403)
        with self.assertRaises(PermissionDenied):
            guardar_recepcion(self.lector, self.datos())

    def test_paginacion_fija_en_listados_y_selectores(self):
        for indice in range(11):
            self.crear()
            Almacen.objects.create(nombre=f'Otro {indice}', direccion='Calle')
        for ruta in ('recepciones/', 'recepciones/almacenes/'):
            respuesta = self.client.get(f'/api/v1/{ruta}', {'page_size': 100})
            self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/recepciones/', {'pagina': 2}).data['results']), 1)

    def test_errores_de_lineas_identifican_campo(self):
        datos = self.datos()
        datos['detalles'][0]['cantidad_inventario'] = '-1'
        respuesta = self.client.post('/api/v1/recepciones/', datos, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('detalle_0_cantidad_inventario', respuesta.data['errors'])

    def test_clave_confirmacion_no_reutilizable_entre_recepciones(self):
        primera, segunda = self.crear(), self.crear()
        accion = self.accion(primera)
        confirmar_recepcion(self.actor, primera, accion)
        with self.assertRaises(ConflictoInventario):
            confirmar_recepcion(self.actor, segunda, {**accion, 'version': version_recepcion(segunda)})
        segunda.refresh_from_db()
        self.assertEqual(segunda.estado, 'borrador')
        self.assertEqual(Lote.objects.count(), 1)

    def test_movimiento_identifica_quien_confirma(self):
        recepcion = self.crear()
        operador = Usuario.objects.create_user(email='operador@recepciones.test', cedula_identidad='89003', first_name='Ana', last_name='Perez')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='recepciones', codename__in=['view_recepcion', 'confirmar_recepcion']))
        confirmada = confirmar_recepcion(operador, recepcion, self.accion(recepcion))
        self.assertEqual(confirmada.responsable_id, self.actor.pk)
        self.assertEqual(confirmada.movimiento.responsable_id, operador.pk)
        self.assertEqual(confirmada.movimiento.responsable_nombre, 'Ana Perez')

    def test_permisos_unidades_son_independientes_y_versionados(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get(f'/api/v1/inventario/productos/{self.producto.pk}/unidades/').status_code, 403)
        self.lector.user_permissions.add(Permission.objects.get(content_type__app_label='productos', codename='view_producto'))
        self.client.force_authenticate(Usuario.objects.get(pk=self.lector.pk))
        respuesta = self.client.get(f'/api/v1/inventario/productos/{self.producto.pk}/unidades/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['results'][0]['es_base'])
        self.assertEqual(self.client.post(f'/api/v1/inventario/productos/{self.producto.pk}/unidades/', {'unidad': self.unidad.pk}, format='json').status_code, 403)
        unidad, _ = habilitar_unidad(self.actor, self.producto.pk, {'unidad': self.unidad.pk})
        cambiar_unidad(self.actor, self.producto.pk, self.unidad.pk, {'activo': False, 'version': unidad['version']})
        with self.assertRaises(ConflictoInventario):
            cambiar_unidad(self.actor, self.producto.pk, self.unidad.pk, {'activo': True, 'version': unidad['version']})

    def test_auditoria_del_lote_fallida_no_deja_movimiento_huerfano(self):
        recepcion = self.crear()
        with patch('inventario.servicios.registrar_actividad', side_effect=RuntimeError('sin evidencia')):
            with self.assertRaises(RuntimeError):
                self.confirmar(recepcion)
        self.assertFalse(Lote.objects.exists())
        self.assertFalse(MovimientoInventario.objects.exists())
        self.assertIsNone(recepcion.detalles.get().lote_id)

    def test_lotes_movimientos_y_selectores_respetan_diez(self):
        for indice in range(11):
            self.confirmar(self.crear())
            UnidadMedida.objects.create(nombre=f'Medida {indice}', abreviatura=f'm{indice}')
        for ruta in ('inventario/lotes/', 'inventario/movimientos/', f'inventario/productos/{self.producto.pk}/unidades/opciones/'):
            respuesta = self.client.get(f'/api/v1/{ruta}', {'page_size': 100})
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            self.assertEqual(len(respuesta.data['results']), 10)
        lote = Lote.objects.first()
        self.assertEqual(self.client.get('/api/v1/inventario/lotes/', {'almacen': self.almacen.pk}).data['count'], 11)
        self.assertEqual(self.client.get(f'/api/v1/inventario/lotes/{lote.pk}/').data['recepcion']['id'], lote.detalle_recepcion.recepcion_id)

    def test_borrador_vacio_no_se_confirma_y_campos_controlados(self):
        recepcion = self.crear(detalles=[])
        with self.assertRaises(ValidationError):
            self.confirmar(recepcion)
        for datos in ({'estado': 'confirmada'}, {'responsable': self.actor.pk}, {'movimiento': 1}):
            respuesta = self.client.post('/api/v1/recepciones/', self.datos(**datos), format='json')
            self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(self.client.delete(f'/api/v1/recepciones/{recepcion.pk}/').status_code, 405)
