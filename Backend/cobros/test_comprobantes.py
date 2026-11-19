import hashlib
import io
import json
from unittest.mock import patch
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from reportlab.pdfgen.canvas import Canvas
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from precios.consultas import huella
from usuarios.models import Usuario
from .models import Cobro, ComprobanteCobro, AplicacionCobro
from .servicios import revisar_cobro, registrar_cobro, validar_entrada, ConflictoCobro
from .tests import DatosCobros


def imagen(nombre='recibo.png', color='white', formato='PNG'):
    salida = io.BytesIO()
    Image.new('RGB', (12, 12), color).save(salida, format=formato)
    return SimpleUploadedFile(nombre, salida.getvalue(), content_type='application/octet-stream')


class PruebasComprobantesCobro(DatosCobros, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def revisar_archivo(self, datos, archivo):
        return {**datos, 'revision': revisar_cobro(self.actor, datos, archivo)['revision']}

    def test_transferencia_y_deposito_exigen_comprobante_y_efectivo_no_lo_admite(self):
        venta = self.venta()
        for medio in ['transferencia', 'deposito']:
            datos = self.datos([venta], ['10.00'], medio=medio, referencia='')
            with self.subTest(medio=medio), self.assertRaises(ValidationError):
                revisar_cobro(self.actor, datos)
        for medio in ['efectivo', 'otro', 'cheque']:
            with self.subTest(medio=medio), self.assertRaises(ValidationError):
                revisar_cobro(self.actor, self.datos([venta], ['10.00'], medio=medio), imagen())
        self.assertEqual(Cobro.objects.count(), 0)

    def test_revision_no_guarda_archivo_y_registro_es_atomico_idempotente_y_privado(self):
        venta = self.venta()
        datos = self.datos([venta], ['30.00'], medio='transferencia', referencia='')
        archivo = imagen()
        revision = revisar_cobro(self.actor, datos, archivo)
        self.assertEqual((Cobro.objects.count(), ComprobanteCobro.objects.count()), (0, 0))
        self.assertEqual(revision['comprobante']['tipo'], 'image/png')
        datos['revision'] = revision['revision']
        cobro = registrar_cobro(self.actor, datos, archivo)
        self.assertEqual(registrar_cobro(self.actor, datos, archivo).pk, cobro.pk)
        self.assertEqual((Cobro.objects.count(), ComprobanteCobro.objects.count(), AplicacionCobro.objects.count()), (1, 1, 1))
        guardado = ComprobanteCobro.objects.get(cobro=cobro)
        self.assertEqual(guardado.sha256, hashlib.sha256(bytes(guardado.contenido)).hexdigest())
        detalle = self.client.get(f'/api/v1/cobros/{cobro.pk}/').data
        self.assertEqual(detalle['comprobante']['nombre'], 'recibo.png')
        self.assertNotIn('contenido', detalle['comprobante'])
        evento = RegistroActividad.objects.filter(modulo='cobros', accion='registrar', codigo_http__isnull=True).get()
        self.assertEqual(evento.cambios['comprobante_sha256'], guardado.sha256)
        self.assertNotIn('contenido', json.dumps(evento.cambios))
        respuesta = self.client.get(f'/api/v1/cobros/{cobro.pk}/comprobante/')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(b''.join(respuesta.streaming_content), bytes(guardado.contenido))
        self.assertEqual(respuesta['Content-Type'], 'image/png')
        self.assertIn('attachment', respuesta['Content-Disposition'])
        self.assertEqual(respuesta['Cache-Control'], 'private, no-store')
        self.assertEqual(respuesta['X-Content-Type-Options'], 'nosniff')

    def test_archivo_cambiado_invalida_revision_y_uuid_registrado(self):
        venta = self.venta()
        datos = self.datos([venta], ['10.00'], medio='deposito')
        primero, segundo = imagen(), imagen(color='red')
        datos = self.revisar_archivo(datos, primero)
        with self.assertRaises(ConflictoCobro):
            registrar_cobro(self.actor, datos, segundo)
        self.assertEqual(Cobro.objects.count(), 0)
        cobro = registrar_cobro(self.actor, datos, primero)
        with self.assertRaises(ConflictoCobro):
            registrar_cobro(self.actor, datos, segundo)
        self.assertEqual(cobro.aplicaciones.get().saldo_posterior, 90)

    def test_fallo_de_auditoria_revierte_archivo_cobro_y_saldo(self):
        venta = self.venta()
        archivo = imagen()
        datos = self.revisar_archivo(self.datos([venta], ['20.00'], medio='transferencia'), archivo)
        with patch('cobros.servicios.registrar_actividad', side_effect=RuntimeError('Prueba')):
            with self.assertRaises(RuntimeError):
                registrar_cobro(self.actor, datos, archivo)
        self.assertEqual((Cobro.objects.count(), ComprobanteCobro.objects.count(), AplicacionCobro.objects.count()), (0, 0, 0))

    def test_rechaza_archivos_vacios_falsos_excesivos_y_duplicados(self):
        datos = self.datos([self.venta()], ['1.00'], medio='deposito')
        for archivo in [SimpleUploadedFile('vacio.pdf', b''),
                SimpleUploadedFile('falso.png', b'contenido sin imagen', 'image/png'),
                SimpleUploadedFile('falso.pdf', b'%PDF-1.7 sin final', 'application/pdf'),
                SimpleUploadedFile('grande.png', b'x' * (8 * 1024 * 1024 + 1))]:
            with self.subTest(nombre=archivo.name), self.assertRaises(ValidationError):
                revisar_cobro(self.actor, datos, archivo)
        respuesta = self.client.post('/api/v1/cobros/revisar/', {'datos': json.dumps(datos), 'comprobante': [imagen(), imagen()]}, format='multipart')
        self.assertEqual(respuesta.status_code, 400)

    def test_pdf_y_formatos_de_imagen_se_validan_por_contenido(self):
        datos = self.datos([self.venta()], ['1.00'], medio='transferencia')
        for formato, tipo in [('JPEG', 'image/jpeg'), ('PNG', 'image/png'), ('WEBP', 'image/webp')]:
            with self.subTest(formato=formato):
                self.assertEqual(revisar_cobro(self.actor, datos, imagen(formato=formato))['comprobante']['tipo'], tipo)
        salida = io.BytesIO()
        documento = Canvas(salida); documento.drawString(40, 800, 'Comprobante de prueba'); documento.save()
        archivo = SimpleUploadedFile('deposito.pdf', salida.getvalue(), 'image/jpeg')
        self.assertEqual(revisar_cobro(self.actor, datos, archivo)['comprobante']['tipo'], 'application/pdf')

    def test_multipart_admite_imagen_mayor_a_limite_de_json_sin_guardarla_al_revisar(self):
        datos = self.datos([self.venta()], ['1.00'], medio='transferencia', referencia='')
        original = imagen().read()
        archivo = SimpleUploadedFile('recibo-grande.png', original + b'\x00' * (3 * 1024 * 1024), 'image/png')
        respuesta = self.client.post('/api/v1/cobros/revisar/', {'datos': json.dumps(datos), 'comprobante': archivo}, format='multipart')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertGreater(respuesta.data['comprobante']['tamano'], 3 * 1024 * 1024)
        self.assertEqual(ComprobanteCobro.objects.count(), 0)

    def test_api_multipart_sesion_csrf_descarga_y_permiso_revocado(self):
        navegador = APIClient(enforce_csrf_checks=True)
        operador = Usuario.objects.create_user(email='comprobantes@pruebas.test', cedula_identidad='72888')
        operador.user_permissions.set(Permission.objects.filter(content_type__app_label='cobros'))
        navegador.force_login(operador)
        datos = self.datos([self.venta()], ['1.00'], medio='deposito', referencia='')
        self.assertEqual(navegador.post('/api/v1/cobros/revisar/', {'datos': json.dumps(datos), 'comprobante': imagen()}, format='multipart').status_code, 403)
        csrf = navegador.get('/api/v1/auth/csrf/').json()['csrfToken']
        revision = navegador.post('/api/v1/cobros/revisar/', {'datos': json.dumps(datos), 'comprobante': imagen()}, format='multipart', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(revision.status_code, 200, revision.data)
        datos['revision'] = revision.data['revision']
        respuesta = navegador.post('/api/v1/cobros/', {'datos': json.dumps(datos), 'comprobante': imagen()}, format='multipart', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        ruta = f"/api/v1/cobros/{respuesta.data['id']}/comprobante/"
        anonimo = APIClient()
        self.assertIn(anonimo.get(ruta).status_code, [401, 403])
        operador.user_permissions.clear()
        self.assertEqual(navegador.get(ruta).status_code, 403)
        self.assertEqual(navegador.post('/api/v1/cobros/', {'datos': json.dumps(datos), 'comprobante': imagen()}, format='multipart', HTTP_X_CSRFTOKEN=csrf).status_code, 403)

    def test_historial_y_reintentos_legados_conservan_referencia_y_cheque(self):
        datos = self.revisar(self.datos([self.venta()], ['10.00']))
        cobro = registrar_cobro(self.actor, datos)
        legado = {**datos, 'medio': 'cheque'}
        Cobro.objects.filter(pk=cobro.pk).update(medio='cheque', huella=huella(validar_entrada(legado)))
        self.assertEqual(registrar_cobro(self.actor, legado).pk, cobro.pk)
        detalle = self.client.get(f'/api/v1/cobros/{cobro.pk}/').data
        self.assertEqual((detalle['medio'], detalle['referencia'], detalle['comprobante']), ('cheque', 'REFERENCIA PRUEBA', None))
        with self.assertRaises(ValidationError):
            revisar_cobro(self.actor, self.datos([self.venta()], ['1.00'], medio='cheque'))
        with override_settings(ROOT_URLCONF='config.rutas_chofer_https'):
            self.assertEqual(self.client.get(f'/api/v1/cobros/{cobro.pk}/comprobante/').status_code, 404)
