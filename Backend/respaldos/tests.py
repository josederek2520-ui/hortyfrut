import hashlib
import json
import tempfile
import uuid
import zipfile
from datetime import datetime, timedelta, timezone as zona_horaria
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import Permission
from django.db import DatabaseError, connection, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import Resolver404, resolve
from django.utils import timezone
from rest_framework.test import APIClient
from auditoria.models import RegistroActividad
from usuarios.models import Usuario
from vehiculos.models import Vehiculo
from despachos.test_descarga_pedidos import DatosDescargaPedidos
from .archivos import ErrorRespaldo, archivo_permitido, directorio_respaldos, ruta_respaldo
from .ejecucion import ejecutar_respaldo, instantanea_estable
from .models import Respaldo
from .servicios import ConflictoRespaldo, nombre_respaldo, solicitar_respaldo


def crear_actor(numero=1, codigos=('view_respaldo', 'add_respaldo', 'descargar_respaldo')):
    actor = Usuario.objects.create_user(email=f'respaldos{numero}@pruebas.test', cedula_identidad=str(998700 + numero))
    actor.user_permissions.set(Permission.objects.filter(content_type__app_label='respaldos', codename__in=codigos))
    return actor


class PruebasRespaldos(TestCase):
    def setUp(self):
        self.actor = crear_actor()
        self.cliente = APIClient()
        self.cliente.force_authenticate(self.actor)

    def crear(self):
        with patch('respaldos.servicios.iniciar_proceso'):
            with self.captureOnCommitCallbacks(execute=True):
                return solicitar_respaldo(self.actor, {'solicitud_uuid': str(uuid.uuid4())})

    def test_nombre_dia_mes_ano_boliviano_y_consecutivo(self):
        instante = datetime(2026, 11, 9, 1, 30, 45, tzinfo=zona_horaria.utc)
        self.assertEqual(nombre_respaldo(instante, 1), 'hortyfru_08-11-2026_001.zip')
        self.assertEqual(nombre_respaldo(instante, 2), 'hortyfru_08-11-2026_002.zip')
        self.assertEqual(nombre_respaldo(instante, 1000), 'hortyfru_08-11-2026_1000.zip')

    def test_consecutivo_persistido_no_reutiliza_fallidos_y_reinicia_por_dia(self):
        primero_dia = datetime(2026, 11, 9, 1, 30, tzinfo=zona_horaria.utc)
        siguiente_dia = datetime(2026, 11, 9, 4, 1, tzinfo=zona_horaria.utc)
        with patch('respaldos.servicios.timezone.now', return_value=primero_dia):
            primero = self.crear()
            Respaldo.objects.filter(pk=primero.pk).update(estado='fallido')
            segundo = self.crear()
            Respaldo.objects.filter(pk=segundo.pk).update(estado='fallido')
        with patch('respaldos.servicios.timezone.now', return_value=siguiente_dia):
            tercero = self.crear()
        self.assertEqual([primero.nombre, segundo.nombre, tercero.nombre], [
            'hortyfru_08-11-2026_001.zip', 'hortyfru_08-11-2026_002.zip', 'hortyfru_09-11-2026_001.zip'])

    def test_permiso_de_consulta_no_permite_crear_ni_descargar(self):
        lector = crear_actor(2, ['view_respaldo'])
        self.cliente.force_authenticate(lector)
        self.assertEqual(self.cliente.get('/api/v1/respaldos/').status_code, 200)
        self.assertEqual(self.cliente.post('/api/v1/respaldos/', {'solicitud_uuid': str(uuid.uuid4())}).status_code, 403)
        respaldo = self.crear()
        self.assertEqual(self.cliente.get(f'/api/v1/respaldos/{respaldo.pk}/descargar/').status_code, 403)

    def test_sin_permiso_anonimo_e_inactivo_no_ven_historial(self):
        self.cliente.force_authenticate(None)
        self.assertEqual(self.cliente.get('/api/v1/respaldos/').status_code, 401)
        usuario = crear_actor(3, [])
        self.cliente.force_authenticate(usuario)
        self.assertEqual(self.cliente.get('/api/v1/respaldos/').status_code, 403)
        self.actor.is_active = False
        self.actor.save(update_fields=['is_active'])
        self.cliente.force_authenticate(self.actor)
        self.assertEqual(self.cliente.get('/api/v1/respaldos/').status_code, 403)

    def test_sesion_exige_csrf_para_solicitar(self):
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(self.actor)
        self.assertEqual(cliente.post('/api/v1/respaldos/', {'solicitud_uuid': str(uuid.uuid4())}).status_code, 403)

    def test_solicitud_idempotente_no_inicia_dos_procesos(self):
        datos = {'solicitud_uuid': str(uuid.uuid4())}
        with patch('respaldos.servicios.iniciar_proceso') as iniciar:
            with self.captureOnCommitCallbacks(execute=True):
                primero = solicitar_respaldo(self.actor, datos)
                segundo = solicitar_respaldo(self.actor, datos)
            self.assertEqual(primero.pk, segundo.pk)
            iniciar.assert_called_once_with(primero.pk)
        self.assertEqual(RegistroActividad.objects.filter(modulo='respaldos', accion='solicitar_respaldo').count(), 1)
        with self.assertRaises(ConflictoRespaldo):
            solicitar_respaldo(crear_actor(2), datos)

    def test_un_respaldo_activo_y_sin_rutas_controladas_por_cliente(self):
        self.crear()
        self.assertEqual(self.cliente.post('/api/v1/respaldos/', {'solicitud_uuid': str(uuid.uuid4())}).status_code, 409)
        self.assertEqual(self.cliente.post('/api/v1/respaldos/', {'solicitud_uuid': str(uuid.uuid4()), 'ruta': 'C:/datos'}).status_code, 400)
        self.assertEqual(self.cliente.post('/api/v1/respaldos/', {'solicitud_uuid': 'invalido'}).status_code, 400)

    def test_paginacion_fija_y_consulta_sin_reactivar_procesos(self):
        for indice in range(11):
            Respaldo.objects.create(solicitud_uuid=uuid.uuid4(), nombre=f'archivo_{indice}.zip', estado='fallido',
                responsable=self.actor, responsable_nombre='Prueba', vence_en=timezone.now(),
                fecha_respaldo=timezone.localdate(), consecutivo=indice + 1)
        with patch('respaldos.servicios.iniciar_proceso') as iniciar:
            primera = self.cliente.get('/api/v1/respaldos/?page_size=100')
            segunda = self.cliente.get('/api/v1/respaldos/?pagina=2')
            self.assertEqual((primera.data['count'], len(primera.data['results']), len(segunda.data['results'])), (11, 10, 1))
            iniciar.assert_not_called()

    def test_publico_no_expone_rutas_incluso_para_administradores(self):
        with self.assertRaises(Resolver404):
            resolve('/api/v1/respaldos/', urlconf='config.rutas_chofer_https')
        with override_settings(ROOT_URLCONF='config.rutas_chofer_https'):
            from .permisos import exigir_permiso
            from rest_framework.exceptions import PermissionDenied
            with self.assertRaises(PermissionDenied):
                exigir_permiso(self.actor)

    def test_descarga_privada_comprueba_integridad_y_no_filtra_rutas(self):
        respaldo = self.crear()
        with tempfile.TemporaryDirectory() as carpeta, override_settings(RESPALDOS_DIRECTORIO=carpeta):
            ruta = ruta_respaldo(respaldo)
            ruta.parent.mkdir()
            ruta.write_bytes(b'archivo de prueba')
            respaldo.estado = 'completado'
            respaldo.tamano_bytes = ruta.stat().st_size
            respaldo.sha256 = hashlib.sha256(ruta.read_bytes()).hexdigest()
            respaldo.save()
            respuesta = self.cliente.get(f'/api/v1/respaldos/{respaldo.pk}/descargar/')
            self.assertEqual(respuesta.status_code, 200)
            self.assertEqual(b''.join(respuesta.streaming_content), b'archivo de prueba')
            self.assertEqual(respuesta['Content-Type'], 'application/zip')
            self.assertIn('no-store', respuesta['Cache-Control'])
            ruta.write_bytes(b'copia modificada')
            respuesta = self.cliente.get(f'/api/v1/respaldos/{respaldo.pk}/descargar/')
            self.assertEqual(respuesta.status_code, 410)
            self.assertNotIn(carpeta, str(respuesta.data))
            ruta.unlink()
            self.assertEqual(self.cliente.get(f'/api/v1/respaldos/{respaldo.pk}/descargar/').status_code, 410)
        self.assertTrue(RegistroActividad.objects.filter(accion='descargar_respaldo').exists())

    def test_copias_anteriores_se_muestran_y_descargan_con_consecutivo_sin_renombrar_archivo(self):
        respaldo = self.crear()
        anterior = f'hortyfru_{respaldo.fecha_respaldo:%d-%m-%Y}_194912_{respaldo.pk.hex[:8]}.zip'
        respaldo.nombre = anterior
        with tempfile.TemporaryDirectory() as carpeta, override_settings(RESPALDOS_DIRECTORIO=carpeta):
            archivo = ruta_respaldo(respaldo)
            archivo.parent.mkdir()
            archivo.write_bytes(b'contenido original')
            respaldo.estado, respaldo.tamano_bytes = 'completado', archivo.stat().st_size
            respaldo.sha256 = hashlib.sha256(archivo.read_bytes()).hexdigest()
            respaldo.save()
            listado = self.cliente.get('/api/v1/respaldos/')
            self.assertEqual(listado.data['results'][0]['nombre'], respaldo.nombre_publico)
            respuesta = self.cliente.get(f'/api/v1/respaldos/{respaldo.pk}/descargar/')
            self.assertIn(f'filename="{respaldo.nombre_publico}"', respuesta['Content-Disposition'])
            self.assertEqual(b''.join(respuesta.streaming_content), b'contenido original')
            self.assertTrue(archivo.is_file())
            respaldo.refresh_from_db()
            self.assertEqual(respaldo.nombre, anterior)

    def test_errores_de_arranque_y_recuperacion_de_interrumpidos(self):
        with patch('respaldos.servicios.subprocess.Popen', side_effect=OSError('dato secreto')):
            with self.captureOnCommitCallbacks(execute=True):
                respaldo = solicitar_respaldo(self.actor, {'solicitud_uuid': str(uuid.uuid4())})
        respaldo.refresh_from_db()
        self.assertEqual(respaldo.estado, 'fallido')
        self.assertNotIn('dato secreto', respaldo.error)
        siguiente = self.crear()
        Respaldo.objects.filter(pk=siguiente.pk).update(vence_en=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.cliente.get(f'/api/v1/respaldos/{siguiente.pk}/').data['estado'], 'fallido')
        self.crear()
        siguiente.refresh_from_db()
        self.assertEqual(siguiente.estado, 'fallido')

    def test_se_rechazan_rutas_externas_y_directorios_publicos(self):
        with tempfile.TemporaryDirectory() as carpeta:
            for nombre in ['../.env', '/etc/passwd', 'C:/datos', 'inexistente.webp']:
                with self.assertRaises(ErrorRespaldo):
                    archivo_permitido(carpeta, nombre)
        with override_settings(RESPALDOS_DIRECTORIO=Path('/tmp/media'), MEDIA_ROOT=Path('/tmp/media')):
            with self.assertRaises(ErrorRespaldo):
                directorio_respaldos()


