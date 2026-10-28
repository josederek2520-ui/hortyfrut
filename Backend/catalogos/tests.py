from unittest.mock import patch
from django.contrib.auth.models import Group, Permission
from django.core.exceptions import FieldDoesNotExist
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from usuarios.models import Usuario
from .models import UnidadMedida, CategoriaProducto
from .servicios import guardar_catalogo, version_catalogo


class CatalogosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(email='admin@catalogos.test', cedula_identidad='610001', password='CatalogosSeguros_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@catalogos.test', cedula_identidad='610002')
        cls.editor = Usuario.objects.create_user(email='editor@catalogos.test', cedula_identidad='610003')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='catalogos', codename__in=['view_unidadmedida', 'view_categoriaproducto']))
        cls.editor.user_permissions.set(Permission.objects.filter(content_type__app_label='catalogos', codename__in=['view_unidadmedida', 'change_unidadmedida']))
        cls.unidad = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        cls.categoria = CategoriaProducto.objects.create(nombre='Frutas')
        cls.catalogos = [(UnidadMedida, 'unidades-medida', 'unidades_medida'), (CategoriaProducto, 'categorias-productos', 'categorias_productos')]

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.administrador)

    def test_tablas_sin_fraccion_con_fechas_automaticas(self):
        for modelo, _, _ in self.catalogos:
            with self.subTest(modelo=modelo):
                with self.assertRaises(FieldDoesNotExist):
                    modelo._meta.get_field('permite_fraccion')
                with connection.cursor() as cursor:
                    columnas = [columna.name for columna in connection.introspection.get_table_description(cursor, modelo._meta.db_table)]
                self.assertIn('creado_en', columnas)
                self.assertIn('actualizado_en', columnas)
                self.assertNotIn('permite_fraccion', columnas)

    def test_crear_ambos_catalogos_con_valores_normalizados(self):
        for modelo, ruta, modulo in self.catalogos:
            datos = {'nombre': '  Nombre   de prueba  '}
            if modelo is UnidadMedida:
                datos['abreviatura'] = ' mL '
            respuesta = self.client.post(f'/api/v1/{ruta}/', datos, format='json')
            self.assertEqual(respuesta.status_code, 201, respuesta.data)
            self.assertEqual(respuesta.data['nombre'], 'Nombre de prueba')
            self.assertTrue(respuesta.data['activo'])
            self.assertIn('creado_en', respuesta.data)
            self.assertIn('version', respuesta.data)
            self.assertNotIn('actualizado_en', respuesta.data)
            self.assertNotIn('permite_fraccion', respuesta.data)
            registro = modelo.objects.get(pk=respuesta.data['id'])
            self.assertIsNotNone(registro.actualizado_en)
            if modelo is UnidadMedida:
                self.assertEqual(registro.abreviatura, 'mL')
            self.assertEqual(RegistroActividad.objects.filter(modulo=modulo, accion='crear', resultado='exito').count(), 1)

    def test_duplicados_por_nombre_sin_mayusculas(self):
        for modelo, ruta, _ in self.catalogos:
            datos = {'nombre': 'KILOGRAMO' if modelo is UnidadMedida else 'FRUTAS'}
            if modelo is UnidadMedida:
                datos['abreviatura'] = 'otro'
            respuesta = self.client.post(f'/api/v1/{ruta}/', datos, format='json')
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn('nombre', respuesta.data['errors'])

    def test_postgres_impide_nombres_duplicados(self):
        for modelo, _, _ in self.catalogos:
            datos = {'nombre': 'KILOGRAMO', 'abreviatura': 'otro'} if modelo is UnidadMedida else {'nombre': 'FRUTAS'}
            with self.subTest(modelo=modelo), self.assertRaises(IntegrityError), transaction.atomic():
                modelo.objects.create(**datos)

    def test_abreviatura_obligatoria_corta_y_sin_espacios(self):
        for abreviatura in ('', 'a b', 'ab\tcd', 'x' * 11, 'kg'):
            respuesta = self.client.post('/api/v1/unidades-medida/', {'nombre': 'Otra unidad', 'abreviatura': abreviatura}, format='json')
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn('abreviatura', respuesta.data['errors'])

    def test_abreviatura_conserva_escritura_del_simbolo(self):
        respuesta = self.client.post('/api/v1/unidades-medida/', {'nombre': 'Unidad de prueba', 'abreviatura': 'KG'}, format='json')
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data['abreviatura'], 'KG')

    def test_campos_vacios_largos_o_desconocidos_se_rechazan(self):
        for modelo, ruta, _ in self.catalogos:
            base = {'abreviatura': 'u'} if modelo is UnidadMedida else {}
            for nombre in ('', '   ', 'x' * 101, None):
                self.assertEqual(self.client.post(f'/api/v1/{ruta}/', {**base, 'nombre': nombre}, format='json').status_code, 400)
            for campo in ('activo', 'actualizado_en', 'creado_en', 'permite_fraccion'):
                self.assertEqual(self.client.post(f'/api/v1/{ruta}/', {**base, 'nombre': 'Prueba', campo: False}, format='json').status_code, 400)

    def test_actualizado_en_se_guarda_y_no_se_expone(self):
        for registro, ruta in [(self.unidad, 'unidades-medida'), (self.categoria, 'categorias-productos')]:
            anterior = registro.actualizado_en
            respuesta = self.client.patch(f'/api/v1/{ruta}/{registro.pk}/', {'nombre': 'Nombre editado', 'version': version_catalogo(registro)}, format='json')
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            registro.refresh_from_db()
            self.assertGreater(registro.actualizado_en, anterior)
            self.assertNotIn('actualizado_en', respuesta.data)
            self.assertNotIn('actualizado_en', self.client.get(f'/api/v1/{ruta}/{registro.pk}/').data)
            self.assertNotIn('actualizado_en', self.client.get(f'/api/v1/{ruta}/').data['results'][0])

    def test_edicion_y_estado_exigen_version_y_detectan_conflictos(self):
        ruta = f'/api/v1/unidades-medida/{self.unidad.pk}/'
        version = version_catalogo(self.unidad)
        self.assertEqual(self.client.patch(ruta, {'nombre': 'Cambio'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(ruta, {'nombre': 'Cambio', 'version': version}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(ruta, {'nombre': 'Sobrescrito', 'version': version}, format='json').status_code, 409)
        self.assertEqual(self.client.post(ruta+'estado/', {'activo': False, 'version': version}, format='json').status_code, 409)
        self.unidad.refresh_from_db()
        self.assertEqual(self.unidad.nombre, 'Cambio')

    def test_estado_conserva_registro_y_registra_actividad(self):
        for registro, ruta, modulo in [(self.unidad, 'unidades-medida', 'unidades_medida'), (self.categoria, 'categorias-productos', 'categorias_productos')]:
            for activo in (False, True):
                registro.refresh_from_db()
                respuesta = self.client.post(f'/api/v1/{ruta}/{registro.pk}/estado/', {'activo': activo, 'version': version_catalogo(registro)}, format='json')
                self.assertEqual(respuesta.status_code, 200, respuesta.data)
                self.assertEqual(respuesta.data['activo'], activo)
            self.assertTrue(type(registro).objects.filter(pk=registro.pk).exists())
            self.assertEqual(RegistroActividad.objects.filter(modulo=modulo, accion__in=['activar', 'desactivar'], resultado='exito').count(), 2)

    def test_permisos_de_lectura_no_permiten_escribir(self):
        self.client.force_authenticate(self.lector)
        for registro, ruta in [(self.unidad, 'unidades-medida'), (self.categoria, 'categorias-productos')]:
            self.assertEqual(self.client.get(f'/api/v1/{ruta}/').status_code, 200)
            self.assertEqual(self.client.post(f'/api/v1/{ruta}/', {'nombre': 'Invalido'}, format='json').status_code, 403)
            self.assertEqual(self.client.patch(f'/api/v1/{ruta}/{registro.pk}/', {'nombre': 'Invalido', 'version': version_catalogo(registro)}, format='json').status_code, 403)
            self.assertEqual(self.client.post(f'/api/v1/{ruta}/{registro.pk}/estado/', {'activo': False, 'version': version_catalogo(registro)}, format='json').status_code, 403)

    def test_editar_no_otorga_cambio_de_estado_ni_acceso_a_otro_modulo(self):
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.patch(f'/api/v1/unidades-medida/{self.unidad.pk}/', {'nombre': 'Cambio autorizado', 'version': version_catalogo(self.unidad)}, format='json').status_code, 200)
        self.assertEqual(self.client.post(f'/api/v1/unidades-medida/{self.unidad.pk}/estado/', {'activo': False, 'version': version_catalogo(self.unidad)}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/categorias-productos/').status_code, 403)

    def test_anonimo_no_accede_y_no_hay_borrado_fisico(self):
        for _, ruta, _ in self.catalogos:
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(f'/api/v1/{ruta}/').status_code, 401)
            self.client.force_authenticate(self.administrador)
            self.assertEqual(self.client.delete(f'/api/v1/{ruta}/1/').status_code, 405)
        self.assertFalse(Permission.objects.filter(content_type__app_label='catalogos', codename__startswith='delete_').exists())

    def test_busqueda_orden_filtros_y_paginacion(self):
        UnidadMedida.objects.bulk_create([UnidadMedida(nombre=f'Unidad {indice:02}', abreviatura=f'u{indice}', activo=indice%2 == 0) for indice in range(12)])
        self.assertEqual(self.client.get('/api/v1/unidades-medida/').data['count'], 13)
        self.assertEqual(len(self.client.get('/api/v1/unidades-medida/?pagina=2').data['results']), 3)
        self.assertEqual(self.client.get('/api/v1/unidades-medida/?buscar=kg').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/unidades-medida/?activo=false').data['count'], 6)
        resumen = self.client.get('/api/v1/unidades-medida/resumen/?activo=false').data
        self.assertEqual(resumen, {'total': 13, 'activos': 7, 'inactivos': 6})
        self.assertEqual(self.client.get('/api/v1/unidades-medida/?orden=no-permitido').status_code, 400)

    def test_sesion_expone_permisos_independientes(self):
        self.client.force_authenticate(self.editor)
        permisos = self.client.get('/api/v1/auth/me/').data['permisos_catalogos']
        self.assertEqual(permisos['unidades_medida'], {'ver': True, 'crear': False, 'editar': True, 'cambiar_estado': False})
        self.assertFalse(any(permisos['categorias_productos'].values()))

    def test_auditoria_incluye_cambios_sin_fechas_internas(self):
        respuesta = self.client.patch(f'/api/v1/unidades-medida/{self.unidad.pk}/', {'nombre': 'Kilogramos', 'version': version_catalogo(self.unidad)}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        registro = RegistroActividad.objects.get(modulo='unidades_medida', accion='editar', resultado='exito')
        self.assertEqual(registro.cambios['nombre'], {'antes': 'Kilogramo', 'despues': 'Kilogramos'})
        self.assertNotIn('actualizado_en', registro.cambios)
        self.client.get('/api/v1/unidades-medida/')
        self.assertTrue(RegistroActividad.objects.filter(modulo='unidades_medida', accion='listar').exists())

    def test_error_de_auditoria_revierte_la_operacion(self):
        with patch('catalogos.servicios.registrar_actividad', side_effect=RuntimeError('Sin evidencia')):
            with self.assertRaises(RuntimeError):
                guardar_catalogo(UnidadMedida, self.administrador, {'nombre': 'No guardar', 'abreviatura': 'ng'})
        self.assertFalse(UnidadMedida.objects.filter(nombre='No guardar').exists())

    def test_roles_iniciales_no_amplian_roles_existentes(self):
        rol = Group.objects.create(name='Administrador de catálogos')
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(rol.permissions.count(), 0)

    def test_colisiones_de_base_se_presentan_como_errores_de_campo(self):
        from rest_framework.exceptions import ValidationError
        casos = [(UnidadMedida, {'nombre': 'KILOGRAMO', 'abreviatura': 'otra'}, 'nombre'),
                 (UnidadMedida, {'nombre': 'Otra unidad', 'abreviatura': 'kg'}, 'abreviatura'),
                 (CategoriaProducto, {'nombre': 'FRUTAS'}, 'nombre')]
        for modelo, datos, campo in casos:
            with self.subTest(campo=campo), self.assertRaises(ValidationError) as error:
                guardar_catalogo(modelo, self.administrador, datos)
            self.assertIn(campo, error.exception.detail)
