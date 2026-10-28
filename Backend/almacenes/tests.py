from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from usuarios.models import Usuario
from .models import Almacen
from .servicios import guardar_almacen, cambiar_estado_almacen, version_almacen, ConflictoAlmacen


class PruebasAlmacenes(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_superuser(email='admin@almacenes.test', cedula_identidad='840001', password='AlmacenesSeguros_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@almacenes.test', cedula_identidad='840002')
        cls.sin_acceso = Usuario.objects.create_user(email='sinacceso@almacenes.test', cedula_identidad='840003')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='almacenes', codename='view_almacen'))
        cls.almacen = Almacen.objects.create(nombre='Principal', direccion='Calle Los Ficus 10', latitud=Decimal('-16.5000000'), longitud=Decimal('-68.1500000'))

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def ruta(self, sufijo=''):
        return f'/api/v1/almacenes/{self.almacen.pk}/{sufijo}'

    def datos(self, **cambios):
        return {'nombre': '  Almacén   Central  ', 'direccion': '  Avenida   Central 25  ', **cambios}

    def editar(self, datos):
        return self.client.patch(self.ruta(), {**datos, 'version': version_almacen(self.almacen)}, format='json')

    def test_crear_normaliza_registra_fecha_y_auditoria(self):
        respuesta = self.client.post('/api/v1/almacenes/', self.datos(latitud='-17.1234567', longitud='-65.7654321'), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['nombre'], 'Almacén Central')
        self.assertEqual(respuesta.data['direccion'], 'Avenida Central 25')
        self.assertEqual(respuesta.data['latitud'], '-17.1234567')
        self.assertEqual(respuesta.data['longitud'], '-65.7654321')
        self.assertTrue(respuesta.data['activo'])
        self.assertTrue(respuesta.data['creado_en'])
        self.assertNotIn('actualizado_en', respuesta.data)
        evento = RegistroActividad.objects.get(modulo='almacenes', accion='crear', objeto_id=str(respuesta.data['id']))
        self.assertEqual(evento.actor_id, self.admin.pk)
        self.assertIn('latitud', evento.cambios)

    def test_coordenadas_opcionales_pero_siempre_juntas(self):
        respuesta = self.client.post('/api/v1/almacenes/', self.datos(), format='json')
        self.assertEqual(respuesta.status_code, 201)
        self.assertIsNone(respuesta.data['latitud'])
        self.assertIsNone(respuesta.data['longitud'])
        for coordenadas in ({'latitud': '0'}, {'longitud': '0'}, {'latitud': None, 'longitud': '20'}, {'latitud': '20', 'longitud': None}):
            with self.subTest(coordenadas=coordenadas):
                respuesta = self.client.post('/api/v1/almacenes/', self.datos(nombre='Incompleto', **coordenadas), format='json')
                self.assertEqual(respuesta.status_code, 400, respuesta.data)
                self.assertIn('latitud', respuesta.data['errors'])
                self.assertIn('longitud', respuesta.data['errors'])

    def test_cero_y_limites_geograficos_son_validos(self):
        for indice, (latitud, longitud) in enumerate([('0', '0'), ('-0.0000000', '0'), ('-90', '-180'), ('90', '180')]):
            with self.subTest(latitud=latitud, longitud=longitud):
                respuesta = self.client.post('/api/v1/almacenes/', self.datos(nombre=f'Límite {indice}', latitud=latitud, longitud=longitud), format='json')
                self.assertEqual(respuesta.status_code, 201, respuesta.data)
                if indice in (0, 1):
                    self.assertEqual(respuesta.data['latitud'], '0.0000000')
                    self.assertEqual(respuesta.data['longitud'], '0.0000000')

    def test_rechaza_rangos_no_finitos_y_precision_excesiva(self):
        casos = [('latitud', valor) for valor in ('90.0000001', '-90.0000001', 'NaN', 'Infinity', '-Infinity', '1.12345678', 'abc')]
        casos += [('longitud', valor) for valor in ('180.0000001', '-180.0000001', 'NaN', 'Infinity', '1.12345678')]
        for campo, valor in casos:
            with self.subTest(campo=campo, valor=valor):
                respuesta = self.client.post('/api/v1/almacenes/', self.datos(latitud='0', longitud='0') | {campo: valor}, format='json')
                self.assertEqual(respuesta.status_code, 400, respuesta.data)
                self.assertIn(campo, respuesta.data['errors'])

    def test_base_de_datos_protege_par_y_rangos(self):
        for coordenadas in ({'latitud': '0'}, {'longitud': '0'}, {'latitud': '91', 'longitud': '0'}, {'latitud': '0', 'longitud': '181'}):
            with self.subTest(coordenadas=coordenadas), self.assertRaises(IntegrityError), transaction.atomic():
                Almacen.objects.create(nombre='No válido', direccion='Dirección', **coordenadas)

    def test_edicion_parcial_preserva_o_quita_par_completo(self):
        respuesta = self.editar({'latitud': '0'})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data['latitud'], '0.0000000')
        self.assertEqual(respuesta.data['longitud'], '-68.1500000')
        self.almacen.refresh_from_db()
        self.assertEqual(self.editar({'latitud': None}).status_code, 400)
        respuesta = self.editar({'latitud': None, 'longitud': None})
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNone(respuesta.data['latitud'])
        self.assertIsNone(respuesta.data['longitud'])
        self.almacen.refresh_from_db()
        self.assertEqual(self.editar({'longitud': '0'}).status_code, 400)

    def test_nombre_y_direccion_obligatorios_y_normalizados(self):
        for datos, campo in [({'nombre': ''}, 'nombre'), ({'nombre': '  '}, 'nombre'), ({'nombre': 'x' * 151}, 'nombre'),
                            ({'direccion': ''}, 'direccion'), ({'direccion': None}, 'direccion'), ({'direccion': 'x' * 256}, 'direccion')]:
            respuesta = self.client.post('/api/v1/almacenes/', self.datos(**datos), format='json')
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn(campo, respuesta.data['errors'])

    def test_nombre_unico_sin_mayusculas_incluso_inactivo(self):
        self.almacen.activo = False
        self.almacen.save()
        respuesta = self.client.post('/api/v1/almacenes/', self.datos(nombre='  PRINCIPAL  '), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('nombre', respuesta.data['errors'])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Almacen.objects.create(nombre='PRINCIPAL', direccion='Otra dirección')

    def test_fechas_estado_y_campos_ajenos_no_editables(self):
        for campo, valor in [('creado_en', '2020-01-01'), ('actualizado_en', '2020-01-01'), ('activo', False), ('stock', 100), ('telefono', '123')]:
            respuesta = self.client.post('/api/v1/almacenes/', self.datos(**{campo: valor}), format='json')
            self.assertEqual(respuesta.status_code, 400)
            self.assertIn(campo, respuesta.data['errors'])
        fecha = self.almacen.creado_en
        self.assertEqual(self.editar({'direccion': 'Nueva dirección'}).status_code, 200)
        self.almacen.refresh_from_db()
        self.assertEqual(self.almacen.creado_en, fecha)

    def test_version_evitan_sobrescritura_y_es_obligatoria(self):
        version = version_almacen(self.almacen)
        self.assertEqual(self.client.patch(self.ruta(), {'direccion': 'Otra dirección'}, format='json').status_code, 400)
        respuesta = self.client.patch(self.ruta(), {'direccion': 'Otra dirección', 'version': version}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(self.client.patch(self.ruta(), {'direccion': 'Cambio antiguo', 'version': version}, format='json').status_code, 409)
        self.almacen.refresh_from_db()
        self.assertEqual(self.almacen.direccion, 'Otra dirección')

    def test_estado_con_confirmacion_conserva_datos_y_fecha(self):
        fecha, version = self.almacen.creado_en, version_almacen(self.almacen)
        respuesta = self.client.post(self.ruta('estado/'), {'activo': False, 'version': version}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['activo'])
        self.assertEqual(respuesta.data['latitud'], '-16.5000000')
        self.almacen.refresh_from_db()
        self.assertEqual(self.almacen.creado_en, fecha)
        self.assertTrue(RegistroActividad.objects.filter(modulo='almacenes', accion='desactivar', objeto_id=str(self.almacen.pk)).exists())
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': True, 'version': version}, format='json').status_code, 409)
        respuesta = self.client.post(self.ruta('estado/'), {'activo': True, 'version': version_almacen(self.almacen)}, format='json')
        self.assertTrue(respuesta.data['activo'])
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': False, 'version': respuesta.data['version'], 'latitud': '0'}, format='json').status_code, 400)

    def test_servicio_fuera_http_valida_permisos_datos_y_auditoria(self):
        with self.assertRaises(PermissionDenied):
            guardar_almacen(self.lector, self.datos())
        with self.assertRaises(PermissionDenied):
            cambiar_estado_almacen(self.lector, self.almacen, {'activo': False, 'version': version_almacen(self.almacen)})
        with self.assertRaises(ValidationError):
            guardar_almacen(self.admin, self.datos(latitud='20'))
        with self.assertRaises(ConflictoAlmacen):
            guardar_almacen(self.admin, {'direccion': 'No guardar', 'version': '0' * 64}, self.almacen)
        with patch('almacenes.servicios.registrar_actividad', side_effect=RuntimeError('Sin evidencia')):
            with self.assertRaises(RuntimeError):
                guardar_almacen(self.admin, self.datos())
            with self.assertRaises(RuntimeError):
                guardar_almacen(self.admin, {'direccion': 'No guardar', 'version': version_almacen(self.almacen)}, self.almacen)
            with self.assertRaises(RuntimeError):
                cambiar_estado_almacen(self.admin, self.almacen, {'activo': False, 'version': version_almacen(self.almacen)})
        self.assertEqual(Almacen.objects.count(), 1)
        self.almacen.refresh_from_db()
        self.assertEqual(self.almacen.direccion, 'Calle Los Ficus 10')
        self.assertTrue(self.almacen.activo)

    def test_lectores_no_escriben_y_acceso_exige_permisos(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/almacenes/').status_code, 200)
        self.assertEqual(self.client.get(self.ruta()).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/almacenes/', self.datos(), format='json').status_code, 403)
        self.assertEqual(self.client.patch(self.ruta(), {'nombre': 'Otro'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': False}, format='json').status_code, 403)
        permisos = self.client.get('/api/v1/auth/me/').data['permisos_almacenes']
        self.assertEqual(permisos, {'ver': True, 'crear': False, 'editar': False, 'cambiar_estado': False})
        self.client.force_authenticate(self.sin_acceso)
        self.assertEqual(self.client.get('/api/v1/almacenes/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/v1/almacenes/').status_code, (401, 403))

    def test_paginacion_diez_filtros_y_contadores(self):
        Almacen.objects.bulk_create([Almacen(nombre=f'Almacén {indice:02}', direccion='Zona nueva', activo=indice % 2 == 0) for indice in range(14)])
        respuesta = self.client.get('/api/v1/almacenes/?page_size=100&tamano=100')
        self.assertEqual(respuesta.data['count'], 15)
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/almacenes/?pagina=2').data['results']), 5)
        self.assertEqual(self.client.get('/api/v1/almacenes/?buscar=Ficus').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/almacenes/?buscar=Principal').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/almacenes/?activo=false').data['count'], 7)
        self.assertEqual(self.client.get('/api/v1/almacenes/resumen/?activo=false').data, {'total': 15, 'activos': 8, 'inactivos': 7})
        self.assertEqual(self.client.get('/api/v1/almacenes/?activo=incorrecto').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/almacenes/?orden=-nombre').data['results'][0]['nombre'], 'Principal')

    def test_no_cambios_no_reescribe_ni_duplica_evidencia(self):
        actualizado = self.almacen.actualizado_en
        guardar_almacen(self.admin, {'direccion': self.almacen.direccion, 'version': version_almacen(self.almacen)}, self.almacen)
        self.almacen.refresh_from_db()
        self.assertEqual(self.almacen.actualizado_en, actualizado)
        self.assertFalse(RegistroActividad.objects.filter(modulo='almacenes', accion='editar').exists())

    def test_rol_nuevo_no_amplia_roles_existentes(self):
        rol = Group.objects.create(name='Administrador de almacenes')
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(rol.permissions.count(), 0)
        rol.delete()
        call_command('preparar_roles', verbosity=0)
        permisos = Group.objects.get(name='Administrador de almacenes').permissions
        self.assertEqual(set(permisos.values_list('codename', flat=True)), {'view_almacen', 'add_almacen', 'change_almacen', 'cambiar_estado_almacen'})

    def test_no_borrado_ni_put(self):
        self.assertEqual(self.client.delete(self.ruta()).status_code, 405)
        self.assertEqual(self.client.put(self.ruta(), self.datos(), format='json').status_code, 405)