class PruebasRespaldoReal(TransactionTestCase):
    def setUp(self):
        self.actor = crear_actor()

    def solicitar(self):
        with patch('respaldos.servicios.iniciar_proceso'):
            return solicitar_respaldo(self.actor, {'solicitud_uuid': str(uuid.uuid4())})

    def test_reintentos_concurrentes_conservan_una_solicitud_y_un_proceso(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        barrera = Barrier(2)
        datos, actor_id = {'solicitud_uuid': str(uuid.uuid4())}, self.actor.pk
        def solicitar():
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=actor_id)
                barrera.wait(timeout=10)
                return solicitar_respaldo(actor, datos).pk
            finally:
                close_old_connections()
        with patch('respaldos.servicios.iniciar_proceso') as iniciar:
            with ThreadPoolExecutor(max_workers=2) as grupo:
                resultados = list(grupo.map(lambda _: solicitar(), range(2)))
            self.assertEqual(resultados[0], resultados[1])
            iniciar.assert_called_once_with(resultados[0])
        self.assertEqual(Respaldo.objects.count(), 1)

    def test_proceso_independiente_completa_solicitud_persistida(self):
        import time
        with tempfile.TemporaryDirectory() as carpeta, override_settings(RESPALDOS_DIRECTORIO=carpeta):
            respaldo = solicitar_respaldo(self.actor, {'solicitud_uuid': str(uuid.uuid4())})
            limite = time.monotonic() + 25
            while respaldo.estado == 'preparando' and time.monotonic() < limite:
                time.sleep(0.1)
                respaldo.refresh_from_db()
            self.assertEqual(respaldo.estado, 'completado', respaldo.error)
            self.assertTrue(ruta_respaldo(respaldo).is_file())

    def test_zip_real_sin_contrasena_con_dump_restaurable_y_fotos(self):
        with tempfile.TemporaryDirectory() as carpeta:
            raiz = Path(carpeta)
            foto = raiz / 'fotos' / 'vehiculos' / 'prueba.webp'
            foto.parent.mkdir(parents=True)
            foto.write_bytes(b'foto de prueba')
            (foto.parent / 'huerfana.webp').write_bytes(b'no referenciada')
            (raiz / '.env').write_text('DB_PASSWORD=no debe incluirse')
            Vehiculo.objects.create(placa='PRUEBA-123', tipo='Camion', imagen='vehiculos/prueba.webp', responsable_nombre='Prueba')
            with override_settings(RESPALDOS_DIRECTORIO=raiz / 'respaldos', MEDIA_ROOT=raiz / 'fotos'):
                respaldo = self.solicitar()
                ejecutar_respaldo(respaldo.pk)
                respaldo.refresh_from_db()
                self.assertEqual(respaldo.estado, 'completado', respaldo.error)
                with zipfile.ZipFile(ruta_respaldo(respaldo)) as paquete:
                    self.assertEqual(set(paquete.namelist()), {'base_de_datos.dump', 'fotos/vehiculos/prueba.webp', 'informacion.json'})
                    self.assertTrue(all(not entrada.flag_bits & 1 for entrada in paquete.infolist()))
                    self.assertEqual(paquete.read('fotos/vehiculos/prueba.webp'), b'foto de prueba')
                    datos = json.loads(paquete.read('informacion.json'))
                    for nombre, ficha in datos['archivos'].items():
                        self.assertEqual(hashlib.sha256(paquete.read(nombre)).hexdigest(), ficha['sha256'])
                    self.assertNotIn('DB_PASSWORD', paquete.read('informacion.json').decode())
                    self.assertEqual(paquete.read('base_de_datos.dump')[:5], b'PGDMP')
                    self.comprobar_restauracion(paquete.read('base_de_datos.dump'), raiz)
                self.assertTrue(RegistroActividad.objects.filter(accion='completar_respaldo', origen='sistema').exists())

    def comprobar_restauracion(self, contenido, raiz):
        import psycopg
        from psycopg import sql
        from .archivos import binario_postgres, ejecutar_herramienta
        nombre = 'pruebas_restauracion_respaldos_' + uuid.uuid4().hex[:12]
        parametros = {clave: valor for clave, valor in connection.get_connection_params().items()
                      if clave in ('dbname', 'user', 'password', 'host', 'port', 'sslmode')}
        parametros['dbname'] = 'postgres'
        archivo = raiz / 'restauracion.dump'
        archivo.write_bytes(contenido)
        with psycopg.connect(**parametros, autocommit=True) as administracion:
            administracion.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(nombre)))
            try:
                import time
                ejecutar_herramienta([binario_postgres('pg_restore'), '--exit-on-error', '--no-owner', '--no-acl',
                                     '--dbname=' + nombre, str(archivo)], time.monotonic() + 90)
                parametros['dbname'] = nombre
                with psycopg.connect(**parametros) as restaurada:
                    self.assertEqual(restaurada.execute('SELECT placa, imagen FROM vehiculos').fetchall(),
                                     [('PRUEBA-123', 'vehiculos/prueba.webp')])
                    self.assertEqual(restaurada.execute('SELECT COUNT(*) FROM usuarios_usuario').fetchone()[0], 1)
            finally:
                administracion.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(nombre)))

    def test_revalidacion_y_errores_no_dejan_zip_incompleto(self):
        with tempfile.TemporaryDirectory() as carpeta, override_settings(RESPALDOS_DIRECTORIO=carpeta):
            respaldo = self.solicitar()
            self.actor.user_permissions.clear()
            with patch('respaldos.ejecucion.exportar_base') as exportar:
                ejecutar_respaldo(respaldo.pk)
                exportar.assert_not_called()
            respaldo.refresh_from_db()
            self.assertEqual(respaldo.estado, 'fallido')
            self.assertFalse(list(Path(carpeta).rglob('*.zip')))

    def test_no_fuerza_escrituras_en_curso(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        from django.db import close_old_connections
        bloqueada, terminar = Event(), Event()
        def ocupar():
            close_old_connections()
            try:
                with transaction.atomic():
                    Vehiculo.objects.create(placa='OCUPADO', tipo='Camion', responsable_nombre='Prueba')
                    bloqueada.set()
                    terminar.wait(timeout=10)
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=1) as grupo:
            proceso = grupo.submit(ocupar)
            self.assertTrue(bloqueada.wait(timeout=5))
            try:
                with self.assertRaises(DatabaseError):
                    with instantanea_estable():
                        self.fail('No debe obtener la captura mientras hay una escritura sin confirmar.')
            finally:
                terminar.set()
            proceso.result()
        self.assertTrue(Vehiculo.objects.filter(placa='OCUPADO').exists())


