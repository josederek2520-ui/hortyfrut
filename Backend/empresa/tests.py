import base64
import os
import uuid
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from auditoria.consultas import actividad_modulos
from usuarios.models import Usuario
from ventas.tests import DatosVentas
from ventas.servicios import actuar
from ventas.consultas import revisar_venta
from ventas.documentos import generar_resumen_pdf
from ventas.representaciones import lineas_emitidas, representar
from ventas.importe_letras import importe_en_letras
from .models import DatosEmpresa, OperacionEmpresa
from .servicios import guardar_empresa, version_empresa, estado_empresa, ConflictoEmpresa


class PruebasEmpresa(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.actor = Usuario.objects.create_superuser(email='empresa@prueba.test', cedula_identidad='73001')
        DatosEmpresa.objects.get_or_create(pk=1)

    def datos(self, **cambios):
        empresa = DatosEmpresa.objects.get(pk=1)
        return {**estado_empresa(empresa), 'razon_social':'HortyFru de pruebas', 'nit':'001234567',
            'direccion':'Calle de pruebas', 'telefono':'2222222', 'ciudad':'La Paz',
            'version':version_empresa(empresa), 'clave_operacion':str(uuid.uuid4()), **cambios}

    def test_version_uuid_cuerpo_no_cambia_y_no_cuenta_guardar_sin_cambios(self):
        datos = self.datos(); empresa = guardar_empresa(self.actor,datos)
        version = version_empresa(empresa)
        self.assertEqual(guardar_empresa(self.actor,datos).nit,'001234567')
        with self.assertRaises(ConflictoEmpresa):
            guardar_empresa(self.actor,{**datos,'telefono':'Otro'})
        with self.assertRaises(ConflictoEmpresa):
            guardar_empresa(self.actor,self.datos(version=datos['version']))
        guardar_empresa(self.actor,self.datos())
        empresa.refresh_from_db()
        self.assertEqual(version_empresa(empresa),version)
        self.assertEqual(actividad_modulos().filter(modulo='empresa').count(),1)

    def test_logo_se_valida_normaliza_y_no_expone_bytes_en_auditoria(self):
        salida = BytesIO(); Image.new('RGB',(100,50),'green').save(salida,format='JPEG')
        logo = 'data:image/jpeg;base64,' + base64.b64encode(salida.getvalue()).decode()
        empresa = guardar_empresa(self.actor,self.datos(logo_base64=logo))
        self.assertTrue(empresa.logo_base64.startswith('data:image/png;base64,'))
        registro = actividad_modulos().filter(modulo='empresa').get()
        self.assertNotIn('data:image',str(registro.cambios))
        for valor in ['data:image/svg+xml;base64,PHN2Zz4=', 'no es imagen', 'data:image/png;base64,YWJj']:
            with self.subTest(valor=valor),self.assertRaises(ValidationError):
                guardar_empresa(self.actor,self.datos(logo_base64=valor))

    def test_permisos_frescos_y_fallo_auditoria_revierte_datos(self):
        editor = Usuario.objects.create_user(email='editor@empresa.test', cedula_identidad='73002')
        editor.user_permissions.set(Permission.objects.filter(content_type__app_label='empresa'))
        datos = self.datos(); guardar_empresa(editor,datos)
        editor.user_permissions.clear()
        with self.assertRaises(PermissionDenied):
            guardar_empresa(editor,datos)
        empresa = DatosEmpresa.objects.get(pk=1); original = empresa.telefono
        with patch('empresa.servicios.registrar_actividad',side_effect=RuntimeError('Prueba')):
            with self.assertRaises(RuntimeError):
                guardar_empresa(self.actor,self.datos(telefono='7777777'))
        empresa.refresh_from_db(); self.assertEqual(empresa.telefono,original)

    def test_guardar_exige_csrf_y_no_asigna_permisos_a_usuarios(self):
        navegador = APIClient(enforce_csrf_checks=True); navegador.force_login(self.actor)
        self.assertEqual(navegador.get('/api/v1/datos-empresa/').status_code,200)
        self.assertEqual(navegador.post('/api/v1/datos-empresa/',self.datos(),format='json').status_code,403)
        csrf = navegador.get('/api/v1/auth/csrf/').json()['csrfToken']
        self.assertEqual(navegador.post('/api/v1/datos-empresa/',self.datos(),format='json',HTTP_X_CSRFTOKEN=csrf).status_code,200)
        self.assertEqual(Permission.objects.filter(content_type__app_label__in=['empresa','cobros'],user__is_superuser=False).count(),0)

    def test_logo_cercano_a_un_mega_se_admite_como_json_y_se_normaliza(self):
        salida = BytesIO()
        Image.frombytes('RGBA',(600,400),os.urandom(600 * 400 * 4)).save(salida,format='PNG')
        self.assertLess(len(salida.getvalue()),1024 * 1024)
        logo = 'data:image/png;base64,' + base64.b64encode(salida.getvalue()).decode()
        navegador = APIClient(); navegador.force_authenticate(self.actor)
        respuesta = navegador.post('/api/v1/datos-empresa/',self.datos(logo_base64=logo),format='json')
        self.assertEqual(respuesta.status_code,200,getattr(respuesta,'data',respuesta.content[:300]))
        normalizado = base64.b64decode(respuesta.data['logo_base64'].split(',',1)[1])
        with Image.open(BytesIO(normalizado)) as imagen:
            self.assertLessEqual(imagen.width,800)
            self.assertLessEqual(imagen.height,400)


class PruebasEmpresaVenta(DatosVentas,TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()

    def test_empresa_se_conserva_con_logo_y_cambios_exigen_nueva_revision(self):
        _, venta = self.preparar_venta()
        datos = self.accion_venta(venta)
        empresa = DatosEmpresa.objects.get(pk=1); empresa.direccion='Dirección actualizada'; empresa.save()
        from ventas.servicios import ConflictoVenta
        with self.assertRaises(ConflictoVenta):
            actuar(self.actor,venta.pk,'emitir',datos)
        emitida = actuar(self.actor,venta.pk,'emitir',self.accion_venta(venta))
        original = emitida.empresa.copy()
        empresa.razon_social='Otra razón social'; empresa.save()
        emitida.refresh_from_db()
        self.assertEqual(emitida.empresa,original)
        self.assertNotEqual(emitida.empresa['razon_social'],empresa.razon_social)
        for idioma in ['es','en']:
            documento = generar_resumen_pdf({**representar(emitida),'empresa':emitida.empresa},lineas_emitidas(emitida),idioma)
            self.assertTrue(documento.startswith(b'%PDF-'))

    def test_datos_incompletos_bloquean_emision_y_documentos_anteriores_se_leen(self):
        _, venta = self.preparar_venta()
        DatosEmpresa.objects.filter(pk=1).update(nit='')
        self.assertIn('empresa_incompleta',revisar_venta(venta)['incidencias'])
        with self.assertRaises(ValidationError):
            actuar(self.actor,venta.pk,'emitir',self.accion_venta(venta))
        DatosEmpresa.objects.filter(pk=1).update(nit='123456')
        emitida = actuar(self.actor,venta.pk,'emitir',self.accion_venta(venta))
        self.assertTrue(generar_resumen_pdf({**representar(emitida),'empresa':{}},lineas_emitidas(emitida)).startswith(b'%PDF-'))

    def test_total_en_letras_es_exacto_incluidos_limites_y_centavos(self):
        for importe,texto in [('309.51','Trescientos nueve 51/100'),('21.01','Veintiún 01/100'),('1000000.00','Un millón 00/100'),('100.00','Cien 00/100'),('0.01','Cero 01/100')]:
            self.assertTrue(importe_en_letras(importe).startswith(texto))
        self.assertIn('99/100',importe_en_letras('9999999999999999.99'))
