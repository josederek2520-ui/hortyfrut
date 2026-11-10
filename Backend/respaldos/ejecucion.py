import time
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo

from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.db.migrations.recorder import MigrationRecorder
from django.db.models import FileField
from django.utils import timezone
from auditoria.servicios import registrar_actividad
from entregas.comprobantes import almacenamiento
from entregas.models import Entrega
from .archivos import (ErrorRespaldo, archivo_permitido, comprobar_tiempo, copiar_archivo, directorio_respaldos,
                       empaquetar, exportar_base, ruta_respaldo, suma_archivo)
from .models import Respaldo
from .permisos import exigir_permiso
from .servicios import marcar_fallido


@contextmanager
def instantanea_estable():
    # SHARE impide escrituras también desde tareas y otros procesos. Los lectores continúan.
    # NOWAIT evita bloquear operaciones ya iniciadas: se ofrece un reintento en vez de forzarlas.
    tablas = sorted(connection.introspection.table_names())
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
            nombres = ', '.join(connection.ops.quote_name(nombre) for nombre in tablas)
            cursor.execute(f'LOCK TABLE {nombres} IN SHARE MODE NOWAIT')
            cursor.execute('SELECT pg_export_snapshot()')
            instantanea = cursor.fetchone()[0]
        yield instantanea


def archivos_referenciados():
    archivos = {}
    for modelo in apps.get_models():
        for campo in modelo._meta.fields:
            if not isinstance(campo, FileField):
                continue
            for relativo in modelo.objects.exclude(**{campo.name: ''}).exclude(**{campo.name: None}).values_list(campo.name, flat=True).distinct():
                origen, nombre = archivo_permitido(settings.MEDIA_ROOT, relativo)
                archivos['fotos/' + nombre] = origen
    for relativo in Entrega.objects.exclude(comprobante='').values_list('comprobante', flat=True).distinct():
        origen, nombre = archivo_permitido(almacenamiento().location, relativo)
        archivos['comprobantes/' + nombre] = origen
    return archivos


def ejecutar_respaldo(identificador):
    respaldo = Respaldo.objects.get(pk=identificador)
    if respaldo.estado != 'preparando':
        return
    destino = None
    tiene_candado = False
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_lock(734282911)')
            tiene_candado = cursor.fetchone()[0]
        if not tiene_candado:
            raise ErrorRespaldo('Otro proceso está creando un respaldo. Intenta nuevamente en unos instantes.')
        limite = time.monotonic() + max(0, (respaldo.vence_en - timezone.now()).total_seconds())
        comprobar_tiempo(limite)
        actor = get_user_model().objects.get(pk=respaldo.responsable_id)
        exigir_permiso(actor, 'crear')
        raiz = directorio_respaldos()
        destino = ruta_respaldo(respaldo)
        destino.parent.mkdir(mode=0o700, exist_ok=True)
        with TemporaryDirectory(prefix='preparacion_', dir=raiz) as temporal:
            carpeta = Path(temporal)
            with instantanea_estable() as instantanea:
                # Autorizar otra vez dentro de la misma captura que se exporta.
                exigir_permiso(get_user_model().objects.get(pk=actor.pk), 'crear')
                informacion = {
                    'formato': 'hortyfru-respaldo', 'version_formato': 1, 'respaldo_uuid': str(respaldo.pk),
                    'creado_en': timezone.localtime(timezone.now(), timezone=ZoneInfo('America/La_Paz')).isoformat(),
                    'zona_horaria': 'America/La_Paz', 'postgresql_version': connection.pg_version,
                    'migraciones': list(MigrationRecorder.Migration.objects.order_by('app', 'name').values_list('app', 'name')),
                    'alcance': 'Base PostgreSQL y archivos referenciados: fotos y comprobantes. Configuración y código por separado.',
                    'archivos': {},
                }
                for nombre, origen in archivos_referenciados().items():
                    informacion['archivos'][nombre] = copiar_archivo(origen, carpeta / nombre, limite)
                exportar_base(carpeta / 'base_de_datos.dump', instantanea, limite)
            # Liberar las escrituras antes de comprimir y comprobar el paquete.
            base = carpeta / 'base_de_datos.dump'
            informacion['archivos']['base_de_datos.dump'] = {'tamano_bytes': base.stat().st_size, 'sha256': suma_archivo(base)}
            empaquetar(carpeta, destino, informacion, limite)
        suma = suma_archivo(destino)
        with transaction.atomic():
            respaldo = Respaldo.objects.select_for_update().get(pk=respaldo.pk)
            exigir_permiso(get_user_model().objects.get(pk=actor.pk), 'crear')
            comprobar_tiempo(limite)
            if respaldo.estado != 'preparando':
                raise ErrorRespaldo('El proceso ya no está autorizado para completar este respaldo.')
            respaldo.estado, respaldo.sha256 = 'completado', suma
            respaldo.tamano_bytes, respaldo.finalizado_en = destino.stat().st_size, timezone.now()
            respaldo.save(update_fields=['estado', 'sha256', 'tamano_bytes', 'finalizado_en'])
            registrar_actividad('respaldos', 'completar_respaldo', actor=actor, objeto=respaldo,
                                objeto_nombre=respaldo.nombre, cambios={'tamano_bytes': respaldo.tamano_bytes}, origen='sistema')
    except Exception as error:
        if destino:
            try:
                destino.unlink(missing_ok=True)
            except OSError:
                pass  # El estado fallido impide publicar incluso un archivo que no se pudo retirar.
        mensaje = str(error) if isinstance(error, ErrorRespaldo) else 'No se pudo completar el respaldo. Revisa los permisos y que no haya operaciones en curso; vuelve a intentar.'
        marcar_fallido(respaldo.pk, mensaje)
    finally:
        if tiene_candado:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_unlock(734282911)')
