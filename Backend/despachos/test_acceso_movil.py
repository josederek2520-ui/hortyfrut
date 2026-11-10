import json
import uuid
from datetime import timedelta
from unittest.mock import patch
from io import StringIO

from django.contrib.auth.models import Permission, Group
from django.core.management import call_command
from django.core.cache import cache
from django.http import Http404
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from auditoria.models import RegistroActividad
from cajillas.models import MovimientoCajilla
from inventario.models import MovimientoInventario
from usuarios.models import Usuario, SesionMovil
from usuarios.autenticacion_movil import crear_sesion_movil
from .models import Despacho, OperacionDespacho
from .servicios import guardar_despacho, ejecutar_accion, version_despacho, ConflictoDespacho
from .tests import DatosDespachos
from . import tests as pruebas_existentes


class PruebasAccesoMovil(DatosDespachos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos_despachos()
        cls.chofer = Usuario.objects.create_user(email='uno@chofer.test', cedula_identidad='98601', password='Chofer_pruebas_2026!')
        cls.otro = Usuario.objects.create_user(email='dos@chofer.test', cedula_identidad='98602', password='Chofer_pruebas_2026!')
        permisos = Permission.objects.filter(content_type__app_label='despachos', codename__in=['conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios'])
        cls.chofer.user_permissions.set(permisos)
        cls.otro.user_permissions.set(permisos)

    def movil(self, usuario=None, dispositivo=None):
        sesion, credencial = crear_sesion_movil(usuario or self.chofer, dispositivo or uuid.uuid4(), 'Teléfono de pruebas')
        cliente = APIClient()
        cliente.credentials(HTTP_AUTHORIZATION=f'Bearer {credencial}')
        return cliente, sesion, credencial

    def viaje_enviado(self, **cambios):
        despacho = self.crear_despacho(chofer=self.chofer.pk, **cambios)
        self.operar(despacho, 'enviar')
        despacho.refresh_from_db()
        return despacho

    def accion_movil(self, cliente, despacho, accion, **cambios):
        despacho.refresh_from_db()
        return cliente.post(f'/api/v1/movil/mis-despachos/{despacho.pk}/{accion}/', {
            'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4()), **cambios}, format='json', secure=True)

    def test_enviar_registra_evidencia_y_no_inicia_ni_mueve_existencias(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        productos, cajillas = MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}
        ejecutar_accion(self.actor, despacho, 'enviar', datos)
        ejecutar_accion(self.actor, despacho, 'enviar', datos)
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'borrador')
        self.assertIsNotNone(despacho.enviado_en)
        self.assertEqual(despacho.enviado_por_id, self.actor.pk)
        self.assertIsNone(despacho.salida_en)
        self.assertEqual((MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()), (productos, cajillas))
        self.assertEqual(OperacionDespacho.objects.filter(despacho=despacho, accion='enviar').count(), 1)
        self.assertTrue(RegistroActividad.objects.filter(modulo='despachos', accion='enviar', objeto_id=str(despacho.pk)).exists())
        evidencia = RegistroActividad.objects.get(modulo='despachos', accion='enviar', objeto_id=str(despacho.pk)).cambios['envio']
        self.assertEqual(evidencia['version_origen'], datos['version'])
        self.assertEqual(evidencia['version_resultante'], version_despacho(despacho))
        self.assertEqual(evidencia['peso_kg'], '50.000')
        with self.assertRaises(ValidationError):
            guardar_despacho(self.actor, self.datos_despacho(version=version_despacho(despacho)), despacho)

    def test_enviar_exige_permiso_separado_y_capacidad_actual(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        self.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='despachos', codename__in=['view_despacho', 'iniciar_despacho']))
        with self.assertRaises(PermissionDenied):
            ejecutar_accion(self.lector, despacho, 'enviar', {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())})
        for capacidad in (None, '49.999'):
            self.vehiculo.capacidad_kg = capacidad
            self.vehiculo.save(update_fields=['capacidad_kg'])
            with self.assertRaises(ValidationError):
                self.operar(despacho, 'enviar')
        despacho.refresh_from_db()
        self.assertIsNone(despacho.enviado_en)

    def test_http_envia_y_rechaza_modificar_metadatos_de_envio(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        respuesta = self.client.post(f'/api/v1/despachos/{despacho.pk}/enviar/', {
            'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}, format='json')
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertIsNotNone(respuesta.data['enviado_en'])
        self.assertEqual(respuesta.data['estado'], 'borrador')
        respuesta = self.client.patch(f'/api/v1/despachos/{despacho.pk}/', {
            **self.datos_despacho(version=respuesta.data['version']), 'enviado_en': None}, format='json')
        self.assertEqual(respuesta.status_code, 400)

    def test_dos_choferes_solo_ven_sus_viajes_enviados(self):
        primero = self.viaje_enviado(asignaciones=[self.asignaciones[0].pk], orden_sucursales=[self.centro.pk], cajillas=[])
        segundo = self.crear_despacho(chofer=self.otro.pk, asignaciones=[self.asignaciones[1].pk], orden_sucursales=[self.norte.pk], cajillas=[])
        self.operar(segundo, 'enviar')
        for usuario, propio, ajeno in ((self.chofer, primero, segundo), (self.otro, segundo, primero)):
            cliente, _, _ = self.movil(usuario)
            lista = cliente.get('/api/v1/movil/mis-despachos/', secure=True)
            self.assertEqual(lista.status_code, 200, lista.data)
            self.assertEqual(lista.data['count'], 1)
            self.assertEqual(lista.data['results'][0]['id'], propio.pk)
            self.assertTrue(RegistroActividad.objects.filter(actor_id=usuario.pk, accion='listar', ruta__contains='mis-despachos').exists())
            self.assertEqual(cliente.get(f'/api/v1/movil/mis-despachos/{ajeno.pk}/', secure=True).status_code, 404)
            self.assertEqual(self.accion_movil(cliente, ajeno, 'iniciar').status_code, 404)
            with self.assertRaises(Http404):
                ejecutar_accion(usuario, ajeno, 'iniciar', {'version': version_despacho(ajeno), 'clave_operacion': str(uuid.uuid4())}, como_chofer=True)

    def test_borradores_no_enviados_no_son_visibles_ni_operables(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        cliente, _, _ = self.movil()
        self.assertEqual(cliente.get('/api/v1/movil/mis-despachos/', secure=True).data['count'], 0)
        self.assertEqual(self.accion_movil(cliente, despacho, 'iniciar').status_code, 404)

    def test_chofer_completa_recorrido_propio_sin_permisos_administrativos(self):
        despacho = self.viaje_enviado()
        cliente, _, _ = self.movil()
        productos = MovimientoInventario.objects.count()
        self.assertEqual(self.accion_movil(cliente, despacho, 'iniciar').status_code, 200)
        for parada in despacho.paradas.all():
            self.assertEqual(self.accion_movil(cliente, despacho, 'descargar', parada=parada.pk).status_code, 400)
            self.assertEqual(self.accion_movil(cliente, despacho, 'llegar', parada=parada.pk).status_code, 200)
            self.assertEqual(self.accion_movil(cliente, despacho, 'descargar', parada=parada.pk).status_code, 200)
        self.assertEqual(self.accion_movil(cliente, despacho, 'finalizar').status_code, 200)
        despacho.refresh_from_db()
        self.assertEqual(despacho.estado, 'finalizado')
        self.assertEqual(MovimientoInventario.objects.count(), productos)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='entrega').count(), 2)
        self.assertFalse(self.chofer.has_perm('despachos.view_despacho'))

    def test_permiso_de_asignacion_no_basta_y_operar_se_valida_en_servicio(self):
        despacho = self.viaje_enviado()
        cliente, _, _ = self.movil()
        self.chofer.user_permissions.remove(Permission.objects.get(content_type__app_label='despachos', codename='operar_despachos_propios'))
        self.assertEqual(cliente.get('/api/v1/movil/mis-despachos/', secure=True).status_code, 200)
        self.assertEqual(self.accion_movil(cliente, despacho, 'iniciar').status_code, 403)
        self.chofer.user_permissions.clear()
        self.chofer.user_permissions.add(Permission.objects.get(content_type__app_label='despachos', codename='conducir_despacho'))
        self.assertEqual(cliente.get('/api/v1/movil/mis-despachos/', secure=True).status_code, 403)

    def test_acceso_movil_no_abre_el_panel_web_ni_usa_cookies_web(self):
        cliente, _, _ = self.movil(self.actor)
        self.assertEqual(cliente.get('/api/v1/despachos/', secure=True).status_code, 401)
        web = APIClient()
        web.force_login(self.actor)
        self.assertEqual(web.get('/api/v1/movil/mis-despachos/', secure=True).status_code, 401)
        self.assertEqual(APIClient().get('/api/v1/movil/mis-despachos/', secure=True).status_code, 401)

    def test_login_devuelve_credencial_solo_una_vez_y_no_la_guarda_en_claro(self):
        cache.clear()
        cliente = APIClient()
        respuesta = cliente.post('/api/v1/movil/iniciar-sesion/', {'email': self.chofer.email, 'password': 'Chofer_pruebas_2026!',
            'identificador_dispositivo': str(uuid.uuid4()), 'nombre_dispositivo': 'Android'}, format='json', secure=True)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta['Cache-Control'], 'no-store')
        self.assertNotIn('sessionid', respuesta.cookies)
        sesion = SesionMovil.objects.get(pk=respuesta.data['sesion_id'])
        self.assertNotEqual(respuesta.data['credencial'], sesion.resumen_credencial)
        self.assertEqual(len(sesion.resumen_credencial), 64)
        self.assertNotIn(respuesta.data['credencial'], json.dumps(list(RegistroActividad.objects.values('cambios')), default=str))

    def test_rotacion_revoca_solo_el_dispositivo_que_vuelve_a_ingresar(self):
        dispositivo = uuid.uuid4()
        anterior, sesion, _ = self.movil(dispositivo=dispositivo)
        otro, _, _ = self.movil()
        vigente, _, _ = self.movil(dispositivo=dispositivo)
        self.assertEqual(anterior.get('/api/v1/movil/sesion/', secure=True).status_code, 401)
        self.assertEqual(vigente.get('/api/v1/movil/sesion/', secure=True).status_code, 200)
        self.assertEqual(otro.get('/api/v1/movil/sesion/', secure=True).status_code, 200)
        sesion.refresh_from_db()
        self.assertIsNotNone(sesion.revocada_en)

    def test_expiracion_contrasena_y_baja_invalidan_el_acceso(self):
        cliente, sesion, _ = self.movil()
        SesionMovil.objects.filter(pk=sesion.pk).update(vence_en=timezone.now() - timedelta(seconds=1))
        self.assertEqual(cliente.get('/api/v1/movil/sesion/', secure=True).status_code, 401)
        cliente, _, _ = self.movil()
        self.chofer.set_password('Otra_clave_2026!')
        self.chofer.save(update_fields=['password'])
        self.assertEqual(cliente.get('/api/v1/movil/sesion/', secure=True).status_code, 401)
        cliente, _, _ = self.movil()
        Usuario.objects.filter(pk=self.chofer.pk).update(is_active=False)
        self.assertEqual(cliente.get('/api/v1/movil/sesion/', secure=True).status_code, 401)

    def test_revocacion_por_dispositivo_respeta_propietario_y_cierre_actual(self):
        cliente, sesion, _ = self.movil()
        otro, ajena, _ = self.movil(self.otro)
        lista = cliente.get('/api/v1/movil/dispositivos/', secure=True)
        self.assertEqual(lista.data['count'], 1)
        self.assertNotIn('resumen_credencial', lista.data['results'][0])
        self.assertEqual(cliente.delete(f'/api/v1/movil/dispositivos/{ajena.pk}/', secure=True).status_code, 404)
        self.assertEqual(cliente.delete(f'/api/v1/movil/dispositivos/{sesion.pk}/', secure=True).status_code, 204)
        self.assertEqual(cliente.get('/api/v1/movil/sesion/', secure=True).status_code, 401)
        self.assertEqual(otro.post('/api/v1/movil/sesion/', secure=True).status_code, 200)
        self.assertEqual(otro.get('/api/v1/movil/sesion/', secure=True).status_code, 401)

    def test_fallo_de_auditoria_revierte_envio_y_creacion_de_acceso(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        with patch('despachos.servicios.registrar_actividad', side_effect=RuntimeError('Auditoría no disponible')):
            with self.assertRaises(RuntimeError):
                self.operar(despacho, 'enviar')
        despacho.refresh_from_db()
        self.assertIsNone(despacho.enviado_en)
        self.assertFalse(OperacionDespacho.objects.filter(despacho=despacho).exists())
        with patch('usuarios.autenticacion_movil.registrar_actividad', side_effect=RuntimeError('Auditoría no disponible')):
            with self.assertRaises(RuntimeError):
                self.movil()
        self.assertEqual(SesionMovil.objects.count(), 0)

    def test_reintento_movil_no_duplica_salida_y_rechaza_otro_contenido(self):
        despacho = self.viaje_enviado()
        cliente, _, _ = self.movil()
        datos = {'version': version_despacho(despacho), 'clave_operacion': str(uuid.uuid4())}
        ruta = f'/api/v1/movil/mis-despachos/{despacho.pk}/iniciar/'
        for _ in range(2):
            self.assertEqual(cliente.post(ruta, datos, format='json', secure=True).status_code, 200)
        self.assertEqual(MovimientoCajilla.objects.filter(despacho=despacho, tipo='carga').count(), 1)
        self.assertEqual(cliente.post(ruta.replace('iniciar/', 'finalizar/'), datos, format='json', secure=True).status_code, 409)

    def test_viaje_anterior_en_ruta_permanece_accesible_para_su_chofer(self):
        despacho = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(despacho, 'iniciar')
        cliente, _, _ = self.movil()
        respuesta = cliente.get(f'/api/v1/movil/mis-despachos/{despacho.pk}/', secure=True)
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNone(respuesta.data['enviado_en'])

    def test_acceso_exige_https_y_rechaza_cabeceras_y_campos_no_validos(self):
        cliente, _, _ = self.movil()
        self.assertEqual(cliente.get('/api/v1/movil/sesion/').status_code, 403)
        for cabecera in ('Bearer no-valida', 'Bearer', 'Basic abc', 'Bearer ' + 'a' * 32 + '.' + 'b' * 43):
            cliente.credentials(HTTP_AUTHORIZATION=cabecera)
            self.assertEqual(cliente.get('/api/v1/movil/sesion/', secure=True).status_code, 401)
        cache.clear()
        datos = {'email': self.chofer.email, 'password': 'Chofer_pruebas_2026!', 'identificador_dispositivo': str(uuid.uuid4()),
                 'nombre_dispositivo': 'Android', 'usuario': self.otro.pk}
        self.assertEqual(APIClient().post('/api/v1/movil/iniciar-sesion/', datos, format='json', secure=True).status_code, 400)

    def test_listados_propios_y_dispositivos_tienen_paginas_de_diez(self):
        base = self.crear_despacho(chofer=self.chofer.pk)
        campos = ('almacen_id', 'almacen_nombre', 'vehiculo_id', 'vehiculo_placa', 'chofer_id', 'chofer_nombre', 'fecha_reparto', 'responsable_id', 'responsable_nombre')
        Despacho.objects.bulk_create([Despacho(**{campo: getattr(base, campo) for campo in campos}, enviado_en=timezone.now(),
                                             clave_operacion=uuid.uuid4(), huella_creacion='a' * 64) for _ in range(11)])
        cliente, _, _ = self.movil()
        for _ in range(10):
            self.movil()
        for ruta in ('mis-despachos', 'dispositivos'):
            primera = cliente.get(f'/api/v1/movil/{ruta}/', secure=True)
            segunda = cliente.get(f'/api/v1/movil/{ruta}/?page=2', secure=True)
            self.assertEqual(primera.data['count'], 11)
            self.assertEqual(len(primera.data['results']), 10)
            self.assertEqual(len(segunda.data['results']), 1)

    def test_limite_de_intentos_de_acceso(self):
        cache.clear()
        for _ in range(10):
            respuesta = APIClient().post('/api/v1/movil/iniciar-sesion/', {}, format='json', secure=True)
            self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(APIClient().post('/api/v1/movil/iniciar-sesion/', {}, format='json', secure=True).status_code, 429)
        cache.clear()

    def test_preparar_roles_agrega_solo_permisos_necesarios_y_es_idempotente(self):
        administrador, _ = Group.objects.get_or_create(name='Administrador de despachos')
        chofer, _ = Group.objects.get_or_create(name='Chofer de despachos')
        otro, _ = Group.objects.get_or_create(name='Rol personalizado')
        conducir = Permission.objects.get(content_type__app_label='despachos', codename='conducir_despacho')
        chofer.permissions.set([conducir])
        administrador.permissions.clear()
        anteriores = RegistroActividad.objects.count()
        for _ in range(2):
            call_command('preparar_acceso_movil', stdout=StringIO())
        self.assertEqual(set(administrador.permissions.values_list('codename', flat=True)), {'enviar_despacho'})
        self.assertEqual(set(chofer.permissions.values_list('codename', flat=True)), {'conducir_despacho', 'ver_despachos_propios', 'operar_despachos_propios'})
        self.assertEqual(otro.permissions.count(), 0)
        self.assertEqual(RegistroActividad.objects.count(), anteriores + 2)
        self.assertFalse(administrador.user_set.exists())


class PruebasConcurrenciaAccesoMovil(DatosDespachos, TransactionTestCase):
    ejecutar_paralelo = pruebas_existentes.PruebasConcurrenciaDespachos.ejecutar_paralelo

    def setUp(self):
        self.preparar_datos_despachos()
        super().setUp()

    def test_envio_y_edicion_compiten_por_la_misma_version(self):
        despacho = self.crear_despacho()
        version = version_despacho(despacho)
        resultados = self.ejecutar_paralelo(
            lambda: ejecutar_accion(self.actor, despacho, 'enviar', {'version': version, 'clave_operacion': str(uuid.uuid4())}),
            lambda: guardar_despacho(self.actor, self.datos_despacho(version=version, observaciones='Cambio simultáneo'), despacho))
        self.assertCountEqual(resultados, ['exito', 409])

    def test_dos_accesos_del_mismo_dispositivo_dejan_una_sola_credencial_vigente(self):
        dispositivo = uuid.uuid4()
        resultados = self.ejecutar_paralelo(
            lambda: crear_sesion_movil(self.actor, dispositivo, 'Android'),
            lambda: crear_sesion_movil(self.actor, dispositivo, 'Android'))
        self.assertEqual(resultados, ['exito', 'exito'])
        self.assertEqual(SesionMovil.objects.filter(revocada_en__isnull=True).count(), 1)
        self.assertEqual(SesionMovil.objects.count(), 2)
