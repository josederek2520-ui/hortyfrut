"""Seguimiento en primer plano. No modifica carga, versiones ni operaciones del viaje."""
from datetime import timedelta, timezone as zona_horaria
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework.exceptions import AuthenticationFailed, ValidationError, Throttled

from auditoria.servicios import registrar_actividad
from usuarios.models import SesionMovil
from .models import Despacho
from .modelos_seguimiento import SesionSeguimiento, PosicionSeguimiento, LotePosiciones
from .permisos import exigir_permiso_chofer
from .eventos_supervision import avisar_cambio_despacho
from .servicios import comprobar_version, huella_datos, ConflictoDespacho
from .serializadores_seguimiento import (SerializadorInicioSeguimiento, SerializadorCierreSeguimiento,
    SerializadorLotePosiciones, SerializadorPosicionGuardada)


def validar(serializador, datos):
    formulario = serializador(data=datos)
    formulario.is_valid(raise_exception=True)
    return formulario.validated_data


def contexto_seguimiento(actor, acceso, viaje, *, operar=True):
    # El acceso móvil se bloquea antes del viaje; revocar usa el mismo orden.
    movil = get_object_or_404(SesionMovil.objects.select_for_update(), pk=acceso.pk, usuario_id=actor.pk)
    actor = get_user_model().objects.get(pk=actor.pk)
    if (movil.revocada_en or movil.vence_en <= timezone.now() or not actor.is_active
            or not constant_time_compare(movil.huella_autenticacion, actor.get_session_auth_hash())):
        raise AuthenticationFailed('La sesión móvil terminó.')
    exigir_permiso_chofer(actor, operar=operar)
    despacho = get_object_or_404(Despacho.objects.select_for_update().filter(chofer=actor), pk=viaje)
    if despacho.enviado_en is None and despacho.estado not in ('en_ruta', 'finalizado'):
        from django.http import Http404
        raise Http404
    return actor, movil, despacho


def cerrar_sesion(sesion, actor, motivo):
    if sesion.cerrada_en is not None:
        return
    sesion.cerrada_en = timezone.now()
    sesion.motivo_cierre = motivo
    sesion.save(update_fields=['cerrada_en', 'motivo_cierre'])
    registrar_actividad('despachos', 'detener_seguimiento', actor=actor, objeto=sesion.despacho,
        descripcion='Seguimiento detenido', cambios={'sesion': str(sesion.pk), 'motivo': motivo})
    avisar_cambio_despacho(sesion.despacho_id)


@transaction.atomic
def cerrar_seguimientos_viaje(despacho, actor, motivo='viaje'):
    for sesion in SesionSeguimiento.objects.select_for_update().filter(despacho=despacho, cerrada_en__isnull=True):
        cerrar_sesion(sesion, actor, motivo)


@transaction.atomic
def cerrar_seguimientos_acceso(acceso, actor):
    viajes = list(SesionSeguimiento.objects.filter(sesion_movil=acceso, cerrada_en__isnull=True).values_list('despacho_id', flat=True))
    for despacho in Despacho.objects.select_for_update().filter(pk__in=viajes).order_by('pk'):
        for sesion in SesionSeguimiento.objects.select_for_update().filter(despacho=despacho, sesion_movil=acceso, cerrada_en__isnull=True):
            cerrar_sesion(sesion, actor, 'cuenta')


def mostrar_sesion(sesion):
    if sesion is None:
        return None
    return {'id': str(sesion.pk), 'activa': sesion.cerrada_en is None and sesion.vence_en > timezone.now(),
        'iniciada_en': sesion.iniciada_en, 'vence_en': sesion.vence_en,
        'cerrada_en': sesion.cerrada_en, 'motivo_cierre': sesion.motivo_cierre,
        'ultima_recepcion_en': sesion.ultima_recepcion_en,
        'ultima_posicion': SerializadorPosicionGuardada(sesion.ultima_posicion).data if sesion.ultima_posicion_id else None}


@transaction.atomic
def consultar_seguimiento(actor, acceso, viaje):
    actor, movil, despacho = contexto_seguimiento(actor, acceso, viaje, operar=False)
    sesion = SesionSeguimiento.objects.select_related('ultima_posicion').filter(despacho=despacho, sesion_movil=movil).first()
    return {'despacho': despacho.pk, 'puede_iniciar': despacho.estado == 'en_ruta' and actor.has_perm('despachos.operar_despachos_propios'),
        'sesion': mostrar_sesion(sesion)}


@transaction.atomic
def iniciar_seguimiento(actor, acceso, viaje, datos):
    valores = validar(SerializadorInicioSeguimiento, datos)
    actor, movil, despacho = contexto_seguimiento(actor, acceso, viaje)
    anterior = SesionSeguimiento.objects.filter(pk=valores['clave_operacion']).first()
    if anterior:
        if (anterior.despacho_id != despacho.pk or anterior.sesion_movil_id != movil.pk
                or anterior.version_inicio != valores['version']):
            raise ConflictoDespacho('El identificador corresponde a otra solicitud de seguimiento.')
        return mostrar_sesion(anterior)
    if despacho.estado != 'en_ruta':
        raise ValidationError({'estado': 'Inicia el viaje antes de compartir tu ubicación.'})
    comprobar_version(despacho, valores['version'])
    activa = SesionSeguimiento.objects.select_related('sesion_movil').filter(despacho=despacho, cerrada_en__isnull=True).first()
    if activa:
        if activa.sesion_movil_id != movil.pk and activa.vence_en > timezone.now() and not activa.sesion_movil.revocada_en:
            raise ConflictoDespacho('El seguimiento está abierto en otro dispositivo. Detén esa sesión antes de continuar.')
        cerrar_sesion(activa, actor, 'reinicio' if activa.sesion_movil_id == movil.pk else 'vencida')
    try:
        with transaction.atomic():
            sesion = SesionSeguimiento.objects.create(id=valores['clave_operacion'], despacho=despacho, usuario=actor,
                sesion_movil=movil, version_inicio=valores['version'], vence_en=movil.vence_en)
    except IntegrityError:
        raise ConflictoDespacho('El seguimiento cambió. Actualiza el viaje y vuelve a intentarlo.') from None
    registrar_actividad('despachos', 'iniciar_seguimiento', actor=actor, objeto=despacho,
        descripcion='Ubicación compartida con autorización del chofer', cambios={'sesion': str(sesion.pk)})
    avisar_cambio_despacho(despacho.pk)
    return mostrar_sesion(sesion)


