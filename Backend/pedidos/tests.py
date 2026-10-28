import uuid
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import Permission, Group
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import PermissionDenied, ValidationError
from auditoria.models import RegistroActividad
from catalogos.models import CategoriaProducto, UnidadMedida
from clientes.models import Cliente, Sucursal
from clientes.servicios import guardar_registro, obtener_version as version_sucursal
from productos.models import Producto, PresentacionProducto
from productos.servicios_presentaciones import guardar_presentacion
from usuarios.models import Usuario
from .models import Pedido, DetallePedido
from .servicios import guardar_pedido, cancelar_pedido, obtener_version, ConflictoPedido


class PruebasPedidos(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(email='admin@pedidos.test', cedula_identidad='810001', password='PedidosSeguros_2026!')
        cls.encargado = Usuario.objects.create_user(email='encargado@pedidos.test', cedula_identidad='810002', first_name='Encargado')
        cls.otro = Usuario.objects.create_user(email='otro@pedidos.test', cedula_identidad='810003')
        cls.lector_global = Usuario.objects.create_user(email='lector@pedidos.test', cedula_identidad='810004')
        permisos = Permission.objects.filter(content_type__app_label='pedidos', codename__in=['view_pedido', 'add_pedido', 'change_pedido', 'cancelar_pedido'])
        cls.encargado.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)
        cls.lector_global.user_permissions.set(Permission.objects.filter(content_type__app_label='pedidos').exclude(codename='gestionar_todos_pedidos'))
        cls.cliente = Cliente.objects.create(razon_social='Cliente de prueba', nit='810001')
        cls.sucursal = Sucursal.objects.create(cliente=cls.cliente, nombre='Obrajes', direccion='Dirección de prueba', encargado_pedidos=cls.encargado)
        cls.otra_sucursal = Sucursal.objects.create(cliente=cls.cliente, nombre='Miraflores', direccion='Dirección de prueba', encargado_pedidos=cls.otro)
        cls.categoria = CategoriaProducto.objects.create(nombre='Verduras')
        cls.unidad = UnidadMedida.objects.create(nombre='Unidad', abreviatura='u')
        cls.producto = Producto.objects.create(nombre='Tomate', categoria=cls.categoria, unidad_medida=cls.unidad)
        cls.caja = PresentacionProducto.objects.create(producto=cls.producto, nombre='Caja', columna_pedido='cajas')
        cls.suelta = PresentacionProducto.objects.create(producto=cls.producto, nombre='Unidad', columna_pedido='unidades', uso='pedido')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.encargado)

    def datos(self, **cambios):
        return {'sucursal': self.sucursal.pk, 'fecha_requerida': str(timezone.localdate()), 'clave_operacion': str(uuid.uuid4()),
                'observaciones': 'Sin indicaciones adicionales', 'detalles': [
                    {'producto': self.producto.pk, 'presentacion': self.caja.pk, 'columna': 'cajas', 'cantidad': 3},
                    {'producto': self.producto.pk, 'presentacion': self.suelta.pk, 'columna': 'unidades', 'cantidad': 5}], **cambios}

    def crear(self, **cambios):
        return guardar_pedido(self.encargado, self.datos(**cambios))[0]

    def datos_edicion(self, pedido, **cambios):
        datos = self.datos(**cambios)
        datos.pop('sucursal'); datos.pop('clave_operacion')
        return {**datos, 'version': obtener_version(pedido)}

    def test_guardar_cajas_y_unidades_independientes_con_auditoria(self):
        respuesta = self.client.post('/api/v1/pedidos/', self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        pedido = Pedido.objects.get(pk=respuesta.data['id'])
        self.assertEqual(list(pedido.detalles.order_by('columna').values_list('columna','cantidad')), [('cajas',3),('unidades',5)])
        self.assertEqual(pedido.estado, 'pendiente')
        self.assertEqual(pedido.responsable_id, self.encargado.pk)
        registro = RegistroActividad.objects.get(modulo='pedidos', objeto_id=str(pedido.pk), accion='crear')
        self.assertEqual(registro.actor_id, self.encargado.pk)
        self.assertEqual(len(registro.cambios['detalles']['despues']), 2)

    def test_reintento_no_duplica_pedido(self):
        datos = self.datos()
        primero = self.client.post('/api/v1/pedidos/', datos, format='json')
        segundo = self.client.post('/api/v1/pedidos/', datos, format='json')
        self.assertEqual((primero.status_code, segundo.status_code), (201,200))
        self.assertEqual(primero.data['id'], segundo.data['id'])
        self.assertEqual(Pedido.objects.count(), 1)

    def test_clave_reutilizada_con_otro_contenido_rechazada(self):
        datos = self.datos();guardar_pedido(self.encargado,datos)
        with self.assertRaises(ConflictoPedido):
            guardar_pedido(self.encargado,{**datos,'observaciones':'Otro pedido'})

    def test_no_crear_ni_leer_otra_sucursal(self):
        self.assertEqual(self.client.post('/api/v1/pedidos/', self.datos(sucursal=self.otra_sucursal.pk), format='json').status_code,403)
        pedido = guardar_pedido(self.administrador, self.datos(sucursal=self.otra_sucursal.pk))[0]
        self.assertEqual(self.client.get(f'/api/v1/pedidos/{pedido.pk}/').status_code,404)
        self.assertEqual(self.client.get('/api/v1/pedidos/').data['count'],0)

    def test_scope_se_aplica_en_servicio_sin_http(self):
        with self.assertRaises(PermissionDenied):
            guardar_pedido(self.otro,self.datos())

    def test_ver_todos_no_otorga_escritura_global(self):
        pedido = self.crear()
        self.client.force_authenticate(self.lector_global)
        respuesta = self.client.get(f'/api/v1/pedidos/{pedido.pk}/')
        self.assertEqual(respuesta.status_code,200)
        self.assertFalse(respuesta.data['puede_editar'])
        self.assertFalse(respuesta.data['puede_cancelar'])
        self.assertEqual(self.client.patch(f'/api/v1/pedidos/{pedido.pk}/',self.datos_edicion(pedido),format='json').status_code,403)

    def test_reasignar_revoca_acceso_anterior(self):
        pedido = self.crear()
        guardar_registro(Sucursal,self.administrador,{'encargado_pedidos_id':self.otro.pk,'version':version_sucursal(self.sucursal)},self.sucursal,cliente_id=self.cliente.pk)
        self.assertEqual(self.client.get(f'/api/v1/pedidos/{pedido.pk}/').status_code,404)
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.get(f'/api/v1/pedidos/{pedido.pk}/').status_code,200)

    def test_fecha_anterior_y_destino_inactivo_rechazados(self):
        self.assertEqual(self.client.post('/api/v1/pedidos/',self.datos(fecha_requerida=str(timezone.localdate()-timedelta(days=1))),format='json').status_code,400)
        self.cliente.activo=False;self.cliente.save()
        self.assertEqual(self.client.post('/api/v1/pedidos/',self.datos(),format='json').status_code,400)

    def test_recepcion_estado_responsable_no_editables(self):
        for campo in ('recepcion','recibido_por','estado','responsable','cliente','creado_en'):
            with self.subTest(campo=campo):
                self.assertEqual(self.client.post('/api/v1/pedidos/',self.datos(**{campo:1}),format='json').status_code,400)

    def test_cantidades_invalidas_y_duplicadas(self):
        for cantidad in (0,-1,'1.5',1000000):
            datos=self.datos();datos['detalles'][0]['cantidad']=cantidad
            self.assertEqual(self.client.post('/api/v1/pedidos/',datos,format='json').status_code,400)
        datos=self.datos();datos['detalles']*=2
        self.assertEqual(self.client.post('/api/v1/pedidos/',datos,format='json').status_code,400)
        self.assertEqual(self.client.post('/api/v1/pedidos/',self.datos(detalles=[]),format='json').status_code,400)

    def test_presentacion_incorrecta_o_inactiva_rechazada(self):
        datos=self.datos();datos['detalles'][0]['presentacion']=self.suelta.pk
        respuesta=self.client.post('/api/v1/pedidos/',datos,format='json')
        self.assertEqual(respuesta.status_code,400)
        self.assertIn(f'cantidad_{self.producto.pk}_cajas',respuesta.data['errors'])
        self.caja.activo=False;self.caja.save()
        self.assertEqual(self.client.post('/api/v1/pedidos/',self.datos(),format='json').status_code,400)

    def test_editar_preserva_ids_y_version_bloquea_sobrescritura(self):
        pedido=self.crear();identificadores=set(pedido.detalles.values_list('pk',flat=True));datos=self.datos_edicion(pedido)
        datos['detalles'][0]['cantidad']=4
        respuesta=self.client.patch(f'/api/v1/pedidos/{pedido.pk}/',datos,format='json')
        self.assertEqual(respuesta.status_code,200,respuesta.data)
        self.assertEqual(set(pedido.detalles.values_list('pk',flat=True)),identificadores)
        self.assertEqual(self.client.patch(f'/api/v1/pedidos/{pedido.pk}/',datos,format='json').status_code,409)

    def test_historial_conserva_cantidades_inalteradas_si_producto_inactivo(self):
        pedido=self.crear();self.producto.activo=False;self.producto.save()
        self.assertEqual(self.client.patch(f'/api/v1/pedidos/{pedido.pk}/',self.datos_edicion(pedido,observaciones='Nueva nota'),format='json').status_code,200)
        pedido.refresh_from_db();datos=self.datos_edicion(pedido);datos['detalles'][0]['cantidad']=4
        self.assertEqual(self.client.patch(f'/api/v1/pedidos/{pedido.pk}/',datos,format='json').status_code,400)

    def test_cancelar_conserva_detalles_y_no_permite_editar(self):
        pedido=self.crear()
        respuesta=self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/',{'version':obtener_version(pedido),'motivo':'Solicitud de sucursal'},format='json')
        self.assertEqual(respuesta.status_code,200,respuesta.data)
        pedido.refresh_from_db();self.assertEqual(pedido.detalles.count(),2)
        self.assertEqual(self.client.patch(f'/api/v1/pedidos/{pedido.pk}/',self.datos_edicion(pedido),format='json').status_code,409)
        self.assertTrue(RegistroActividad.objects.filter(modulo='pedidos',accion='cancelar',objeto_id=str(pedido.pk)).exists())

    def test_cancelar_sin_motivo_desde_listado_conserva_historial(self):
        pedido = self.crear()
        identificadores = set(pedido.detalles.values_list('pk', flat=True))
        datos = {'version': obtener_version(pedido)}
        respuesta = self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', datos, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        pedido.refresh_from_db()
        self.assertEqual(pedido.estado, 'cancelado')
        self.assertEqual(pedido.motivo_cancelacion, '')
        self.assertEqual(pedido.cancelado_por_id, self.encargado.pk)
        self.assertIsNotNone(pedido.cancelado_en)
        self.assertEqual(set(pedido.detalles.values_list('pk', flat=True)), identificadores)
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', datos, format='json').status_code, 409)
        self.assertEqual(RegistroActividad.objects.filter(modulo='pedidos', accion='cancelar', objeto_id=str(pedido.pk), resultado='exito').count(), 1)
        fila = self.client.get('/api/v1/pedidos/').data['results'][0]
        self.assertFalse(fila['puede_cancelar'])
        self.assertFalse(fila['puede_editar'])
        self.assertEqual(self.client.get('/api/v1/pedidos/resumen/').data['cancelados'], 1)

    def test_cancelar_sin_motivo_respeta_asignacion_y_permiso(self):
        pedido = self.crear()
        datos = {'version': obtener_version(pedido)}
        with self.assertRaises(PermissionDenied):
            cancelar_pedido(self.otro, pedido, datos)
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', datos, format='json').status_code, 404)
        self.client.force_authenticate(self.lector_global)
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', datos, format='json').status_code, 403)
        pedido.refresh_from_db()
        self.assertEqual(pedido.estado, 'pendiente')

    def test_cancelar_sin_motivo_exige_version_y_pedido_pendiente(self):
        pedido = self.crear()
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', {}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', {'version': '0' * 64}, format='json').status_code, 409)
        pedido.estado = 'preparado'
        pedido.save()
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/cancelar/', {'version': obtener_version(pedido)}, format='json').status_code, 409)

    def test_cancelacion_sin_motivo_revierte_si_falla_auditoria(self):
        pedido = self.crear()
        with patch('pedidos.servicios.registrar_actividad', side_effect=RuntimeError('Fallo controlado')):
            with self.assertRaises(RuntimeError):
                cancelar_pedido(self.encargado, pedido, {'version': obtener_version(pedido)})
        pedido.refresh_from_db()
        self.assertEqual(pedido.estado, 'pendiente')
        self.assertIsNone(pedido.cancelado_en)
        self.assertIsNone(pedido.cancelado_por_id)
        self.assertEqual(pedido.detalles.count(), 2)
        self.assertFalse(RegistroActividad.objects.filter(modulo='pedidos', accion='cancelar', objeto_id=str(pedido.pk)).exists())

    def test_auditoria_fallida_revierte_todo(self):
        with patch('pedidos.servicios.registrar_actividad',side_effect=RuntimeError('Fallo controlado')):
            with self.assertRaises(RuntimeError): self.crear()
        self.assertFalse(Pedido.objects.exists());self.assertFalse(DetallePedido.objects.exists())

    def test_catalogo_sin_permisos_de_administracion_y_paginacion_diez(self):
        Producto.objects.bulk_create([Producto(nombre=f'Producto {indice:02}',categoria=self.categoria,unidad_medida=self.unidad) for indice in range(14)])
        respuesta=self.client.get('/api/v1/pedidos/catalogo/?page_size=100')
        self.assertEqual(respuesta.status_code,200);self.assertEqual(len(respuesta.data['results']),10)
        self.assertEqual(respuesta.data['count'],15)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code,403)
        seleccionado=self.client.get(f'/api/v1/pedidos/catalogo/?seleccionados={self.producto.pk}').data['results'][0]
        self.assertEqual(seleccionado['cajas']['id'],self.caja.pk)
        self.assertEqual(seleccionado['unidades']['id'],self.suelta.pk)

    def test_listado_diez_y_resumen_sin_revelar_otras_sucursales(self):
        for _ in range(12):self.crear()
        guardar_pedido(self.administrador,self.datos(sucursal=self.otra_sucursal.pk))
        respuesta=self.client.get('/api/v1/pedidos/?page_size=100')
        self.assertEqual(len(respuesta.data['results']),10);self.assertEqual(respuesta.data['count'],12)
        self.assertEqual(self.client.get('/api/v1/pedidos/resumen/').data['pendientes'],12)
        self.assertEqual(len(self.client.get('/api/v1/pedidos/?pagina=2').data['results']),2)

    def test_sucursales_selector_restringidas(self):
        respuesta=self.client.get('/api/v1/pedidos/sucursales/').data
        self.assertEqual(respuesta['count'],1);self.assertEqual(respuesta['results'][0]['id'],self.sucursal.pk)

    def test_sucursal_asignada_automatica_no_depende_de_busqueda(self):
        respuesta = self.client.get('/api/v1/pedidos/sucursales/', {'buscar': 'No coincide'}).data
        self.assertEqual(respuesta['count'], 0)
        self.assertEqual(respuesta['sucursal_asignada']['id'], self.sucursal.pk)
        self.assertEqual(respuesta['sucursal_asignada']['cliente'], self.cliente.razon_social)
        self.assertNotIn('email', respuesta['sucursal_asignada'])

    def test_asignacion_unica_se_resuelve_fuera_de_primera_pagina_global(self):
        Sucursal.objects.filter(pk=self.sucursal.pk).update(encargado_pedidos=self.administrador)
        Sucursal.objects.bulk_create([Sucursal(cliente=self.cliente, nombre=f'A {indice:02}', direccion='Calle') for indice in range(11)])
        self.client.force_authenticate(self.administrador)
        respuesta = self.client.get('/api/v1/pedidos/sucursales/', {'page_size': 100}).data
        self.assertEqual(len(respuesta['results']), 10)
        self.assertEqual(respuesta['count'], 13)
        self.assertNotIn(self.sucursal.pk, [fila['id'] for fila in respuesta['results']])
        self.assertEqual(respuesta['sucursal_asignada']['id'], self.sucursal.pk)

    def test_varias_asignaciones_no_eligen_destino_arbitrario(self):
        Sucursal.objects.filter(pk=self.otra_sucursal.pk).update(encargado_pedidos=self.encargado)
        respuesta = self.client.get('/api/v1/pedidos/sucursales/').data
        self.assertEqual(respuesta['count'], 2)
        self.assertIsNone(respuesta['sucursal_asignada'])

    def test_sin_asignacion_activa_no_hay_destino_automatico(self):
        Sucursal.objects.filter(pk=self.sucursal.pk).update(activo=False)
        respuesta = self.client.get('/api/v1/pedidos/sucursales/').data
        self.assertEqual(respuesta['count'], 0)
        self.assertIsNone(respuesta['sucursal_asignada'])

    def test_sucursal_guardada_no_se_cambia_ni_con_permiso_global(self):
        pedido = self.crear()
        self.client.force_authenticate(self.administrador)
        datos = self.datos_edicion(pedido)
        datos['sucursal'] = self.otra_sucursal.pk
        respuesta = self.client.patch(f'/api/v1/pedidos/{pedido.pk}/', datos, format='json')
        self.assertEqual(respuesta.status_code, 400)
        pedido.refresh_from_db()
        self.assertEqual(pedido.sucursal_id, self.sucursal.pk)

    def test_editar_sin_campo_observaciones_conserva_historial_anterior(self):
        pedido = self.crear(observaciones='Nota histórica')
        datos = self.datos_edicion(pedido)
        datos.pop('observaciones')
        datos['detalles'][0]['cantidad'] = 4
        respuesta = self.client.patch(f'/api/v1/pedidos/{pedido.pk}/', datos, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        pedido.refresh_from_db()
        self.assertEqual(pedido.observaciones, 'Nota histórica')
        self.assertEqual(pedido.detalles.get(columna='cajas').cantidad, 4)

    def test_crear_sin_observaciones_y_reintentar_con_campo_vacio(self):
        datos = self.datos()
        datos.pop('observaciones')
        primera = self.client.post('/api/v1/pedidos/', datos, format='json')
        segunda = self.client.post('/api/v1/pedidos/', {**datos, 'observaciones': ''}, format='json')
        self.assertEqual((primera.status_code, segunda.status_code), (201, 200))
        self.assertEqual(primera.data['id'], segunda.data['id'])
        self.assertEqual(Pedido.objects.get(pk=primera.data['id']).observaciones, '')

    def test_encargados_selector_y_permiso_asignacion(self):
        self.assertEqual(self.client.get('/api/v1/clientes/encargados/').status_code,403)
        with self.assertRaises(PermissionDenied):
            guardar_registro(Sucursal,self.encargado,{'encargado_pedidos_id':self.otro.pk,'version':version_sucursal(self.sucursal)},self.sucursal,cliente_id=self.cliente.pk)
        self.client.force_authenticate(self.administrador)
        respuesta=self.client.get('/api/v1/clientes/encargados/')
        self.assertEqual(respuesta.status_code,200)
        self.assertIn(self.encargado.pk,[opcion['id'] for opcion in respuesta.data['results']])
        self.assertNotIn('email',respuesta.data['results'][0])

    def test_columna_unica_y_solo_presentaciones_pedidos(self):
        with self.assertRaises(ValidationError):
            guardar_presentacion(self.administrador,self.producto.pk,{'nombre':'Otra caja','columna_pedido':'cajas'})
        with self.assertRaises(ValidationError):
            guardar_presentacion(self.administrador,self.producto.pk,{'nombre':'Compra','uso':'compra','columna_pedido':'unidades'})
        with self.assertRaises(IntegrityError), transaction.atomic():
            PresentacionProducto.objects.create(producto=self.producto,nombre='Inválida',columna_pedido='cajas')

    def test_sin_login_y_sin_acciones_de_borrado_o_recepcion(self):
        pedido=self.crear()
        self.assertEqual(self.client.delete(f'/api/v1/pedidos/{pedido.pk}/').status_code,405)
        self.assertEqual(self.client.post(f'/api/v1/pedidos/{pedido.pk}/recepcion/',{},format='json').status_code,404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/pedidos/').status_code,401)

    def test_roles_nuevos_sin_ampliar_rol_existente(self):
        rol=Group.objects.create(name='Encargado de pedidos')
        call_command('preparar_roles',verbosity=0)
        self.assertEqual(rol.permissions.count(),0)
        self.assertEqual(Group.objects.get(name='Administrador de pedidos').permissions.count(),6)
