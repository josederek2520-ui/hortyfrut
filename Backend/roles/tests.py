from django.contrib import admin
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient
from usuarios.models import Usuario
from usuarios.services import guardar_usuario
from .models import ActividadRol
from .services import version_rol


class RolesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = Usuario.objects.create_superuser(cedula_identidad='810001', password='TestRoles_2026!', email='super@roles.test')
        cls.manager = Usuario.objects.create_user(cedula_identidad='810002', email='manager@roles.test', is_staff=True)
        cls.reader = Usuario.objects.create_user(cedula_identidad='810003', email='reader@roles.test')
        cls.member = Usuario.objects.create_user(cedula_identidad='810004', email='member@roles.test')
        cls.view_users = Permission.objects.get(content_type__app_label='usuarios', codename='view_usuario')
        cls.edit_users = Permission.objects.get(content_type__app_label='usuarios', codename='change_usuario')
        cls.group_permissions = Permission.objects.filter(content_type__app_label='auth', content_type__model='group')
        cls.manager.user_permissions.set([*cls.group_permissions, cls.view_users])
        cls.reader.user_permissions.add(cls.view_users)
        cls.role = Group.objects.create(name='Lectores')
        cls.role.permissions.add(cls.view_users)
        cls.member.groups.add(cls.role)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.superuser)

    def url(self, role=None):
        return f'/api/v1/roles/{(role or self.role).pk}/'

    def patch(self, changes, role=None):
        target = role or self.role
        return self.client.patch(self.url(target), {'version': version_rol(target), **changes}, format='json')

    def delete(self, role=None):
        target = role or self.role
        return self.client.delete(self.url(target), {'version': version_rol(target)}, format='json')

    def test_anonimo_no_accede(self):
        self.client.force_authenticate(None)
        for url in ['/api/v1/roles/', '/api/v1/permisos/', '/api/v1/roles/opciones/']:
            self.assertEqual(self.client.get(url).status_code, 401)

    def test_ver_usuarios_no_otorga_gestion_roles(self):
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.get('/api/v1/roles/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/permisos/').status_code, 403)
        response = self.client.get('/api/v1/roles/opciones/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)

    def test_solo_ver_roles_no_puede_mutar(self):
        self.reader.user_permissions.add(self.group_permissions.get(codename='view_group'))
        self.client.force_authenticate(Usuario.objects.get(pk=self.reader.pk))
        self.assertEqual(self.client.get('/api/v1/roles/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/roles/', {'name': 'Nuevo', 'permissions': []}, format='json').status_code, 403)
        self.assertEqual(self.patch({'name': 'Cambio'}).status_code, 403)
        self.assertEqual(self.delete().status_code, 403)

    def test_catalogo_solo_acciones_funcionales_y_ver_usuarios(self):
        response = self.client.get('/api/v1/permisos/')
        permissions = [p for module in response.data for p in module['permissions']]
        self.assertEqual(len(permissions), 74)
        self.assertEqual({p['code'] for p in permissions if p['module'] == 'cajillas'}, {
            'cajillas.view_cajilla', 'cajillas.add_cajilla', 'cajillas.registrar_ingreso',
            'cajillas.registrar_salida', 'cajillas.registrar_devolucion',
        })
        self.assertEqual({p['code'] for p in permissions if p['module'] == 'almacenes'}, {
            'almacenes.view_almacen', 'almacenes.add_almacen',
            'almacenes.change_almacen', 'almacenes.cambiar_estado_almacen',
        })
        self.assertEqual({p['code'] for p in permissions if p['module'] == 'compras'}, {
            'compras.view_compra', 'compras.add_compra', 'compras.change_compra',
            'compras.registrar_compra', 'compras.cancelar_compra',
        })
        self.assertEqual({p['code'] for p in permissions if p['module'] == 'proveedores'}, {
            'proveedores.view_proveedor', 'proveedores.add_proveedor',
            'proveedores.change_proveedor', 'proveedores.cambiar_estado_proveedor',
        })
        self.assertEqual(next(p['label'] for p in permissions if p['code'] == 'usuarios.view_usuario'), 'Ver usuarios')
        self.assertNotIn('usuarios.delete_usuario', [p['code'] for p in permissions])
        self.assertTrue(all(p['asignable'] for p in permissions))

    def test_catalogo_indica_permisos_no_otorgables(self):
        self.client.force_authenticate(self.manager)
        permissions = [p for module in self.client.get('/api/v1/permisos/').data for p in module['permissions']]
        self.assertFalse(next(p['asignable'] for p in permissions if p['code'] == 'usuarios.change_usuario'))

    def test_crear_editar_y_auditar(self):
        response = self.client.post('/api/v1/roles/', {'name': ' Operaciones ', 'permissions': [self.view_users.pk]}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        role = Group.objects.get(pk=response.data['id'])
        self.assertEqual(role.name, 'Operaciones')
        self.assertEqual(role.actividad_roles.get().cambios['despues']['permissions'], ['usuarios.view_usuario'])
        response = self.patch({'name': 'Operadores', 'permissions': [self.view_users.pk, self.edit_users.pk]}, role)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['permisos_count'], 2)
        self.assertEqual(role.actividad_roles.count(), 2)

    def test_validaciones_nombre_catalogo_y_campos_desconocidos(self):
        hidden = Permission.objects.get(content_type__app_label='auth', codename='add_permission')
        for payload in [{'name': 'lectores', 'permissions': []}, {'name': '  ', 'permissions': []},
                        {'name': 'x' * 151, 'permissions': []}, {'name': 'Oculto', 'permissions': [hidden.pk]},
                        {'name': 'Invalido', 'permissions': [], 'is_superuser': True}]:
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post('/api/v1/roles/', payload, format='json').status_code, 400)

    def test_unicidad_tambien_en_postgres(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Group.objects.create(name='LECTORES')

    def test_no_otorga_permisos_que_no_posee(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post('/api/v1/roles/', {'name': 'Elevado', 'permissions': [self.edit_users.pk]}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Group.objects.filter(name='Elevado').exists())
        self.assertEqual(self.patch({'permissions': [self.edit_users.pk]}).status_code, 403)

    def test_no_edita_ni_elimina_rol_superior(self):
        self.role.permissions.add(self.edit_users)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.patch({'name': 'Cambio'}).status_code, 403)
        self.assertEqual(self.delete().status_code, 403)
        response = self.client.get(self.url())
        self.assertFalse(response.data['gestion']['edit'])
        self.assertEqual(response.data['gestion']['reason'], 'higher_permissions')

    def test_no_modifica_su_propio_rol(self):
        self.manager.groups.add(self.role)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.patch({'permissions': []}).status_code, 403)
        self.assertEqual(self.patch({'name': 'Cambio'}).status_code, 403)

    def test_rol_asignado_a_superusuario_protegido(self):
        self.superuser.groups.add(self.role)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.patch({'name': 'Cambio'}).status_code, 403)

    def test_no_elimina_rol_con_usuarios(self):
        self.assertEqual(self.delete().status_code, 400)
        self.assertTrue(Group.objects.filter(pk=self.role.pk).exists())
        self.assertTrue(self.member.groups.filter(pk=self.role.pk).exists())

    def test_eliminacion_conserva_auditoria(self):
        role = Group.objects.create(name='Temporal')
        self.assertEqual(self.delete(role).status_code, 204)
        activity = ActividadRol.objects.get(nombre_rol='Temporal')
        self.assertIsNone(activity.rol_id)
        self.assertEqual(activity.actor, self.superuser)
        self.assertEqual(activity.accion, 'eliminado')

    def test_version_evitar_sobrescribir_cambios_ajenos(self):
        old = version_rol(self.role)
        self.assertEqual(self.patch({'name': 'Primero'}).status_code, 200)
        response = self.client.patch(self.url(), {'name': 'Segundo', 'version': old}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'role_conflict')
        response = self.client.delete(self.url(), {'version': old}, format='json')
        self.assertEqual(response.status_code, 409)

    def test_patch_y_delete_exigen_version(self):
        self.assertEqual(self.client.patch(self.url(), {'name': 'Sin version'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete(self.url(), {}, format='json').status_code, 400)

    def test_lista_filtros_contadores_sin_duplicar_joins(self):
        self.role.permissions.add(self.edit_users)
        self.reader.groups.add(self.role)
        Group.objects.create(name='Sin miembros')
        data = self.client.get('/api/v1/roles/?membership=assigned&search=Lector').data
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['usuarios_count'], 2)
        self.assertEqual(data['results'][0]['permisos_count'], 2)
        self.assertNotIn('users', data['results'][0])
        counts = self.client.get('/api/v1/roles/resumen/').data
        self.assertEqual(counts, {'total': 2, 'asignados': 1, 'sin_usuarios': 1})
        self.assertEqual(self.client.get('/api/v1/roles/?membership=unassigned').data['count'], 1)

    def test_roles_no_otorgan_acceso_a_datos_personales(self):
        user = Usuario.objects.create_user(cedula_identidad='810099', email='roleonly@roles.test')
        user.user_permissions.add(self.group_permissions.get(codename='view_group'))
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get('/api/v1/roles/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/v1/usuarios/?role={self.role.pk}').status_code, 403)
        session = self.client.get('/api/v1/auth/me/').data
        self.assertTrue(session['role_capabilities']['view'])
        self.assertFalse(session['capabilities']['view'])

    def test_cambio_de_rol_aplica_en_siguiente_solicitud(self):
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get('/api/v1/usuarios/').status_code, 200)
        self.role.permissions.clear()
        self.client.force_authenticate(Usuario.objects.get(pk=self.member.pk))
        self.assertEqual(self.client.get('/api/v1/usuarios/').status_code, 403)

    def test_asignacion_revalida_permisos_del_rol_bajo_bloqueo(self):
        self.manager.user_permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='asignar_roles'))
        cached_role = Group.objects.prefetch_related('permissions__content_type').get(pk=self.role.pk)
        self.role.permissions.add(self.edit_users)
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            guardar_usuario(Usuario.objects.get(pk=self.manager.pk), {'groups': [cached_role]}, self.reader)

    def test_admin_tecnico_no_permite_saltar_restricciones(self):
        request = RequestFactory().get('/admin/')
        request.user = self.manager
        for model in [Group, Usuario]:
            model_admin = admin.site._registry[model]
            self.assertFalse(model_admin.has_add_permission(request))
            self.assertFalse(model_admin.has_change_permission(request))

    def test_preparacion_no_amplia_roles_existentes(self):
        role = Group.objects.create(name='Administrador de roles')
        role.permissions.add(self.view_users)
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(list(role.permissions.values_list('pk', flat=True)), [self.view_users.pk])