class PruebasRespaldoComprobantes(DatosDescargaPedidos, TransactionTestCase):
    def setUp(self):
        self.preparar_descargas()
        super().setUp()

    def test_incluye_comprobante_privado_sin_mover_productos_ni_cajillas(self):
        from entregas.models import Entrega
        from inventario.models import MovimientoInventario
        from cajillas.models import MovimientoCajilla
        despacho, parada = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.pedido_centro)
        operador = crear_actor(777)
        with tempfile.TemporaryDirectory() as carpeta:
            raiz = Path(carpeta)
            privados = raiz / 'privados'
            privados.mkdir()
            comprobante = privados / 'prueba.pdf'
            comprobante.write_bytes(b'%PDF-1.4 prueba privada')
            (privados / 'huerfano.pdf').write_bytes(b'no referenciado')
            Entrega.objects.create(despacho=despacho, pedido=self.pedido_centro, parada=parada, origen={},
                comprobante='prueba.pdf', responsable_nombre='Prueba')
            antes = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
            with override_settings(RESPALDOS_DIRECTORIO=raiz / 'respaldos', MEDIA_ROOT=raiz / 'fotos', ENTREGAS_ARCHIVOS_DIR=privados):
                with patch('respaldos.servicios.iniciar_proceso'):
                    respaldo = solicitar_respaldo(operador, {'solicitud_uuid': str(uuid.uuid4())})
                ejecutar_respaldo(respaldo.pk)
                respaldo.refresh_from_db()
                self.assertEqual(respaldo.estado, 'completado', respaldo.error)
                with zipfile.ZipFile(ruta_respaldo(respaldo)) as paquete:
                    self.assertEqual(paquete.read('comprobantes/prueba.pdf'), comprobante.read_bytes())
                    self.assertNotIn('comprobantes/huerfano.pdf', paquete.namelist())
            self.assertEqual(antes, (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count()))
