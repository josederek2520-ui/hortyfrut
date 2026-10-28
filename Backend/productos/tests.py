from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from django.contrib.auth.models import Permission, Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, override_settings
from PIL import Image as Imagen
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from catalogos.models import CategoriaProducto, UnidadMedida
from usuarios.models import Usuario
from .models import Producto
from .servicios import guardar_producto, version_producto


class ProductosTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(email='admin@productos.test', cedula_identidad='620001', password='ProductosSeguros_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@productos.test', cedula_identidad='620002')
        cls.editor = Usuario.objects.create_user(email='editor@productos.test', cedula_identidad='620003')
        cls.sin_permisos = Usuario.objects.create_user(email='sinpermisos@productos.test', cedula_identidad='620004')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='productos', codename='view_producto'))
        cls.editor.user_permissions.set(Permission.objects.filter(content_type__app_label='productos', codename__in=['view_producto', 'change_producto']))
        cls.categoria = CategoriaProducto.objects.create(nombre='Verduras')
        cls.unidad = UnidadMedida.objects.create(nombre='Kilogramo', abreviatura='kg')
        cls.producto = Producto.objects.create(nombre='Tomate', categoria=cls.categoria, unidad_medida=cls.unidad)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.administrador)
        self.directorio = TemporaryDirectory()
        self.configuracion = override_settings(MEDIA_ROOT=self.directorio.name)
        self.configuracion.enable()
        self.addCleanup(self.directorio.cleanup)
        self.addCleanup(self.configuracion.disable)

    def datos(self, **adicionales):
        return {'nombre': 'Papa', 'categoria': self.categoria.pk, 'unidad_medida': self.unidad.pk, **adicionales}

    def ruta(self, sufijo=''):
        return f'/api/v1/productos/{self.producto.pk}/{sufijo}'

    def foto(self, formato='PNG', tamano=(80, 40), nombre='imagen.png'):
        salida = BytesIO()
        imagen = Imagen.new('RGB', tamano, color='green')
        imagen.save(salida, format=formato)
        return SimpleUploadedFile(nombre, salida.getvalue(), content_type=f'image/{formato.lower()}')

    def test_creacion_normaliza_y_registra_relaciones_y_auditoria(self):
        respuesta = self.client.post('/api/v1/productos/', self.datos(nombre='  Papa   blanca  '), format='json')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data['nombre'], 'Papa blanca')
        self.assertEqual(respuesta.data['categoria']['id'], self.categoria.pk)
        self.assertEqual(respuesta.data['unidad_medida']['abreviatura'], 'kg')
        self.assertTrue(respuesta.data['activo'])
        self.assertIsNone(respuesta.data['imagen'])
        self.assertNotIn('actualizado_en', respuesta.data)
        evento = RegistroActividad.objects.get(modulo='productos', accion='crear', resultado='exito')
        self.assertEqual(evento.cambios['categoria']['despues']['nombre'], 'Verduras')

    def test_duplicados_normalizados_y_constraint_en_postgres(self):
        respuesta = self.client.post('/api/v1/productos/', self.datos(nombre='TOMATE'), format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('nombre', respuesta.data['errors'])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Producto.objects.create(nombre='TOMATE', categoria=self.categoria, unidad_medida=self.unidad)

    def test_escritura_directa_traduce_colision_a_error_de_campo(self):
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError) as contexto:
            guardar_producto(self.administrador, self.datos(nombre='TOMATE'))
        self.assertIn('nombre', contexto.exception.detail)

    def test_servicio_fuera_de_http_normaliza_antes_de_auditar(self):
        producto = guardar_producto(self.administrador, self.datos(nombre='  Papa   blanca  '))
        evento = RegistroActividad.objects.get(modulo='productos', objeto_id=str(producto.pk), accion='crear')
        self.assertEqual(producto.nombre, 'Papa blanca')
        self.assertEqual(evento.cambios['nombre']['despues'], 'Papa blanca')

    def test_campos_invalidos_y_campos_no_editables(self):
        for adicionales, campo in [({'nombre': '  '}, 'nombre'), ({'nombre': 'x'*101}, 'nombre'),
                                   ({'categoria': 0}, 'categoria'), ({'unidad_medida': None}, 'unidad_medida'),
                                   ({'activo': False}, 'activo'), ({'creado_en': 'x'}, 'creado_en'),
                                   ({'actualizado_en': 'x'}, 'actualizado_en'), ({'stock': 10}, 'stock')]:
            with self.subTest(campo=campo):
                respuesta = self.client.post('/api/v1/productos/', self.datos(**adicionales), format='json')
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn(campo, respuesta.data['errors'])

    def test_relaciones_obligatorias_activas_y_existentes(self):
        self.categoria.activo = False
        self.categoria.save()
        self.assertEqual(self.client.post('/api/v1/productos/', self.datos(), format='json').status_code, 400)
        self.categoria.activo = True
        self.categoria.save()
        self.assertEqual(self.client.post('/api/v1/productos/', self.datos(unidad_medida=999999), format='json').status_code, 400)
        otra = UnidadMedida.objects.create(nombre='Unidad inactiva', abreviatura='ui', activo=False)
        self.assertEqual(self.client.patch(self.ruta(), {'unidad_medida': otra.pk, 'version': version_producto(self.producto)}, format='json').status_code, 400)

    def test_editar_conserva_relacion_inactiva_actual(self):
        self.categoria.activo = False
        self.categoria.save()
        respuesta = self.client.patch(self.ruta(), {'nombre': 'Tomate perita', 'version': version_producto(self.producto)}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertFalse(respuesta.data['categoria']['activo'])

    def test_conflictos_evitan_sobrescritura_y_estado_antiguo(self):
        version = version_producto(self.producto)
        self.assertEqual(self.client.patch(self.ruta(), {'nombre': 'Cambio'}, format='json').status_code, 400)
        respuesta = self.client.patch(self.ruta(), {'nombre': 'Tomate editado', 'version': version}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertNotEqual(respuesta.data['version'], version)
        self.assertEqual(self.client.patch(self.ruta(), {'nombre': 'Perdido', 'version': version}, format='json').status_code, 409)
        self.assertEqual(self.client.post(self.ruta('estado/'), {'activo': False, 'version': version}, format='json').status_code, 409)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, 'Tomate editado')

    def test_cambio_de_etiqueta_de_categoria_no_invalida_version_producto(self):
        version = version_producto(self.producto)
        self.categoria.nombre = 'Hortalizas'
        self.categoria.save()
        respuesta = self.client.patch(self.ruta(), {'nombre': 'Tomate nuevo', 'version': version}, format='json')
        self.assertEqual(respuesta.status_code, 200)

    def test_estado_y_relaciones_protegidas(self):
        for modelo in (self.categoria, self.unidad):
            with self.assertRaises(ProtectedError):
                modelo.delete()
        respuesta = self.client.post(self.ruta('estado/'), {'activo': False, 'version': version_producto(self.producto)}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.categoria.activo = False
        self.categoria.save()
        self.producto.refresh_from_db()
        respuesta = self.client.post(self.ruta('estado/'), {'activo': True, 'version': version_producto(self.producto)}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('categoria', respuesta.data['errors'])
        self.assertTrue(Producto.objects.filter(pk=self.producto.pk).exists())

    def test_permisos_y_ausencia_de_borrado(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 401)
        self.client.force_authenticate(self.sin_permisos)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 403)
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/productos/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/productos/', self.datos(), format='json').status_code, 403)
        self.assertEqual(self.client.patch(self.ruta(), {'version': version_producto(self.producto)}, format='json').status_code, 403)
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.patch(self.ruta(), {'nombre': 'Cambio autorizado', 'version': version_producto(self.producto)}, format='json').status_code, 200)
        self.assertEqual(self.client.post(self.ruta('estado/'), {}, format='json').status_code, 403)
        self.client.force_authenticate(self.administrador)
        self.assertEqual(self.client.delete(self.ruta()).status_code, 405)
        self.assertEqual(self.client.put(self.ruta(), {}, format='json').status_code, 405)
        self.assertFalse(Permission.objects.filter(content_type__app_label='productos', codename='delete_producto').exists())

    def test_opciones_limitadas_sin_exigir_permisos_de_otros_catalogos(self):
        self.client.force_authenticate(self.editor)
        CategoriaProducto.objects.bulk_create([CategoriaProducto(nombre=f'Grupo {indice:02}') for indice in range(12)])
        CategoriaProducto.objects.create(nombre='Inactiva', activo=False)
        respuesta = self.client.get('/api/v1/productos/opciones/?tipo=categorias_productos')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 13)
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/productos/opciones/?tipo=categorias_productos&pagina=2').data['results']), 3)
        self.assertEqual(self.client.get('/api/v1/productos/opciones/?tipo=unidades_medida&buscar=kg').data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/categorias-productos/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/productos/opciones/?tipo=otro').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/productos/opciones/?tipo=categorias_productos&incluir_inactivos=true').data['count'], 14)

    def test_listado_busqueda_filtros_resumen_y_paginas_de_diez(self):
        Producto.objects.bulk_create([Producto(nombre=f'Producto {indice:02}', categoria=self.categoria, unidad_medida=self.unidad, activo=indice%2 == 0) for indice in range(12)])
        primera = self.client.get('/api/v1/productos/?page_size=100&tamano=100').data
        self.assertEqual(primera['count'], 13)
        self.assertEqual(len(primera['results']), 10)
        self.assertEqual(len(self.client.get('/api/v1/productos/?pagina=2').data['results']), 3)
        self.assertEqual(self.client.get('/api/v1/productos/?buscar=Verduras').data['count'], 13)
        self.assertEqual(self.client.get('/api/v1/productos/?activo=false').data['count'], 6)
        self.assertEqual(self.client.get('/api/v1/productos/?categoria=99999').data['count'], 0)
        self.assertEqual(self.client.get(f'/api/v1/productos/?unidad_medida={self.unidad.pk}').data['count'], 13)
        self.assertEqual(self.client.get('/api/v1/productos/resumen/?activo=false').data, {'total': 13, 'activos': 7, 'inactivos': 6})
        self.assertEqual(self.client.get('/api/v1/productos/?orden=imagen').status_code, 400)

    def test_paginacion_fija_tambien_en_modulos_existentes(self):
        CategoriaProducto.objects.bulk_create([CategoriaProducto(nombre=f'Categoria {indice:02}') for indice in range(12)])
        Group.objects.bulk_create([Group(name=f'Rol {indice:02}') for indice in range(12)])
        Usuario.objects.bulk_create([Usuario(email=f'cuenta{indice}@diez.test', cedula_identidad=str(630000+indice)) for indice in range(12)])
        for ruta in ('usuarios', 'roles', 'categorias-productos', 'actividad'):
            for indice in range(12):
                RegistroActividad.objects.create(modulo='paginacion', accion='crear')
            respuesta = self.client.get(f'/api/v1/{ruta}/?page_size=100&tamano=100')
            self.assertEqual(len(respuesta.data['results']), 10, ruta)

    def test_auditoria_atomica_y_una_sola_evidencia_por_cambio(self):
        respuesta = self.client.patch(self.ruta(), {'nombre': 'Tomate rojo', 'version': version_producto(self.producto)}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        evento = RegistroActividad.objects.get(modulo='productos', accion='editar', resultado='exito')
        self.assertEqual(evento.cambios['nombre'], {'antes': 'Tomate', 'despues': 'Tomate rojo'})
        with patch('productos.servicios.registrar_actividad', side_effect=RuntimeError('Sin evidencia')):
            with self.assertRaises(RuntimeError):
                guardar_producto(self.administrador, self.datos(nombre='No persistir'))
        self.assertFalse(Producto.objects.filter(nombre='No persistir').exists())

    def test_sesion_y_catalogo_de_roles_exponen_permisos_independientes(self):
        self.client.force_authenticate(self.editor)
        sesion = self.client.get('/api/v1/auth/me/').data
        self.assertEqual(sesion['permisos_productos'], {'ver': True, 'crear': False, 'editar': True, 'cambiar_estado': False})
        self.assertFalse(sesion['permisos_catalogos']['categorias_productos']['ver'])
        self.client.force_authenticate(self.administrador)
        modulo = next(modulo for modulo in self.client.get('/api/v1/permisos/').data if modulo['key'] == 'productos')
        self.assertEqual(len(modulo['permissions']), 4)

    def test_subida_real_se_reencodea_y_se_sirve_con_permiso(self):
        respuesta = self.client.post('/api/v1/productos/', self.datos(imagen=self.foto(tamano=(2000, 1000))), format='multipart')
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        producto = Producto.objects.get(pk=respuesta.data['id'])
        with Imagen.open(producto.imagen.path) as imagen:
            self.assertEqual(imagen.format, 'WEBP')
            self.assertEqual(imagen.size, (1600, 800))
            self.assertFalse(imagen.getexif())
        self.assertTrue(producto.imagen.name.endswith('.webp'))
        ruta = respuesta.data['imagen']
        self.client.force_authenticate(self.lector)
        foto = self.client.get(ruta)
        self.assertEqual(foto.status_code, 200)
        self.assertEqual(foto['Content-Type'], 'image/webp')
        self.assertEqual(foto['Cache-Control'], 'private, no-store')
        self.assertTrue(b''.join(foto.streaming_content))
        self.client.force_authenticate(self.sin_permisos)
        self.assertEqual(self.client.get(ruta).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(ruta).status_code, 401)

    def test_imagenes_falsas_formatos_y_tamanos_invalidos(self):
        for archivo in [SimpleUploadedFile('foto.png', b'<html>archivo falso</html>', content_type='image/png'), self.foto(formato='GIF'), SimpleUploadedFile('grande.jpg', b'x'*(5*1024*1024+1), content_type='image/jpeg')]:
            respuesta = self.client.post('/api/v1/productos/', self.datos(imagen=archivo), format='multipart')
            self.assertEqual(respuesta.status_code, 400, respuesta.data)
            self.assertIn('imagen', respuesta.data['errors'])
        self.assertFalse(list(Path(self.directorio.name).rglob('*.webp')))

    def test_imagen_jpeg_se_orienta_y_elimina_metadatos(self):
        original = Imagen.new('RGB', (80, 40), color='green')
        metadatos = original.getexif()
        metadatos[274] = 6
        metadatos[270] = 'No conservar estos metadatos'
        salida = BytesIO()
        original.save(salida, format='JPEG', exif=metadatos)
        archivo = SimpleUploadedFile('foto.jpg', salida.getvalue(), content_type='image/jpeg')
        producto = guardar_producto(self.administrador, self.datos(imagen=archivo))
        with Imagen.open(producto.imagen.path) as imagen:
            self.assertEqual(imagen.size, (40, 80))
            self.assertFalse(imagen.getexif())
            self.assertNotIn('exif', imagen.info)

    def test_imagen_con_demasiados_pixeles_se_rechaza_antes_de_guardar(self):
        from rest_framework.exceptions import ValidationError
        with patch('productos.imagenes.PIXELES_MAXIMOS', 1000):
            with self.assertRaises(ValidationError):
                guardar_producto(self.administrador, self.datos(imagen=self.foto(tamano=(80, 40))))
        self.assertFalse(list(Path(self.directorio.name).rglob('*.webp')))

    def test_reemplazar_y_quitar_imagen_limpia_solo_despues_del_commit(self):
        producto = guardar_producto(self.administrador, self.datos(imagen=self.foto()))
        anterior = Path(producto.imagen.path)
        with self.captureOnCommitCallbacks(execute=True):
            producto = guardar_producto(self.administrador, {'imagen': self.foto(), 'version': version_producto(producto)}, producto)
            self.assertTrue(anterior.exists())
        self.assertFalse(anterior.exists())
        nueva = Path(producto.imagen.path)
        with self.captureOnCommitCallbacks(execute=True):
            producto = guardar_producto(self.administrador, {'quitar_imagen': True, 'version': version_producto(producto)}, producto)
        self.assertFalse(nueva.exists())
        self.assertFalse(producto.imagen)

    def test_imagen_no_queda_huerfana_si_falla_auditoria(self):
        with patch('productos.servicios.registrar_actividad', side_effect=RuntimeError('No disponible')):
            with self.assertRaises(RuntimeError):
                guardar_producto(self.administrador, self.datos(imagen=self.foto()))
        self.assertFalse(Producto.objects.filter(nombre='Papa').exists())
        self.assertFalse(list(Path(self.directorio.name).rglob('*.webp')))

    def test_una_peticion_no_puede_subir_y_quitar_a_la_vez(self):
        respuesta = self.client.post('/api/v1/productos/', self.datos(imagen=self.foto(), quitar_imagen=True), format='multipart')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('imagen', respuesta.data['errors'])

    def test_detalle_sin_imagen_devuelve_404_y_activos_por_defecto(self):
        self.assertEqual(self.client.get(self.ruta('imagen/')).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/productos/').data['count'], 1)
        self.assertNotIn('actualizado_en', self.client.get(self.ruta()).data)
