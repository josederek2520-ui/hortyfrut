from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from auditoria.models import RegistroActividad
from catalogos.models import CategoriaProducto, UnidadMedida
from usuarios.models import Usuario
from .models import Producto, PresentacionProducto
from .servicios import version_producto
from .servicios_presentaciones import guardar_presentacion, obtener_version_presentacion


class PruebasPresentaciones(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(email='admin@presentaciones.test', cedula_identidad='640001', password='PresentacionesSeguras_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@presentaciones.test', cedula_identidad='640002')
        cls.editor_producto = Usuario.objects.create_user(email='producto@presentaciones.test', cedula_identidad='640003')
        cls.editor_presentacion = Usuario.objects.create_user(email='presentacion@presentaciones.test', cedula_identidad='640004')
        cls.sin_producto = Usuario.objects.create_user(email='sinproducto@presentaciones.test', cedula_identidad='640005')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='productos', codename__in=['view_producto', 'view_presentacionproducto']))
        cls.editor_producto.user_permissions.set(Permission.objects.filter(content_type__app_label='productos', codename__in=['view_producto', 'change_producto']))
        cls.editor_presentacion.user_permissions.set(Permission.objects.filter(content_type__app_label='productos', codename__in=['view_producto', 'view_presentacionproducto', 'change_presentacionproducto']))
        cls.sin_producto.user_permissions.set(Permission.objects.filter(content_type__app_label='productos', content_type__model='presentacionproducto'))
        cls.categoria = CategoriaProducto.objects.create(nombre='Verduras')
        cls.unidad = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        cls.producto = Producto.objects.create(nombre='Tomate', categoria=cls.categoria, unidad_medida=cls.unidad)
        cls.otro_producto = Producto.objects.create(nombre='Papa', categoria=cls.categoria, unidad_medida=cls.unidad)
        cls.presentacion = PresentacionProducto.objects.create(producto=cls.producto, nombre='Caja')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.administrador)

    def ruta(self, sufijo='', producto=None):
        return f'/api/v1/productos/{producto or self.producto.pk}/presentaciones/{sufijo}'

    def datos(self, **adicionales):
        return {'nombre': 'Bolsa', **adicionales}

    def editar(self, datos):
        return self.client.patch(self.ruta(f'{self.presentacion.pk}/'), {**datos, 'version': obtener_version_presentacion(self.presentacion)}, format='json')

    def test_crear_presentacion_con_nombre_y_uso(self):
        respuesta = self.client.post(self.ruta(), self.datos(nombre='  Bolsa   grande  '), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['nombre'], 'Bolsa grande')
        self.assertEqual(respuesta.data['uso'], 'ambos')
        self.assertEqual(set(respuesta.data), {'id', 'producto', 'nombre', 'uso', 'columna_pedido', 'activo', 'creado_en', 'version'})
        self.assertEqual(respuesta.data['producto'], self.producto.pk)
        self.assertTrue(respuesta.data['activo'])
        self.assertNotIn('actualizado_en', respuesta.data)
        self.assertNotIn('permite_fraccion', respuesta.data)
        evento = RegistroActividad.objects.get(modulo='presentaciones', accion='crear', resultado='exito')
        self.assertEqual(evento.cambios['producto']['despues']['id'], self.producto.pk)





    def test_campos_controlados_por_servidor_y_opciones_invalidas(self):
        for campo, valor in [('producto', self.otro_producto.pk), ('activo', False), ('actualizado_en', 'x'), ('creado_en', 'x'), ('permite_fraccion', True), ('uso', 'venta'), ('tipo_equivalencia', 'automatica'), ('nombre', '  '), ('nombre', 'x'*101)]:
            with self.subTest(campo=campo):
                respuesta = self.client.post(self.ruta(), self.datos(**{campo: valor}), format='json')
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn(campo, respuesta.data['errors'])

    def test_nombre_unico_por_producto_incluso_en_presentaciones_inactivas(self):
        respuesta = self.client.post(self.ruta(), self.datos(nombre='CAJA'), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('nombre', respuesta.data['errors'])
        self.presentacion.activo = False
        self.presentacion.save()
        self.assertEqual(self.client.post(self.ruta(), self.datos(nombre='caja'), format='json').status_code, 400)
        self.assertEqual(self.client.post(self.ruta(producto=self.otro_producto.pk), self.datos(nombre='Caja'), format='json').status_code, 201)
        with self.assertRaises(IntegrityError), transaction.atomic():
            PresentacionProducto.objects.create(producto=self.producto, nombre='CAJA')

    def test_postgres_rechaza_usos_invalidos(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            PresentacionProducto.objects.create(producto=self.producto, nombre='Invalida', uso='venta')

    def test_no_se_puede_leer_ni_modificar_desde_otro_producto(self):
        ruta = self.ruta(f'{self.presentacion.pk}/', producto=self.otro_producto.pk)
        self.assertEqual(self.client.get(ruta).status_code, 404)
        self.assertEqual(self.client.patch(ruta, self.datos(version=obtener_version_presentacion(self.presentacion)), format='json').status_code, 404)
        self.assertEqual(self.client.post(ruta+'estado/', {'activo': False, 'version': obtener_version_presentacion(self.presentacion)}, format='json').status_code, 404)
        self.assertEqual(self.client.get(self.ruta(producto=999999)).status_code, 404)

    def test_lectura_y_edicion_tienen_permisos_independientes(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get(self.ruta()).status_code, 200)
        self.assertEqual(self.client.get(self.ruta(f'{self.presentacion.pk}/')).status_code, 200)
        self.assertEqual(self.client.post(self.ruta(), self.datos(), format='json').status_code, 403)
        self.assertEqual(self.editar({'nombre': 'No autorizado'}).status_code, 403)
        self.client.force_authenticate(self.editor_producto)
        self.assertEqual(self.client.get(self.ruta()).status_code, 403)
        self.assertEqual(self.editar({'nombre': 'No autorizado'}).status_code, 403)
        self.client.force_authenticate(self.editor_presentacion)
        self.assertEqual(self.editar({'nombre': 'Caja grande'}).status_code, 200)
        self.assertEqual(self.client.post(self.ruta(f'{self.presentacion.pk}/estado/'), {}, format='json').status_code, 403)
        self.client.force_authenticate(self.sin_producto)
        self.assertEqual(self.client.get(self.ruta()).status_code, 403)
        self.assertEqual(self.client.post(self.ruta(), self.datos(), format='json').status_code, 403)

    def test_anonimos_no_acceden_y_no_existe_borrado_fisico(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.ruta()).status_code, 401)
        self.client.force_authenticate(self.administrador)
        self.assertEqual(self.client.delete(self.ruta(f'{self.presentacion.pk}/')).status_code, 405)
        self.assertFalse(Permission.objects.filter(content_type__app_label='productos', codename='delete_presentacionproducto').exists())
        with self.assertRaises(ProtectedError):
            self.producto.delete()

    def test_listado_y_opciones_filtran_ambos_usos_y_paginas_de_diez(self):
        PresentacionProducto.objects.bulk_create([PresentacionProducto(producto=self.producto, nombre=f'Presentacion {indice:02}', uso='compra' if indice%2 == 0 else 'pedido', activo=indice%2 == 0) for indice in range(12)])
        primera = self.client.get(self.ruta('?tamano=100&page_size=100')).data
        self.assertEqual(primera['count'], 13)
        self.assertEqual(len(primera['results']), 10)
        self.assertEqual(len(self.client.get(self.ruta('?pagina=2')).data['results']), 3)
        self.assertEqual(self.client.get(self.ruta('?uso=compra')).data['count'], 7)
        self.assertEqual(self.client.get(self.ruta('?uso=pedido')).data['count'], 7)
        self.assertEqual(self.client.get(self.ruta('?uso=ambos')).data['count'], 1)
        self.assertEqual(self.client.get(self.ruta('?buscar=Caja')).data['count'], 1)
        self.assertEqual(self.client.get(self.ruta('?activo=false')).data['count'], 6)
        self.assertEqual(self.client.get(self.ruta('resumen/?activo=false')).data, {'total': 13, 'activos': 7, 'inactivos': 6})
        self.assertEqual(self.client.get(self.ruta('?orden=no_permitido')).status_code, 400)
        self.assertEqual(self.client.get(self.ruta('?uso=venta')).status_code, 400)

    def test_version_obligatoria_y_conflictos_en_edicion_y_estado(self):
        version = obtener_version_presentacion(self.presentacion)
        self.assertEqual(self.client.patch(self.ruta(f'{self.presentacion.pk}/'), self.datos(), format='json').status_code, 400)
        respuesta = self.editar({'nombre': 'Caja nueva'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertNotEqual(respuesta.data['version'], version)
        self.assertEqual(self.client.patch(self.ruta(f'{self.presentacion.pk}/'), self.datos(version=version), format='json').status_code, 409)
        self.assertEqual(self.client.post(self.ruta(f'{self.presentacion.pk}/estado/'), {'activo': False, 'version': version}, format='json').status_code, 409)
        self.presentacion.refresh_from_db()
        self.assertEqual(self.presentacion.nombre, 'Caja nueva')

    def test_editar_el_uso_no_requiere_datos_de_inventario(self):
        respuesta = self.editar({'uso': 'compra'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['uso'], 'compra')
        self.assertEqual(respuesta.data['nombre'], 'Caja')

    def test_estado_conserva_el_registro_y_exige_producto_activo_para_habilitar(self):
        ruta = self.ruta(f'{self.presentacion.pk}/estado/')
        respuesta = self.client.post(ruta, {'activo': False, 'version': obtener_version_presentacion(self.presentacion)}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.producto.activo = False
        self.producto.save()
        self.presentacion.refresh_from_db()
        self.assertEqual(self.client.post(ruta, {'activo': True, 'version': obtener_version_presentacion(self.presentacion)}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.ruta(), self.datos(), format='json').status_code, 400)
        self.assertEqual(self.editar({'nombre': 'Caja conservada'}).status_code, 200)
        self.assertEqual(PresentacionProducto.objects.count(), 1)

    def test_presentaciones_no_bloquean_la_unidad_del_producto(self):
        otra = UnidadMedida.objects.create(nombre='Unidad', abreviatura='u')
        respuesta = self.client.patch(f'/api/v1/productos/{self.producto.pk}/', {'unidad_medida': otra.pk, 'version': version_producto(self.producto)}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.presentacion.refresh_from_db()
        self.assertEqual(self.presentacion.nombre, 'Caja')
        self.assertEqual(self.presentacion.producto_id, self.producto.pk)

    def test_campos_retirados_no_se_aceptan_ni_existen_en_la_tabla(self):
        from django.db import connection
        with connection.cursor() as cursor:
            columnas = {columna.name for columna in connection.introspection.get_table_description(cursor, 'presentaciones_producto')}
        for campo, valor in [('tipo_equivalencia', 'variable'), ('equivalencia_base', '12.500'), ('unidad_base', self.unidad.pk)]:
            self.assertNotIn(campo, columnas)
            respuesta = self.client.post(self.ruta(), self.datos(**{campo: valor}), format='json')
            self.assertEqual(respuesta.status_code, 400, respuesta.data)
            self.assertIn(campo, respuesta.data['errors'])
            with self.assertRaises(ValidationError):
                guardar_presentacion(self.administrador, self.producto.pk, self.datos(**{campo: valor}))
        self.assertEqual(PresentacionProducto.objects.count(), 1)

    def test_auditoria_incluye_contexto_y_lecturas_con_modulo_correcto(self):
        self.client.get(self.ruta())
        self.assertTrue(RegistroActividad.objects.filter(modulo='presentaciones', accion='listar', resultado='exito').exists())
        self.assertFalse(RegistroActividad.objects.filter(modulo='productos', accion='listar').exists())
        self.assertEqual(self.editar({'nombre': 'Caja editada'}).status_code, 200)
        evento = RegistroActividad.objects.get(modulo='presentaciones', accion='editar', resultado='exito')
        self.assertEqual(evento.cambios['nombre'], {'antes': 'Caja', 'despues': 'Caja editada'})
        self.assertNotIn('actualizado_en', evento.cambios)
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.post(self.ruta(), self.datos(), format='json').status_code, 403)
        self.assertTrue(RegistroActividad.objects.filter(modulo='presentaciones', resultado='rechazado', codigo_http=403).exists())

    def test_escritura_fuera_de_http_es_atomica_y_normaliza(self):
        registro = guardar_presentacion(self.administrador, self.producto.pk, self.datos(nombre='  Bolsa   grande  '))
        self.assertEqual(registro.nombre, 'Bolsa grande')
        evento = RegistroActividad.objects.get(modulo='presentaciones', objeto_id=str(registro.pk), accion='crear')
        self.assertEqual(evento.origen, 'sistema')
        with patch('productos.servicios_presentaciones.registrar_actividad', side_effect=RuntimeError('Sin evidencia')):
            with self.assertRaises(RuntimeError):
                guardar_presentacion(self.administrador, self.producto.pk, self.datos(nombre='No persistir'))
        self.assertFalse(PresentacionProducto.objects.filter(nombre='No persistir').exists())

    def test_servicio_traduce_colisiones_de_nombre(self):
        with self.assertRaises(ValidationError) as contexto:
            guardar_presentacion(self.administrador, self.producto.pk, self.datos(nombre='CAJA'))
        self.assertIn('nombre', contexto.exception.detail)

    def test_sesion_expone_permisos_sin_ampliar_los_de_producto(self):
        self.client.force_authenticate(self.editor_producto)
        sesion = self.client.get('/api/v1/auth/me/').data
        self.assertFalse(any(sesion['permisos_presentaciones'].values()))
        self.client.force_authenticate(self.editor_presentacion)
        sesion = self.client.get('/api/v1/auth/me/').data
        self.assertEqual(sesion['permisos_presentaciones'], {'ver': True, 'crear': False, 'editar': True, 'cambiar_estado': False})
        self.assertFalse(sesion['permisos_productos']['editar'])
