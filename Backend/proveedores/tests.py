from unittest.mock import patch
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from catalogos.models import CategoriaProducto
from usuarios.models import Usuario
from .models import Proveedor
from .servicios import guardar_proveedor, cambiar_estado_proveedor, version_proveedor, ConflictoProveedor


class PruebasProveedores(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(email='admin@proveedores.test', cedula_identidad='780001', password='ProveedoresSeguros_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@proveedores.test', cedula_identidad='780002')
        cls.creador = Usuario.objects.create_user(email='creador@proveedores.test', cedula_identidad='780003')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='proveedores', codename='view_proveedor'))
        cls.creador.user_permissions.set(Permission.objects.filter(content_type__app_label='proveedores', codename='add_proveedor'))
        cls.categoria = CategoriaProducto.objects.create(nombre='Frutas')
        cls.inactiva = CategoriaProducto.objects.create(nombre='Verduras', activo=False)
        cls.proveedor = Proveedor.objects.create(nombre='Proveedor central', categoria=cls.categoria, telefono='070123456', direccion='Calle Central 15')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.administrador)

    def ruta(self, sufijo=''):
        return f'/api/v1/proveedores/{self.proveedor.pk}/{sufijo}'

    def test_crear_normaliza_y_registra_fecha_y_auditoria(self):
        respuesta = self.client.post('/api/v1/proveedores/', {'nombre': '  Comercial   Sur  ', 'telefono': '070001234', 'direccion': '  Calle   Sur 20  ', 'categoria': self.categoria.pk}, format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['nombre'], 'Comercial Sur')
        self.assertEqual(respuesta.data['direccion'], 'Calle Sur 20')
        self.assertEqual(respuesta.data['telefono'], '070001234')
        self.assertEqual(respuesta.data['categoria']['id'], self.categoria.pk)
        self.assertTrue(respuesta.data['activo'])
        self.assertTrue(respuesta.data['creado_en'])
        self.assertNotIn('actualizado_en', respuesta.data)
        evento = RegistroActividad.objects.get(modulo='proveedores', accion='crear', objeto_id=str(respuesta.data['id']))
        self.assertEqual(evento.actor_id, self.administrador.pk)
        self.assertIn('categoria', evento.cambios)

    def test_solo_nombre_obligatorio_y_categoria_se_puede_quitar(self):
        respuesta = self.client.post('/api/v1/proveedores/', {'nombre': 'Productora local'}, format='json')
        self.assertEqual(respuesta.status_code, 201)
        self.assertIsNone(respuesta.data['categoria'])
        self.assertEqual(respuesta.data['telefono'], '')
        respuesta = self.client.patch(self.ruta(), {'categoria': None, 'version': version_proveedor(self.proveedor)}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNone(respuesta.data['categoria'])

    def test_datos_invalidos_y_campos_protegidos(self):
        casos = [({'nombre': ''}, 'nombre'), ({'nombre': '  '}, 'nombre'), ({'nombre': 'x' * 151}, 'nombre'),
                 ({'telefono': '+591 123'}, 'telefono'), ({'telefono': '١٢٣'}, 'telefono'), ({'telefono': '1' * 31}, 'telefono'),
                 ({'direccion': 'x' * 256}, 'direccion'), ({'categoria': -1}, 'categoria'),
                 ({'mercado': 'No permitido'}, 'mercado'), ({'creado_en': '2020-01-01'}, 'creado_en'),
                 ({'activo': False}, 'activo'), ({'actualizado_en': '2020-01-01'}, 'actualizado_en')]
        for datos, campo in casos:
            with self.subTest(campo=campo, datos=datos):
                respuesta = self.client.post('/api/v1/proveedores/', {'nombre': 'Proveedor nuevo', **datos}, format='json')
                self.assertEqual(respuesta.status_code, 400, respuesta.data)
                self.assertIn(campo, respuesta.data['errors'])

    def test_nombre_unico_sin_mayusculas_incluso_inactivo(self):
        self.proveedor.activo = False
        self.proveedor.save()
        respuesta = self.client.post('/api/v1/proveedores/', {'nombre': self.proveedor.nombre.upper()}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('nombre', respuesta.data['errors'])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Proveedor.objects.create(nombre=self.proveedor.nombre.upper())

    def test_categoria_activa_y_referencia_historica(self):
        for categoria in (self.inactiva.pk, 999999):
            respuesta = self.client.post('/api/v1/proveedores/', {'nombre': 'Proveedor nuevo', 'categoria': categoria}, format='json')
            self.assertEqual(respuesta.status_code, 400)
        self.categoria.activo = False
        self.categoria.save()
        respuesta = self.client.patch(self.ruta(), {'telefono': '00123', 'categoria': self.categoria.pk, 'version': version_proveedor(self.proveedor)}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertFalse(respuesta.data['categoria']['activo'])
        with self.assertRaises(ProtectedError):
            self.categoria.delete()

    def test_fecha_inmutable_y_version_evitan_sobrescritura(self):
        version = version_proveedor(self.proveedor)
        fecha = self.proveedor.creado_en
        self.assertEqual(self.client.patch(self.ruta(), {'telefono': '00111'}, format='json').status_code, 400)
        respuesta = self.client.patch(self.ruta(), {'telefono': '00111', 'version': version}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(self.client.patch(self.ruta(), {'telefono': '00222', 'version': version}, format='json').status_code, 409)
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.telefono, '00111')
        self.assertEqual(self.proveedor.creado_en, fecha)

    def test_estado_independiente_con_version_y_auditoria(self):
        version = version_proveedor(self.proveedor)
        respuesta = self.client.post(self.ruta('estado/'), {'activo': False, 'version': version}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['activo'])
        self.assertTrue(Proveedor.objects.filter(pk=self.proveedor.pk).exists())
        self.assertTrue(RegistroActividad.objects.filter(modulo='proveedores', accion='desactivar', objeto_id=str(self.proveedor.pk)).exists())
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': True, 'version': version}, format='json').status_code, 409)
        respuesta = self.client.post(self.ruta('estado/'), {'activo': True, 'version': respuesta.data['version']}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data['activo'])
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': False, 'version': respuesta.data['version'], 'nombre': 'Otro'}, format='json').status_code, 400)

    def test_servicios_validan_permisos_y_datos_sin_http(self):
        with self.assertRaises(PermissionDenied):
            guardar_proveedor(self.lector, {'nombre': 'No permitido'})
        with self.assertRaises(PermissionDenied):
            cambiar_estado_proveedor(self.lector, self.proveedor, {'activo': False, 'version': version_proveedor(self.proveedor)})
        with self.assertRaises(ValidationError):
            guardar_proveedor(self.administrador, {'nombre': 'Otro', 'telefono': '12A'})
        with self.assertRaises(ConflictoProveedor):
            guardar_proveedor(self.administrador, {'nombre': 'Otro', 'version': '0' * 64}, self.proveedor)

    def test_fallo_de_auditoria_revierte_creacion_edicion_y_estado(self):
        with patch('proveedores.servicios.registrar_actividad', side_effect=RuntimeError('Sin auditoría')):
            with self.assertRaises(RuntimeError):
                guardar_proveedor(self.administrador, {'nombre': 'No persistir'})
            with self.assertRaises(RuntimeError):
                guardar_proveedor(self.administrador, {'nombre': 'No persistir', 'version': version_proveedor(self.proveedor)}, self.proveedor)
            with self.assertRaises(RuntimeError):
                cambiar_estado_proveedor(self.administrador, self.proveedor, {'activo': False, 'version': version_proveedor(self.proveedor)})
        self.assertFalse(Proveedor.objects.filter(nombre='No persistir').exists())
        self.proveedor.refresh_from_db()
        self.assertTrue(self.proveedor.activo)
        self.assertEqual(self.proveedor.nombre, 'Proveedor central')

    def test_permisos_http_por_accion_y_sesion(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/proveedores/').status_code, 200)
        self.assertEqual(self.client.get(self.ruta()).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/proveedores/', {'nombre': 'Otro'}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(self.ruta(), {'nombre': 'Otro'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': False}, format='json').status_code, 403)
        permisos = self.client.get('/api/v1/auth/me/').data['permisos_proveedores']
        self.assertEqual(permisos, {'ver': True, 'crear': False, 'editar': False, 'cambiar_estado': False})
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/v1/proveedores/').status_code, (401, 403))

    def test_listados_filtros_y_contadores_con_paginas_fijas(self):
        Proveedor.objects.bulk_create([Proveedor(nombre=f'Proveedor {indice:02}', categoria=self.categoria, activo=indice % 2 == 0) for indice in range(14)])
        respuesta = self.client.get('/api/v1/proveedores/?tamano=100&page_size=100&limit=100')
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(respuesta.data['count'], 15)
        self.assertEqual(len(self.client.get('/api/v1/proveedores/?pagina=2').data['results']), 5)
        respuesta = self.client.get(f'/api/v1/proveedores/?buscar=central&categoria={self.categoria.pk}&activo=true')
        self.assertEqual(respuesta.data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/proveedores/?buscar=070123456').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/proveedores/?buscar=Calle').data['count'], 1)
        resumen = self.client.get(f'/api/v1/proveedores/resumen/?categoria={self.categoria.pk}&activo=false').data
        self.assertEqual(resumen, {'total': 15, 'activos': 8, 'inactivos': 7})
        self.assertEqual(self.client.get('/api/v1/proveedores/?activo=incorrecto').status_code, 400)

    def test_categorias_sin_permisos_de_catalogos_y_paginadas(self):
        CategoriaProducto.objects.bulk_create([CategoriaProducto(nombre=f'Categoría {indice:02}') for indice in range(12)])
        self.client.force_authenticate(self.creador)
        respuesta = self.client.get('/api/v1/proveedores/categorias/?page_size=100')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(respuesta.data['count'], 13)
        self.assertEqual(self.client.get('/api/v1/proveedores/categorias/?incluir_inactivos=true').data['count'], 14)
        self.assertEqual(self.client.get('/api/v1/categorias-productos/').status_code, 403)

    def test_no_hay_borrado_ni_edicion_total(self):
        self.assertEqual(self.client.delete(self.ruta()).status_code, 405)
        self.assertEqual(self.client.put(self.ruta(), {'nombre': 'Otro'}, format='json').status_code, 405)

    def test_rol_nuevo_no_amplia_roles_existentes(self):
        rol = Group.objects.create(name='Administrador de proveedores')
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(rol.permissions.count(), 0)
        rol.delete()
        call_command('preparar_roles', verbosity=0)
        rol = Group.objects.get(name='Administrador de proveedores')
        self.assertEqual(set(rol.permissions.values_list('codename', flat=True)), {'view_proveedor', 'add_proveedor', 'change_proveedor', 'cambiar_estado_proveedor'})