@transaction.atomic
def detener_seguimiento(actor, acceso, viaje, datos):
    valores = validar(SerializadorCierreSeguimiento, datos)
    actor, movil, despacho = contexto_seguimiento(actor, acceso, viaje)
    sesion = get_object_or_404(SesionSeguimiento, pk=valores['sesion'], despacho=despacho, sesion_movil=movil)
    cerrar_sesion(sesion, actor, valores['motivo'])
    return mostrar_sesion(sesion)


def contenido_posicion(posicion):
    contenido = {campo: str(getattr(posicion, campo)) for campo in (
        'id', 'latitud', 'longitud', 'precision_m', 'velocidad_m_s', 'rumbo', 'capturada_en')}
    contenido['capturada_en'] = posicion.capturada_en.astimezone(zona_horaria.utc).isoformat()
    return contenido


@transaction.atomic
def recibir_posiciones(actor, acceso, viaje, datos):
    valores = validar(SerializadorLotePosiciones, datos)
    actor, movil, despacho = contexto_seguimiento(actor, acceso, viaje)
    sesion = get_object_or_404(SesionSeguimiento.objects.select_related('ultima_posicion'), pk=valores['sesion'], despacho=despacho, sesion_movil=movil)
    posiciones = [PosicionSeguimiento(sesion=sesion, **posicion) for posicion in valores['posiciones']]
    huella = huella_datos([str(sesion.pk), [contenido_posicion(posicion) for posicion in posiciones]])
    anterior = LotePosiciones.objects.filter(pk=valores['clave_operacion']).first()
    if anterior:
        if anterior.sesion_id != sesion.pk or anterior.huella != huella:
            raise ConflictoDespacho('El identificador del lote ya se usó con otros datos.')
        return {'lote': str(anterior.pk), 'guardadas': anterior.cantidad_nueva, 'sesion': mostrar_sesion(sesion)}
    if sesion.cerrada_en or sesion.vence_en <= timezone.now() or despacho.estado != 'en_ruta':
        raise ConflictoDespacho('El seguimiento terminó. No se aceptan posiciones nuevas.')
    momento = timezone.now()
    if sesion.ultima_recepcion_en and momento - sesion.ultima_recepcion_en < timedelta(seconds=2):
        raise Throttled(wait=2, detail='Espera antes de enviar otro lote de ubicaciones.')
    ids = [posicion.pk for posicion in posiciones]
    if len(set(ids)) != len(ids):
        raise ValidationError({'posiciones': 'Cada posición debe tener un identificador diferente.'})
    anteriores = {posicion.pk: posicion for posicion in PosicionSeguimiento.objects.filter(pk__in=ids)}
    nuevas = []
    for posicion in posiciones:
        if not sesion.iniciada_en - timedelta(seconds=30) <= posicion.capturada_en <= momento + timedelta(seconds=60):
            raise ValidationError({'capturada_en': 'La hora de captura no corresponde a esta sesión.'})
        previa = anteriores.get(posicion.pk)
        if previa:
            if previa.sesion_id != sesion.pk or contenido_posicion(previa) != contenido_posicion(posicion):
                raise ConflictoDespacho('Una posición ya existe con otros datos.')
        else:
            nuevas.append(posicion)
    # Como máximo 30 puntos por minuto y sesión, incluso usando lotes diferentes.
    if sesion.posiciones.filter(recibida_en__gte=momento - timedelta(minutes=1)).count() + len(nuevas) > 30:
        raise Throttled(wait=60, detail='Se alcanzó el límite de posiciones por minuto.')
    try:
        with transaction.atomic():
            lote = LotePosiciones.objects.create(id=valores['clave_operacion'], sesion=sesion, huella=huella, cantidad_nueva=len(nuevas))
            for posicion in nuevas:
                posicion.lote = lote
            PosicionSeguimiento.objects.bulk_create(nuevas)
    except IntegrityError:
        raise ConflictoDespacho('El lote contiene identificadores usados en otra solicitud.') from None
    candidatos = nuevas + ([sesion.ultima_posicion] if sesion.ultima_posicion_id else [])
    if candidatos:
        sesion.ultima_posicion = max(candidatos, key=lambda posicion: (posicion.capturada_en, -float(posicion.precision_m)))
    sesion.ultima_recepcion_en = momento
    sesion.save(update_fields=['ultima_recepcion_en', 'ultima_posicion'])
    registrar_actividad('despachos', 'recibir_posiciones', actor=actor, objeto=despacho,
        descripcion='Lote de ubicaciones recibido', cambios={'sesion': str(sesion.pk), 'cantidad': len(nuevas)})
    avisar_cambio_despacho(despacho.pk)
    return {'lote': str(lote.pk), 'guardadas': lote.cantidad_nueva, 'sesion': mostrar_sesion(sesion)}
