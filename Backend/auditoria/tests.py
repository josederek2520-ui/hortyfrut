import importlib
import json
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch
from django.apps import apps
from django.contrib import admin
from django.contrib.admin.models import LogEntry, ADDITION
from django.contrib.auth.models import AnonymousUser, Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db import connection, transaction
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings
from django.urls import path
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient
from rest_framework.views import APIView
from usuarios.models import Usuario, ActividadUsuario
from usuarios.services import guardar_usuario
from roles.models import ActividadRol
from roles.services import guardar_rol, eliminar_rol, version_rol
from .contexto import solicitud_actual
from .middleware import RegistroActividadMiddleware
from .models import RegistroActividad
from .servicios import diferencias, limpiar_cambios, registrar_actividad


class VistaModuloFuturo(APIView):
    def get(self, request, pk):
        return Response({'id': pk})

    def post(self, request, pk):
        return Response({'id': pk}, status=201)


urlpatterns = [path('api/v1/futuro/<int:pk>/', VistaModuloFuturo.as_view())]


class AuditoriaTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(cedula_identidad='710001', email='admin@actividad.test', password='AuditoriaSegura_2026!', first_name='Ana', last_name='Auditora')
        cls.lector = Usuario.objects.create_user(cedula_identidad='710002', email='lector@actividad.test')
        cls.lector.user_permissions.add(Permission.objects.get(content_type__app_label='auditoria', codename='ver_registroactividad'))
        cls.sin_acceso = Usuario.objects.create_user(cedula_identidad='710003', email='sinacceso@actividad.test')
        cls.objetivo = Usuario.objects.create_user(cedula_identidad='710004', email='objetivo@actividad.test', first_name='Luis')

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(self.administrador)

    def test_permiso_independiente_y_solo_lectura(self):
        registro = registrar_actividad('pruebas', 'crear', actor=self.administrador)
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/actividad/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/v1/actividad/{registro.pk}/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/usuarios/').status_code, 403)
        for metodo in ('post', 'patch', 'delete'):
            self.assertEqual(getattr(self.client, metodo)(f'/api/v1/actividad/{registro.pk}/', {}, format='json').status_code, 405)
        self.assertEqual(self.client.post('/api/v1/actividad/', {}, format='json').status_code, 405)

    def test_anonimo_y_cuenta_sin_permiso_no_ven_historial(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/actividad/').status_code, 401)
        self.client.force_authenticate(self.sin_acceso)
        for ruta in ('actividad/', 'actividad/resumen/', 'actividad/opciones/'):
            self.assertEqual(self.client.get('/api/v1/' + ruta).status_code, 403)

    def test_cambios_usuario_con_valores_anteriores_y_proteccion(self):
        respuesta = self.client.patch(f'/api/v1/usuarios/{self.objetivo.pk}/', {'first_name': 'Carlos', 'celular': '070123456'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        registro = RegistroActividad.objects.get(modulo='usuarios', accion='editar')
        self.assertEqual(registro.cambios['first_name'], {'antes': 'Luis', 'despues': 'Carlos'})
        self.assertEqual(registro.cambios['celular'], '[dato protegido]')
        self.assertNotIn('070123456', json.dumps(registro.cambios))
        self.assertEqual(registro.actor_id, self.administrador.pk)
        self.assertEqual(registro.origen, 'api')
        self.assertEqual(registro.metodo, 'PATCH')
        self.assertEqual(str(registro.solicitud_id), respuesta['X-Request-ID'])

    def test_accion_exitosa_no_se_duplica_por_middleware(self):
        self.client.patch(f'/api/v1/usuarios/{self.objetivo.pk}/', {'first_name': 'Eva'}, format='json')
        self.assertEqual(RegistroActividad.objects.filter(modulo='usuarios', accion='editar', objeto_id=str(self.objetivo.pk)).count(), 1)

    def test_rollback_revierte_operacion_y_auditoria(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                guardar_usuario(self.administrador, {'first_name': 'Revertido'}, self.objetivo)
                raise RuntimeError('revertir')
        self.objetivo.refresh_from_db()
        self.assertEqual(self.objetivo.first_name, 'Luis')
        self.assertFalse(RegistroActividad.objects.filter(modulo='usuarios').exists())

    def test_fallo_de_auditoria_revierte_escritura_de_negocio(self):
        with patch('usuarios.services.registrar_actividad', side_effect=RuntimeError('auditoria no disponible')):
            with self.assertRaises(RuntimeError):
                guardar_usuario(self.administrador, {'first_name': 'Sin evidencia'}, self.objetivo)
        self.objetivo.refresh_from_db()
        self.assertEqual(self.objetivo.first_name, 'Luis')

    def test_roles_conservan_evidencia_tras_eliminar(self):
        rol = guardar_rol(self.administrador, {'name': 'Operaciones auditadas', 'permissions': []})
        identificador = str(rol.pk)
        eliminar_rol(self.administrador, rol, version_rol(rol))
        registro = RegistroActividad.objects.get(modulo='roles', accion='eliminar')
        self.assertEqual(registro.objeto_id, identificador)
        self.assertEqual(registro.objeto_nombre, 'Operaciones auditadas')
        self.assertEqual(registro.cambios['registro']['antes']['name'], 'Operaciones auditadas')

    def test_estado_y_password_no_guardan_secreto(self):
        self.assertEqual(self.client.post(f'/api/v1/usuarios/{self.objetivo.pk}/estado/', {'is_active': False}, format='json').status_code, 200)
        clave = 'CambioMuySeguro_2026!'
        self.assertEqual(self.client.post(f'/api/v1/usuarios/{self.objetivo.pk}/password/', {'password': clave}, format='json').status_code, 200)
        registro = RegistroActividad.objects.get(accion='restablecer_contrasena')
        self.assertEqual(registro.cambios, {})
        self.assertNotIn(clave, json.dumps(list(RegistroActividad.objects.values()), default=str))

    def test_login_fallido_se_registra_sin_credenciales(self):
        self.client.force_authenticate(None)
        respuesta = self.client.post('/api/v1/auth/login/', {'email': 'nadie@actividad.test', 'password': 'SecretoFallido'}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        registro = RegistroActividad.objects.get(accion='iniciar_sesion')
        self.assertEqual(registro.resultado, 'rechazado')
        self.assertEqual(registro.responsable, 'Anónimo')
        self.assertNotIn('nadie@actividad.test', json.dumps(registro.cambios))
        self.assertNotIn('SecretoFallido', json.dumps(registro.cambios))

    def test_login_y_logout_conservan_responsable(self):
        cliente = APIClient()
        respuesta = cliente.post('/api/v1/auth/login/', {'email': self.administrador.email, 'password': 'AuditoriaSegura_2026!'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['permisos_actividad']['ver'])
        self.assertEqual(cliente.post('/api/v1/auth/logout/', {}, format='json').status_code, 200)
        for accion in ('iniciar_sesion', 'cerrar_sesion'):
            registro = RegistroActividad.objects.get(accion=accion)
            self.assertEqual(registro.actor_id, self.administrador.pk)
            self.assertEqual(registro.responsable, 'Ana Auditora')

    def test_consultas_se_auditan_y_no_poll_sesion(self):
        self.client.get('/api/v1/auth/me/')
        self.client.get('/api/v1/auth/csrf/')
        self.assertFalse(RegistroActividad.objects.exists())
        self.client.get('/api/v1/usuarios/?search=secreto_consulta')
        registro = RegistroActividad.objects.get(modulo='usuarios', accion='listar')
        self.assertNotIn('secreto_consulta', registro.ruta)

    def test_rechazo_permiso_registrado(self):
        self.client.force_authenticate(self.sin_acceso)
        self.assertEqual(self.client.get('/api/v1/usuarios/').status_code, 403)
        registro = RegistroActividad.objects.get(modulo='usuarios')
        self.assertEqual(registro.resultado, 'rechazado')
        self.assertEqual(registro.codigo_http, 403)

    @override_settings(ROOT_URLCONF=__name__)
    def test_modulo_futuro_queda_cubierto_por_http(self):
        self.assertEqual(self.client.get('/api/v1/futuro/42/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/futuro/42/', {'token': 'NoRegistrar'}, format='json').status_code, 201)
        self.assertEqual(RegistroActividad.objects.filter(modulo='futuro').count(), 2)
        self.assertEqual(RegistroActividad.objects.get(accion='ver_detalle').objeto_id, '42')
        self.assertEqual(RegistroActividad.objects.get(accion='crear').cambios, {})

    def test_procesos_sin_http_usan_servicio_central(self):
        registro = registrar_actividad('inventario', 'ajustar_existencia', cambios={'cantidad': {'antes': 5, 'despues': 8}})
        self.assertEqual(registro.origen, 'sistema')
        self.assertEqual(registro.responsable, 'Sistema')
        self.assertIsNone(registro.actor_id)

    def test_limpieza_recursiva_de_secretos(self):
        resultado = limpiar_cambios({'password': 'a', 'datos': {'access_token': 'b', 'Authorization': 'c', 'EMAIL': {'antes': 'privado@x.test'}, 'cantidad': 8}, 'celular': '123'})
        self.assertEqual(resultado, {'datos': {'EMAIL': '[dato protegido]', 'cantidad': 8}, 'celular': '[dato protegido]'})

    def test_secretos_con_nombres_en_espanol(self):
        self.assertEqual(limpiar_cambios({'credenciales': {'usuario': 'privado'}, 'clave_api': 'secreto', 'autorizacion': 'secreto', 'sesion': 'secreto'}), {})

    def test_nombres_largos_no_impiden_registrar_eventos(self):
        self.administrador.first_name = 'A' * 150
        self.administrador.last_name = 'B' * 150
        registro = registrar_actividad('pruebas', 'crear', actor=self.administrador, descripcion='C' * 300)
        self.assertEqual(len(registro.responsable), 200)
        self.assertEqual(len(registro.descripcion), 250)

    def test_filtros_fecha_horaria_busqueda_y_resultado(self):
        momento = timezone.make_aware(datetime(2026, 4, 12, 23, 59))
        registro = registrar_actividad('inventario', 'ajustar', actor=self.administrador, objeto_nombre='Lote especial', fecha=momento, resultado='rechazado')
        otro = registrar_actividad('inventario', 'crear', fecha=timezone.make_aware(datetime(2026, 4, 13, 0, 0)))
        respuesta = self.client.get('/api/v1/actividad/?modulo=inventario&desde=2026-04-12&hasta=2026-04-12&resultado=rechazado&buscar=Lote')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual([elemento['id'] for elemento in respuesta.data['results']], [registro.pk])
        self.assertNotIn(otro.pk, [elemento['id'] for elemento in respuesta.data['results']])

    def test_filtros_invalidos_no_generan_500(self):
        for parametros in ('desde=no-fecha', 'desde=2026-12-12&hasta=2026-01-01', 'hasta=9999-12-31', 'resultado=desconocido', 'actor=no-numero'):
            with self.subTest(parametros=parametros):
                self.assertEqual(self.client.get('/api/v1/actividad/?' + parametros).status_code, 400)

    def test_resumen_opciones_y_paginacion(self):
        for indice in range(25):
            registrar_actividad('compras', 'crear', resultado='rechazado' if indice == 0 else 'exito')
        self.assertEqual(self.client.get('/api/v1/actividad/?modulo=compras').data['count'], 25)
        self.assertEqual(len(self.client.get('/api/v1/actividad/?modulo=compras&page=2').data['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/actividad/?modulo=compras&page=3').data['results']), 5)
        resumen = self.client.get('/api/v1/actividad/resumen/?modulo=compras&resultado=rechazado').data
        self.assertEqual(resumen, {'total': 25, 'exitosos': 24, 'rechazados': 1, 'errores': 0})
        opciones = self.client.get('/api/v1/actividad/opciones/').data
        self.assertIn('compras', opciones['modulos'])

    def test_responsable_se_conserva_al_eliminar_cuenta(self):
        registro = registrar_actividad('pruebas', 'crear', actor=self.objetivo)
        self.objetivo.delete()
        registro.refresh_from_db()
        self.assertIsNone(registro.actor_id)
        self.assertEqual(registro.responsable, 'Luis')

    def test_paginacion_no_desplaza_filas_al_llegar_eventos(self):
        for indice in range(25):
            registrar_actividad('pruebas', 'crear')
        primera = self.client.get('/api/v1/actividad/').data
        registrar_actividad('pruebas', 'evento_nuevo')
        segunda = self.client.get(f'/api/v1/actividad/?page=2&corte={primera["corte"]}').data
        self.assertEqual(primera['count'], 25)
        self.assertEqual(segunda['count'], 25)
        self.assertEqual(len(segunda['results']), 10)
        self.assertFalse({evento['id'] for evento in primera['results']} & {evento['id'] for evento in segunda['results']})
        self.assertEqual(primera['resumen']['total'], 25)

    def test_importacion_historial_idempotente_y_sin_inventar_valores(self):
        actividad = ActividadUsuario.objects.create(actor=self.administrador, usuario=self.objetivo, accion='actualizado', campos=['celular'])
        anterior = ActividadRol.objects.create(actor=self.administrador, nombre_rol='Rol anterior', accion='eliminado', cambios={'antes': {'name': 'Rol anterior', 'permissions': []}})
        importar = importlib.import_module('auditoria.migrations.0002_importar_historial').importar_historial
        esquema = SimpleNamespace(connection=connection)
        importar(apps, esquema); importar(apps, esquema)
        self.assertEqual(RegistroActividad.objects.filter(clave_origen=f'usuarios:{actividad.pk}').count(), 1)
        registro = RegistroActividad.objects.get(clave_origen=f'usuarios:{actividad.pk}')
        self.assertEqual(registro.cambios, {'campos_registrados': ['celular']})
        self.assertEqual(registro.fecha, actividad.fecha)
        self.assertTrue(RegistroActividad.objects.filter(clave_origen=f'roles:{anterior.pk}').exists())

    def test_admin_es_de_solo_lectura_y_registra_acciones_tecnicas(self):
        solicitud = RequestFactory().get('/admin/')
        solicitud.user = self.administrador
        administrador = admin.site._registry[RegistroActividad]
        self.assertFalse(administrador.has_add_permission(solicitud))
        self.assertFalse(administrador.has_change_permission(solicitud))
        self.assertFalse(administrador.has_delete_permission(solicitud))
        LogEntry.objects.create(user=self.administrador, content_type=ContentType.objects.get_for_model(Group), object_id='123', object_repr='Objeto', action_flag=ADDITION)
        registro = RegistroActividad.objects.get(origen='admin')
        self.assertEqual(registro.modulo, 'roles')

    def test_contexto_se_restaura_incluso_si_falla_respuesta(self):
        solicitud = RequestFactory().get('/otro/')
        solicitud.user = AnonymousUser()
        def fallar(solicitud):
            raise RuntimeError('fallo simulado')
        with self.assertRaises(RuntimeError):
            RegistroActividadMiddleware(fallar)(solicitud)
        self.assertIsNone(solicitud_actual.get())
