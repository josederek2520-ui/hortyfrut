from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image as Imagen
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from usuarios.models import Usuario
from auditoria.models import RegistroActividad
from .models import Vehiculo
from .servicios import guardar_vehiculo, cambiar_estado_vehiculo, version_vehiculo, ConflictoVehiculo


class PruebasVehiculos(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.actor = Usuario.objects.create_superuser(email='vehiculos@hortyfru.test', cedula_identidad='98001', password='Pruebas_2026!')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def test_placa_normalizada_y_unica_incluso_inactiva(self):
        vehiculo = guardar_vehiculo(self.actor, {'placa': ' 1234-abc ', 'tipo': 'Camión'})
        self.assertEqual(vehiculo.placa, '1234-ABC')
        cambiar_estado_vehiculo(self.actor, vehiculo, {'activo': False, 'version': version_vehiculo(vehiculo)})
        with self.assertRaises(ValidationError):
            guardar_vehiculo(self.actor, {'placa': '1234-ABC', 'tipo': 'Camioneta'})

    def test_edicion_version_y_auditoria_atomica(self):
        vehiculo = guardar_vehiculo(self.actor, {'placa': '1234-ABC', 'tipo': 'Camión'})
        version = version_vehiculo(vehiculo)
        guardar_vehiculo(self.actor, {'marca': 'Nueva', 'version': version}, vehiculo)
        with self.assertRaises(ConflictoVehiculo):
            guardar_vehiculo(self.actor, {'marca': 'Otra', 'version': version}, vehiculo)
        vehiculo.refresh_from_db()
        with patch('vehiculos.servicios.registrar_actividad', side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                guardar_vehiculo(self.actor, {'marca': 'Revertida', 'version': version_vehiculo(vehiculo)}, vehiculo)
        vehiculo.refresh_from_db()
        self.assertEqual(vehiculo.marca, 'Nueva')
        self.assertTrue(RegistroActividad.objects.filter(modulo='vehiculos').exists())

    def test_api_paginada_permisos_y_campos_protegidos(self):
        for numero in range(12):
            guardar_vehiculo(self.actor, {'placa': str(numero), 'tipo': 'Furgón'})
        respuesta = self.client.get('/api/v1/vehiculos/', {'page_size': 100})
        self.assertEqual(respuesta.data['count'], 12)
        self.assertEqual(len(respuesta.data['results']), 10)
        self.assertEqual(self.client.post('/api/v1/vehiculos/', {'placa': 'OTRO', 'tipo': 'Furgón', 'activo': False}).status_code, 400)
        self.assertEqual(self.client.post('/api/v1/vehiculos/', {'placa': 'OTRO', 'tipo': 'Furgón', 'capacidad_kg': '-1'}).status_code, 400)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/v1/vehiculos/').status_code, (401, 403))

    def test_foto_se_valida_se_recodifica_y_solo_es_accesible_con_permiso(self):
        with TemporaryDirectory() as carpeta, override_settings(MEDIA_ROOT=carpeta):
            salida = BytesIO()
            Imagen.new('RGB', (10, 10), 'green').save(salida, format='PNG')
            archivo = SimpleUploadedFile('vehiculo.png', salida.getvalue(), content_type='image/png')
            vehiculo = guardar_vehiculo(self.actor, {'placa': '1234', 'tipo': 'Camión', 'imagen': archivo})
            self.assertTrue(vehiculo.imagen.name.endswith('.webp'))
            respuesta = self.client.get(f'/api/v1/vehiculos/{vehiculo.pk}/imagen/')
            self.assertEqual(respuesta.status_code, 200)
            self.assertTrue(b''.join(respuesta.streaming_content))
            self.client.force_authenticate(None)
            self.assertIn(self.client.get(f'/api/v1/vehiculos/{vehiculo.pk}/imagen/').status_code, (401, 403))
            with self.assertRaises(ValidationError):
                guardar_vehiculo(self.actor, {'placa': 'OTRO', 'tipo': 'Camión', 'imagen': SimpleUploadedFile('falso.png', b'no es imagen')})
            self.assertEqual(Vehiculo.objects.count(), 1)
