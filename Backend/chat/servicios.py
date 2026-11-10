"""Mensajes privados persistidos; los avisos se publican solo despues del commit."""
import asyncio
import logging
from datetime import timedelta
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, Throttled, ValidationError
from auditoria.servicios import registrar_actividad
from .models import BuzonChat, Conversacion, Mensaje

bitacora = logging.getLogger(__name__)


class ConflictoMensaje(APIException):
    status_code = 409
    default_detail = 'Esta clave corresponde a otro mensaje. Comprueba el envío antes de continuar.'


def exigir_usuario(actor):
    if not actor or not actor.is_authenticated or not actor.is_active:
        raise PermissionDenied('Inicia sesión con una cuenta activa para usar el chat.')


def alcance_conversaciones(actor):
    exigir_usuario(actor)
    return Conversacion.objects.filter(Q(usuario_menor=actor) | Q(usuario_mayor=actor))


def obtener_conversacion(actor, identificador):
    return get_object_or_404(alcance_conversaciones(actor).select_related('usuario_menor', 'usuario_mayor', 'ultimo_mensaje'), pk=identificador)


def grupo_usuario(identificador):
    return f'chat.usuario.{identificador}'


def avisar_usuarios(identificadores):
    def publicar():
        try:
            from channels.layers import get_channel_layer
            capa = get_channel_layer()
            async def enviar():
                for identificador in identificadores:
                    await capa.group_send(grupo_usuario(identificador), {'type': 'chat.cambio'})
            if capa:
                async_to_sync(asyncio.wait_for)(enviar(), timeout=1.5)
        except Exception:
            bitacora.warning('No se pudo distribuir un aviso de chat; los mensajes siguen guardados.')
    transaction.on_commit(publicar, robust=True)


def bloquear_buzones(identificadores):
    ordenados = sorted(set(identificadores))
    for identificador in ordenados:
        BuzonChat.objects.get_or_create(usuario_id=identificador)
    return list(BuzonChat.objects.select_for_update().filter(usuario_id__in=ordenados).order_by('usuario_id'))


def cambiar_buzones(buzones):
    for buzon in buzones:
        buzon.revision += 1
        buzon.save(update_fields=['revision'])
    avisar_usuarios([buzon.usuario_id for buzon in buzones])


@transaction.atomic
def abrir_conversacion(actor, usuario):
    exigir_usuario(actor)
    if usuario == actor.pk:
        raise ValidationError('Elige a otro usuario para conversar.')
    buzones = bloquear_buzones([actor.pk, get_object_or_404(get_user_model(), pk=usuario, is_active=True).pk])
    if get_user_model().objects.filter(pk__in=[actor.pk, usuario], is_active=True).count() != 2:
        raise PermissionDenied('Ambos usuarios deben estar activos.')
    menor, mayor = sorted([actor.pk, usuario])
    conversacion, creada = Conversacion.objects.get_or_create(usuario_menor_id=menor, usuario_mayor_id=mayor)
    if creada:
        registrar_actividad('chat', 'abrir_conversacion_chat', actor=actor, objeto=conversacion,
            descripcion='Conversacion privada entre usuarios')
        cambiar_buzones(buzones)
    return obtener_conversacion(actor, conversacion.pk), creada


def enviar_mensaje(actor, identificador, valores):
    try:
        return _enviar_mensaje(actor, identificador, valores)
    except IntegrityError:
        anterior = Mensaje.objects.filter(clave_cliente=valores['clave_cliente']).first()
        if anterior:
            if anterior.conversacion_id == identificador and anterior.autor_id == actor.pk and anterior.texto == valores['texto']:
                return anterior, False
            raise ConflictoMensaje() from None
        raise


@transaction.atomic
def _enviar_mensaje(actor, identificador, valores):
    conversacion = obtener_conversacion(actor, identificador)
    buzones = bloquear_buzones([conversacion.usuario_menor_id, conversacion.usuario_mayor_id])
    conversacion = Conversacion.objects.select_for_update().get(pk=conversacion.pk)
    if get_user_model().objects.filter(pk__in=[conversacion.usuario_menor_id, conversacion.usuario_mayor_id], is_active=True).count() != 2:
        raise PermissionDenied('No se pueden enviar mensajes a una cuenta inactiva.')
    anterior = Mensaje.objects.filter(clave_cliente=valores['clave_cliente']).first()
    if anterior:
        if (anterior.conversacion_id != conversacion.pk or anterior.autor_id != actor.pk or anterior.texto != valores['texto']):
            raise ConflictoMensaje()
        return anterior, False
    recientes = Mensaje.objects.filter(autor=actor, creado_en__gte=timezone.now() - timedelta(minutes=1))
    if recientes.count() >= 30:
        raise Throttled(wait=60, detail='Espera un momento antes de enviar más mensajes.')
    mensaje = Mensaje.objects.create(conversacion=conversacion, autor=actor, **valores)
    conversacion.ultimo_mensaje = mensaje
    conversacion.actualizada_en = mensaje.creado_en
    conversacion.save(update_fields=['ultimo_mensaje', 'actualizada_en'])
    registrar_actividad('chat', 'enviar_mensaje_chat', actor=actor, objeto=mensaje,
        descripcion='Mensaje privado enviado', cambios={'conversacion': conversacion.pk})
    cambiar_buzones(buzones)
    return mensaje, True


@transaction.atomic
def registrar_lectura(actor, identificador, identificadores):
    conversacion = obtener_conversacion(actor, identificador)
    buzones = bloquear_buzones([conversacion.usuario_menor_id, conversacion.usuario_mayor_id])
    recibidos = Mensaje.objects.filter(conversacion=conversacion, pk__in=identificadores).exclude(autor=actor)
    if recibidos.count() != len(identificadores):
        raise ValidationError('Comprueba los mensajes recibidos de esta conversación.')
    cantidad = recibidos.filter(leido_en__isnull=True).update(leido_en=timezone.now())
    if cantidad:
        registrar_actividad('chat', 'leer_mensajes_chat', actor=actor, objeto=conversacion,
            descripcion='Lectura de mensajes recibidos', cambios={'cantidad': cantidad})
        cambiar_buzones(buzones)
    return {'marcados': cantidad}


@transaction.atomic
def resumen_buzon(actor):
    exigir_usuario(actor)
    buzon = bloquear_buzones([actor.pk])[0]
    recibidos = Mensaje.objects.filter(conversacion__in=alcance_conversaciones(actor)).exclude(autor=actor)
    ultimo = recibidos.order_by('-pk').select_related('autor').first()
    return {'usuario': actor.pk, 'revision': buzon.revision, 'no_leidos': recibidos.filter(leido_en__isnull=True).count(),
        'ultimo_recibido': {'id': ultimo.pk, 'conversacion': ultimo.conversacion_id,
            'autor': {'id': ultimo.autor_id, 'nombre': ultimo.autor.get_full_name() or 'Usuario'},
            'creado_en': ultimo.creado_en.isoformat()} if ultimo else None}
