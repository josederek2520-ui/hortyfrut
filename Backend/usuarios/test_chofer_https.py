from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from usuarios.models import Usuario
from despachos.tests import DatosDespachos

origen_pruebas = 'https://prueba-chofer.trycloudflare.com'


@override_settings(ROOT_URLCONF='config.rutas_chofer_https',
    ALLOWED_HOSTS=['testserver', 'prueba-chofer.trycloudflare.com'],
    CSRF_TRUSTED_ORIGINS=[origen_pruebas], SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True)
class PruebasChoferHTTPS(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()
        cls.chofer = Usuario.objects.create_user(email='https@chofer.test', cedula_identidad='98970', password='Chofer_https_pruebas_2026!')
        cls.chofer.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename__in=[
            'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios']))

    def navegador(self):
        cliente = APIClient(enforce_csrf_checks=True)
        respuesta = cliente.get('/api/v1/auth/csrf/', secure=True, HTTP_HOST='prueba-chofer.trycloudflare.com')
        self.assertTrue(respuesta.cookies['csrftoken']['secure'])
        self.assertTrue(respuesta.cookies['csrftoken']['httponly'])
        cliente.credentials(HTTP_HOST='prueba-chofer.trycloudflare.com', HTTP_ORIGIN=origen_pruebas,
            HTTP_REFERER=origen_pruebas + '/signin', HTTP_X_CSRFTOKEN=respuesta.json()['csrfToken'])
        return cliente

    def ingresar(self, cliente):
        return cliente.post('/api/v1/auth/login/', {'email': self.chofer.email,
            'password': 'Chofer_https_pruebas_2026!', 'remember': False}, format='json', secure=True)

    def test_login_chofer_conserva_csrf_cookies_seguras_y_auditoria(self):
        cliente = self.navegador()
        respuesta = self.ingresar(cliente)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertTrue(respuesta.cookies['sessionid']['secure'])
        self.assertTrue(respuesta.cookies['sessionid']['httponly'])
        self.assertEqual(respuesta.data['permisos_chofer'], {'ver': True, 'operar': True})
        self.assertFalse(respuesta.data['capabilities']['view'])
        self.assertFalse(respuesta.data['permisos_despachos']['ver'])
        self.assertTrue(RegistroActividad.objects.filter(actor=self.chofer, accion='iniciar_sesion').exists())
        self.assertEqual(cliente.get('/api/v1/auth/me/', secure=True).status_code, 200)

    def test_login_publico_permite_chat_a_cuenta_activa_sin_acceso_a_viajes(self):
        self.lector.set_password('Lectura_https_2026!')
        self.lector.save(update_fields=['password'])
        cliente = self.navegador()
        respuesta = cliente.post('/api/v1/auth/login/', {'email': self.lector.email,
            'password': 'Lectura_https_2026!'}, format='json', secure=True)
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['permisos_chofer']['ver'])
        self.assertFalse(respuesta.data['capabilities']['view'])
        cliente._credentials['HTTP_X_CSRFTOKEN'] = respuesta.data['csrfToken']
        self.assertEqual(cliente.get('/api/v1/auth/me/', secure=True).status_code, 200)
        self.assertEqual(cliente.get('/api/v1/chat/conversaciones/', secure=True).status_code, 200)
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 403)

    def test_login_publico_rechaza_csrf_ausente_y_origen_ajeno(self):
        cliente = self.navegador()
        cliente.credentials(HTTP_HOST='prueba-chofer.trycloudflare.com', HTTP_ORIGIN=origen_pruebas)
        self.assertEqual(self.ingresar(cliente).status_code, 403)
        cliente = self.navegador()
        cliente._credentials['HTTP_ORIGIN'] = 'https://otro.trycloudflare.com'
        self.assertEqual(self.ingresar(cliente).status_code, 403)

    def test_la_api_publica_no_registra_rutas_administrativas_ni_bearer(self):
        cliente = self.navegador()
        for ruta in ('admin/', 'api/v1/usuarios/', 'api/v1/roles/', 'api/v1/despachos/',
                     'api/v1/pedidos/', 'api/v1/actividad/', 'api/v1/movil/iniciar-sesion/'):
            self.assertEqual(cliente.get('/' + ruta, secure=True).status_code, 404, ruta)

    def test_sesion_publica_oculta_controles_administrativos_aun_para_superusuario(self):
        cliente = self.navegador()
        cliente.force_login(self.actor)
        respuesta = cliente.get('/api/v1/auth/me/', secure=True)
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['capabilities']['view'])
        self.assertFalse(respuesta.data['role_capabilities']['view'])
        self.assertFalse(respuesta.data['permisos_despachos']['ver'])
        self.assertTrue(respuesta.data['permisos_chofer']['ver'])
        with self.settings(ROOT_URLCONF='config.urls'):
            local = cliente.get('/api/v1/auth/me/', secure=True)
        self.assertTrue(local.data['capabilities']['view'])
        self.assertTrue(local.data['permisos_despachos']['ver'])

    def test_acceso_del_navegador_publico_reutiliza_los_viajes_propios(self):
        viaje = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(viaje, 'enviar')
        cliente = self.navegador()
        respuesta = self.ingresar(cliente)
        cliente._credentials['HTTP_X_CSRFTOKEN'] = respuesta.data['csrfToken']
        self.assertEqual(cliente.post('/api/v1/chofer/acceso/', {}, format='json', secure=True).status_code, 200)
        lista = cliente.get('/api/v1/chofer/mis-viajes/', secure=True)
        self.assertEqual(lista.status_code, 200, lista.data)
        self.assertEqual([fila['id'] for fila in lista.data['results']], [viaje.pk])
