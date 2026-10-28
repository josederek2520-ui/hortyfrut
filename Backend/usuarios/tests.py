from datetime import timedelta
from django.contrib.auth.models import Group, Permission
from django.core.cache import cache
from django.core.management import call_command
from django.core.exceptions import FieldDoesNotExist
from django.db import connection
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Usuario, ActividadUsuario


class ModuloUsuariosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'PruebaSegura_2026!'
        cls.admin = Usuario.objects.create_superuser(cedula_identidad='10000001', password=cls.password, email='admin@example.test', first_name='Admin', last_name='Prueba')
        cls.reader = Usuario.objects.create_user(cedula_identidad='10000002', password=cls.password, email='lector@example.test')
        cls.target = Usuario.objects.create_user(cedula_identidad='00123456', password=cls.password, email='operador@example.test')
        cls.view_permission = Permission.objects.get(content_type__app_label='usuarios', codename='view_usuario')
        cls.reader.user_permissions.add(cls.view_permission)
        cls.role = Group.objects.create(name='Consulta')
        cls.role.permissions.add(cls.view_permission)

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def payload(self, **changes):
        return {'first_name': 'Ana', 'last_name': 'Lopez', 'email': 'ana@example.test',
                'password': 'CuentaNueva_2026!', 'cedula_identidad': '00098765', 'celular': '070123456',
                'fecha_nacimiento': '1995-04-12', 'direccion': 'Direccion de prueba', **changes}

    def test_anonimo_no_consulta_datos(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/usuarios/').status_code, 401)

    def test_creacion_guarda_ceros_hash_roles_y_auditoria(self):
        response = self.client.post('/api/v1/usuarios/', self.payload(roles=[self.role.pk]), format='json')
        self.assertEqual(response.status_code, 201, response.data)
        user = Usuario.objects.get(cedula_identidad='00098765')
        self.assertEqual(user.cedula_identidad, '00098765')
        self.assertEqual(user.celular, '070123456')
        self.assertTrue(user.check_password('CuentaNueva_2026!'))
        self.assertNotEqual(user.password, 'CuentaNueva_2026!')
        self.assertTrue(user.groups.filter(pk=self.role.pk).exists())
        self.assertNotIn('password', response.data)
        self.assertNotIn('username', response.data)
        self.assertNotIn('password', user.actividad.get().campos)

    def test_rechaza_letras_signos_y_fecha_futura(self):
        for changes, field in [({'cedula_identidad': '123A'}, 'cedula_identidad'), ({'celular': '+591123'}, 'celular'),
                               ({'cedula_identidad': '123\n'}, 'cedula_identidad'),
                               ({'fecha_nacimiento': str(timezone.localdate() + timedelta(days=1))}, 'fecha_nacimiento')]:
            with self.subTest(field=field, changes=changes):
                response = self.client.post('/api/v1/usuarios/', self.payload(**changes), format='json')
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data['errors'])

    def test_no_duplica_cedula_o_correo_sin_importar_mayusculas(self):
        for changes in ({'cedula_identidad': self.target.cedula_identidad}, {'email': 'OPERADOR@example.test'}):
            response = self.client.post('/api/v1/usuarios/', self.payload(**changes), format='json')
            self.assertEqual(response.status_code, 400)

    def test_no_permite_password_debil(self):
        response = self.client.post('/api/v1/usuarios/', self.payload(password='12345678'), format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data['errors'])

    def test_consulta_no_puede_crear_editar_o_desactivar(self):
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.get('/api/v1/usuarios/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/usuarios/', self.payload(), format='json').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/v1/usuarios/{self.target.pk}/', {'first_name': 'Cambio'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(f'/api/v1/usuarios/{self.target.pk}/estado/', {'is_active': False}, format='json').status_code, 403)

    def test_rechaza_campos_privilegiados_en_edicion(self):
        for field in ('is_superuser', 'is_staff', 'is_active', 'user_permissions', 'groups'):
            response = self.client.patch(f'/api/v1/usuarios/{self.target.pk}/', {field: True}, format='json')
            self.assertEqual(response.status_code, 400)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_superuser)

    def test_usuario_no_puede_desactivar_su_propia_cuenta(self):
        response = self.client.post(f'/api/v1/usuarios/{self.admin.pk}/estado/', {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_desactivar_conserva_datos_y_bloquea_login(self):
        response = self.client.post(f'/api/v1/usuarios/{self.target.pk}/estado/', {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)
        self.assertEqual(self.target.cedula_identidad, '00123456')
        self.assertFalse(APIClient().login(email=self.target.email, password=self.password))
        self.assertEqual(self.target.actividad.get().accion, 'desactivado')

    def test_asignar_roles_exige_permiso_especifico(self):
        self.reader.user_permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='change_usuario'))
        self.client.force_authenticate(Usuario.objects.get(pk=self.reader.pk))
        response = self.client.patch(f'/api/v1/usuarios/{self.target.pk}/', {'roles': [self.role.pk]}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_no_puede_asignar_permisos_superiores(self):
        self.reader.user_permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='change_usuario'), Permission.objects.get(content_type__app_label='usuarios', codename='asignar_roles'))
        privileged = Group.objects.create(name='Privilegiado')
        privileged.permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='restablecer_password'))
        self.client.force_authenticate(Usuario.objects.get(pk=self.reader.pk))
        response = self.client.patch(f'/api/v1/usuarios/{self.target.pk}/', {'roles': [privileged.pk]}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_busqueda_filtros_paginacion_y_resumen(self):
        Usuario.objects.bulk_create([Usuario(first_name=f'Cuenta{i}', email=f'cuenta{i}@example.test', cedula_identidad=str(2000+i), is_active=i%2 == 0) for i in range(12)])
        self.target.groups.add(self.role)
        response = self.client.get('/api/v1/usuarios/')
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['count'], 15)
        self.assertEqual(len(self.client.get('/api/v1/usuarios/?page=2').data['results']), 5)
        self.assertEqual(self.client.get('/api/v1/usuarios/?search=00123456').data['count'], 1)
        self.assertEqual(self.client.get(f'/api/v1/usuarios/?role={self.role.pk}').data['count'], 1)
        summary = self.client.get('/api/v1/usuarios/resumen/').data
        self.assertEqual(summary['total'], summary['activos'] + summary['inactivos'])

    def test_perfil_propio_no_admite_roles_ni_indicadores_tecnicos(self):
        self.client.force_authenticate(self.target)
        self.assertEqual(self.client.get('/api/v1/auth/profile/').status_code, 200)
        response = self.client.patch('/api/v1/auth/profile/', {'celular': '00112233'}, format='json')
        self.assertEqual(response.status_code, 200)
        for field in ('roles', 'is_superuser', 'is_staff', 'username'):
            self.assertEqual(self.client.patch('/api/v1/auth/profile/', {field: True}, format='json').status_code, 400)

    def test_cambio_password_propio_exige_password_actual(self):
        self.client.force_authenticate(self.target)
        url = '/api/v1/auth/profile/password/'
        self.assertEqual(self.client.post(url, {'password': 'NuevaSegura_2026!'}, format='json').status_code, 400)
        response = self.client.post(url, {'password': 'NuevaSegura_2026!', 'current_password': self.password}, format='json')
        self.assertEqual(response.status_code, 200)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password('NuevaSegura_2026!'))

    def test_login_y_mutaciones_requieren_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        credentials = {'email': 'admin@example.test', 'password': self.password}
        self.assertEqual(client.post('/api/v1/auth/login/', credentials, format='json').status_code, 403)
        response = client.get('/api/v1/auth/csrf/')
        self.assertTrue(response.cookies['csrftoken']['httponly'])
        response = client.post('/api/v1/auth/login/', credentials, format='json', HTTP_X_CSRFTOKEN=response.json()['csrfToken'])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.cookies['sessionid']['httponly'])
        self.assertEqual(client.get('/api/v1/auth/me/').status_code, 200)
        self.assertEqual(client.post(f'/api/v1/usuarios/{self.target.pk}/estado/', {'is_active': False}, format='json').status_code, 403)
        response = client.post('/api/v1/auth/logout/', {}, format='json', HTTP_X_CSRFTOKEN=response.data['csrfToken'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get('/api/v1/auth/me/').status_code, 401)

    def test_roles_iniciales_son_idempotentes(self):
        call_command('preparar_roles', verbosity=0)
        count = Group.objects.count()
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(Group.objects.count(), count)

    def test_no_puede_editar_cuenta_con_permisos_superiores(self):
        self.reader.user_permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='change_usuario'))
        self.target.user_permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='asignar_roles'))
        self.client.force_authenticate(Usuario.objects.get(pk=self.reader.pk))
        response = self.client.patch(f'/api/v1/usuarios/{self.target.pk}/', {'first_name': 'Cambio'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_editor_puede_actualizar_cuenta_sin_acceso_superior(self):
        self.reader.user_permissions.add(Permission.objects.get(content_type__app_label='usuarios', codename='change_usuario'))
        self.client.force_authenticate(Usuario.objects.get(pk=self.reader.pk))
        response = self.client.patch(f'/api/v1/usuarios/{self.target.pk}/', {'first_name': 'Nuevo'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_correo_es_el_identificador_y_no_existe_username(self):
        self.assertEqual(Usuario.USERNAME_FIELD, 'email')
        with self.assertRaises(FieldDoesNotExist):
            Usuario._meta.get_field('username')
        with connection.cursor() as cursor:
            columns = [field.name for field in connection.introspection.get_table_description(cursor, Usuario._meta.db_table)]
        self.assertNotIn('username', columns)

    def test_login_con_correo_conserva_cedula_y_contrasena(self):
        client = APIClient()
        response = client.post('/api/v1/auth/login/', {'email': 'operador@example.test', 'password': self.password}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['cedula_identidad'], '00123456')
        self.assertNotIn('username', response.data['user'])

    def test_login_no_admite_identificadores_alternativos(self):
        client = APIClient()
        for body in ({'username': 'administrador'}, {'cedula_identidad': '10000001'}, {'email': '10000001'}, {'email': 'admin@example.test', 'cedula_identidad': '10000001'}):
            response = client.post('/api/v1/auth/login/', {**body, 'password': self.password}, format='json')
            self.assertEqual(response.status_code, 400)

    def test_cedula_obligatoria_y_manager_valida_numeros(self):
        for value in ('', '12A', '123 456', None, '1' * 31):
            with self.assertRaises(ValueError):
                Usuario.objects.create_user(email='manager@example.test', cedula_identidad=value, password=self.password)
        body = self.payload()
        del body['cedula_identidad']
        self.assertEqual(self.client.post('/api/v1/usuarios/', body, format='json').status_code, 400)

    def test_formulario_de_admin_crea_usuario_con_cedula(self):
        from .forms import UsuarioCreationForm
        form = UsuarioCreationForm(data={'cedula_identidad': '000777888', 'first_name': 'Carlos', 'last_name': 'Prueba', 'email': 'form@example.test', 'password1': 'Formulario_2026!', 'password2': 'Formulario_2026!'})
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertEqual(user.cedula_identidad, '000777888')
        self.assertTrue(user.check_password('Formulario_2026!'))

    def test_createsuperuser_funciona_con_correo(self):
        from unittest.mock import patch
        with patch.dict('os.environ', {'DJANGO_SUPERUSER_PASSWORD': 'Administrador_2026!'}):
            call_command('createsuperuser', cedula_identidad='000999111', email='cli@example.test', interactive=False, verbosity=0)
        user = Usuario.objects.get(cedula_identidad='000999111')
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.check_password('Administrador_2026!'))

    def test_acceso_por_correo_ignora_mayusculas_y_espacios(self):
        cliente = APIClient()
        respuesta = cliente.post('/api/v1/auth/login/', {'email': '  OPERADOR@EXAMPLE.TEST  ', 'password': self.password}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['user']['id'], self.target.pk)

    def test_credenciales_incorrectas_no_revelan_si_existe_correo(self):
        cliente = APIClient()
        respuestas = [cliente.post('/api/v1/auth/login/', {'email': correo, 'password': 'Incorrecta'}, format='json') for correo in ('operador@example.test', 'nadie@example.test')]
        self.assertEqual([respuesta.status_code for respuesta in respuestas], [400, 400])
        self.assertEqual(respuestas[0].data, respuestas[1].data)

    def test_manager_exige_y_normaliza_correo(self):
        usuario = Usuario.objects.create_user(email='  NUEVO@EXAMPLE.TEST  ', cedula_identidad='77112233', password=self.password)
        self.assertEqual(usuario.email, 'nuevo@example.test')
        self.assertTrue(usuario.check_password(self.password))
        for correo in ('', None, 'no-es-correo', '   ', 'a' * 250 + '@example.test'):
            with self.subTest(correo=correo), self.assertRaises(ValueError):
                Usuario.objects.create_user(email=correo, cedula_identidad='99112233')

    def test_correo_es_obligatorio_tambien_en_creacion_api(self):
        for cambios in ({'email': ''}, {'email': 'invalido'}, {'email': None}):
            self.assertEqual(self.client.post('/api/v1/usuarios/', self.payload(**cambios), format='json').status_code, 400)

    def test_admin_autentica_por_correo(self):
        from django.contrib.admin.forms import AdminAuthenticationForm
        from django.test import RequestFactory
        formulario = AdminAuthenticationForm(RequestFactory().get('/admin/login/'), data={'username': 'ADMIN@EXAMPLE.TEST', 'password': self.password})
        self.assertTrue(formulario.is_valid(), formulario.errors)
        self.assertEqual(formulario.get_user().pk, self.admin.pk)

    def test_actualizar_correo_conserva_sesion_y_cambia_acceso(self):
        cliente = APIClient()
        self.assertTrue(cliente.login(email='operador@example.test', password=self.password))
        anterior = self.target.password
        respuesta = cliente.patch('/api/v1/auth/profile/', {'email': 'CAMBIO@EXAMPLE.TEST'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(cliente.get('/api/v1/auth/me/').status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.email, 'cambio@example.test')
        self.assertEqual(self.target.password, anterior)
        cliente.logout()
        self.assertFalse(cliente.login(email='operador@example.test', password=self.password))
        self.assertTrue(cliente.login(email='cambio@example.test', password=self.password))
