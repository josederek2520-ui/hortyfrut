"""Solicitud persistida e idempotente; el proceso separado genera el ZIP en el equipo servidor."""
import os
import subprocess
import sys
import uuid
from datetime import timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, connection, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import nombre_responsable, registrar_actividad
from .models import Respaldo
from .permisos import exigir_permiso
from .nombres import nombre_respaldo


class ConflictoRespaldo(APIException):
    status_code = 409
    default_detail = 'Ya hay un respaldo en preparación. Espera a que termine.'


def marcar_fallido(identificador, mensaje):
    with transaction.atomic():
        respaldo = Respaldo.objects.select_for_update().get(pk=identificador)
        if respaldo.estado != 'preparando':
            return
        respaldo.estado, respaldo.error = 'fallido', mensaje
        respaldo.finalizado_en = timezone.now()
        respaldo.save(update_fields=['estado', 'error', 'finalizado_en'])
        registrar_actividad('respaldos', 'fallar_respaldo', actor=respaldo.responsable, objeto=respaldo,
                            objeto_nombre=respaldo.nombre, resultado='error', descripcion=mensaje, origen='sistema')


def iniciar_proceso(identificador):
    try:
        entorno = os.environ.copy()
        entorno['RESPALDOS_DIRECTORIO'] = str(Path(settings.RESPALDOS_DIRECTORIO).resolve())
        entorno['RESPALDOS_PG_BIN'] = settings.RESPALDOS_PG_BIN
        entorno['RESPALDOS_TIEMPO_MAXIMO_S'] = str(settings.RESPALDOS_TIEMPO_MAXIMO_S)
        if getattr(settings, 'ENTORNO_PRUEBAS_AISLADAS', False):
            entorno['HORTYFRU_BD_PRUEBAS'] = str(connection.settings_dict['NAME'])
        else:
            entorno['DB_NAME'] = str(connection.settings_dict['NAME'])
        opciones = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
        subprocess.Popen([
            sys.executable, str(Path(settings.BASE_DIR) / 'manage.py'), 'ejecutar_respaldo', str(identificador),
            '--settings=' + os.environ.get('DJANGO_SETTINGS_MODULE', 'config.settings')],
            cwd=settings.BASE_DIR, env=entorno, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            **opciones)
    except OSError:
        marcar_fallido(identificador, 'No se pudo iniciar el proceso de respaldo. Intenta nuevamente.')


def solicitar_respaldo(actor, datos):
    exigir_permiso(actor, 'crear')
    try:
        if set(datos) != {'solicitud_uuid'}:
            raise ValueError()
        solicitud_uuid = uuid.UUID(str(datos['solicitud_uuid']))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValidationError({'solicitud_uuid': 'Envía únicamente un identificador UUID de solicitud válido.'})
    try:
        with transaction.atomic():
            # Serializar también el primer número de cada día y los reintentos entre procesos.
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(734282912)')
            anterior = Respaldo.objects.filter(solicitud_uuid=solicitud_uuid).first()
            if anterior:
                if anterior.responsable_id != actor.pk:
                    raise ConflictoRespaldo('Ese identificador de solicitud ya fue utilizado.')
                return anterior
            for anterior in Respaldo.objects.select_for_update().filter(estado='preparando', vence_en__lt=timezone.now()):
                marcar_fallido(anterior.pk, 'El proceso se interrumpió o excedió su tiempo. Crea un respaldo nuevo.')
            if Respaldo.objects.filter(estado='preparando').exists():
                raise ConflictoRespaldo()
            identificador = uuid.uuid4()
            fecha = timezone.now().astimezone(ZoneInfo('America/La_Paz')).date()
            consecutivo = (Respaldo.objects.filter(fecha_respaldo=fecha).aggregate(ultimo=Max('consecutivo'))['ultimo'] or 0) + 1
            respaldo = Respaldo.objects.create(
                id=identificador, solicitud_uuid=solicitud_uuid, responsable=actor,
                responsable_nombre=nombre_responsable(actor), nombre=nombre_respaldo(fecha, consecutivo),
                fecha_respaldo=fecha, consecutivo=consecutivo,
                vence_en=timezone.now() + timedelta(seconds=settings.RESPALDOS_TIEMPO_MAXIMO_S))
            registrar_actividad('respaldos', 'solicitar_respaldo', actor=actor, objeto=respaldo, objeto_nombre=respaldo.nombre)
            transaction.on_commit(lambda: iniciar_proceso(respaldo.pk))
        respaldo.refresh_from_db()
        return respaldo
    except IntegrityError:
        anterior = Respaldo.objects.filter(solicitud_uuid=solicitud_uuid, responsable=actor).first()
        if anterior:
            return anterior
        raise ConflictoRespaldo()
