from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import nombre_responsable, registrar_actividad
from almacenes.models import Almacen
from entregas.models import Entrega
from .models import Devolucion, LineaDevolucion, OperacionDevolucion
from .permisos import exigir
from .consultas import aportes_origen, huella, version_devolucion, version_entrega
from .serializadores import SerializadorRecepcion, SerializadorRevision, SerializadorAccion
from .validaciones import normalizar_recepcion, normalizar_revision, validar_fecha
from .inventario import recibir_inventario, revisar_inventario


class ConflictoDevolucion(APIException):
    status_code = 409
    default_code = 'devolucion_modificada'
    default_detail = 'La devolución cambió. Recarga sus datos antes de continuar.'


def formulario(clase, datos):
    entrada = clase(data=datos)
    entrada.is_valid(raise_exception=True)
    return entrada.validated_data


def bloquear(actor, codigo, identificador=None, entrega_id=None):
    solo_propias = getattr(actor, '_entregas_solo_propias', False)
    actor = get_object_or_404(get_user_model().objects.all(), pk=actor.pk)
    actor._entregas_solo_propias = solo_propias
    exigir(actor, codigo)
    if identificador is not None:
        entrega_id = get_object_or_404(Devolucion.objects.only('entrega_id'), pk=identificador).entrega_id
    # Todas las escrituras de retornos de una entrega comparten este bloqueo.
    # Los borradores no reservan y el limite se revalida al recibir fisicamente.
    entrega = get_object_or_404(Entrega.objects.select_for_update(), pk=entrega_id, estado='confirmada')
    devolucion = get_object_or_404(Devolucion.objects.select_for_update(of=('self',)).select_related('almacen', 'entrega'),
        pk=identificador, entrega=entrega) if identificador is not None else None
    return actor, entrega, devolucion


def operacion_previa(actor, entrega, devolucion, identificador, accion, datos):
    firma = huella([identificador, entrega.pk, accion, datos])
    previa = OperacionDevolucion.objects.select_related('devolucion').filter(clave_operacion=datos['clave_operacion']).first()
    if previa:
        if previa.huella != firma or previa.responsable_id != actor.pk or previa.accion != accion:
            raise ConflictoDevolucion('La clave de operación ya se utilizó con otros datos o responsable.')
        return firma, previa.devolucion
    version = version_devolucion(devolucion) if devolucion else version_entrega(entrega)
    if datos['version'] != version:
        raise ConflictoDevolucion()
    return firma, None


def registrar(actor, devolucion, accion, datos, firma):
    devolucion.save()
    OperacionDevolucion.objects.create(devolucion=devolucion, clave_operacion=datos['clave_operacion'],
        huella=firma, accion=accion, responsable=actor)
    lineas = list(devolucion.lineas.order_by('aporte_id').values('aporte_id', 'cantidad_recibida', 'peso_kg_recibido',
        'cantidad_aprovechable', 'cantidad_merma', 'peso_kg_aprovechable', 'peso_kg_merma'))
    registrar_actividad('devoluciones', accion, actor=actor, objeto=devolucion, objeto_nombre=devolucion.codigo,
        cambios={'estado': devolucion.estado, 'entrega': devolucion.entrega_id, 'almacen': devolucion.almacen_id,
            'aportes': len(lineas), 'huella_mediciones': huella(lineas),
            'movimientos': [valor for valor in [devolucion.movimiento_ingreso_id, devolucion.movimiento_salida_aprovechable_id,
                devolucion.movimiento_aprovechable_id, devolucion.movimiento_merma_id] if valor]},
        descripcion=f'{accion.replace("_", " ").capitalize()} de devolución de productos')


@transaction.atomic
def guardar_recepcion(actor, datos, identificador=None):
    datos = formulario(SerializadorRecepcion, datos)
    actor, entrega, devolucion = bloquear(actor, 'change_devolucion' if identificador else 'add_devolucion', identificador, datos['entrega'])
    firma, previa = operacion_previa(actor, entrega, devolucion, identificador, 'guardar', datos)
    if previa:
        return previa
    if datos['entrega'] != entrega.pk:
        raise ValidationError({'entrega': 'La entrega de origen no se puede cambiar.'})
    if devolucion and devolucion.estado != 'borrador':
        raise ConflictoDevolucion('La recepción confirmada conserva sus mediciones originales.')
    almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=datos['almacen'])
    if not almacen.activo:
        raise ValidationError({'almacen': 'Selecciona un almacén activo para recibir la devolución.'})
    validar_fecha(datos['fecha_recepcion'], entrega)
    aportes = {aporte.pk: aporte for aporte in aportes_origen(entrega)}
    lineas = normalizar_recepcion(datos['lineas'], aportes)
    if devolucion is None:
        devolucion = Devolucion(entrega=entrega, almacen=almacen, cliente_nombre=entrega.origen['cliente_nombre'],
            sucursal_nombre=entrega.origen['sucursal_nombre'], codigo_pedido=entrega.origen['codigo_pedido'],
            responsable=actor, responsable_nombre=nombre_responsable(actor))
    devolucion.almacen, devolucion.almacen_nombre = almacen, almacen.nombre
    devolucion.fecha_recepcion, devolucion.motivo = datos['fecha_recepcion'], datos['motivo'].strip()
    devolucion.save()
    devolucion.lineas.all().delete()
    LineaDevolucion.objects.bulk_create([LineaDevolucion(devolucion=devolucion, aporte_id=fila['aporte'],
        cantidad_recibida=fila['cantidad_recibida'], peso_kg_recibido=fila['peso_kg_recibido']) for fila in lineas])
    registrar(actor, devolucion, 'guardar', datos, firma)
    return devolucion


@transaction.atomic
def recibir(actor, identificador, datos):
    datos = formulario(SerializadorAccion, datos)
    actor, entrega, devolucion = bloquear(actor, 'recibir_devolucion', identificador)
    firma, previa = operacion_previa(actor, entrega, devolucion, identificador, 'recibir', datos)
    if previa:
        return previa
    if devolucion.estado != 'borrador':
        raise ConflictoDevolucion('Solo se recibe físicamente una devolución en borrador.')
    almacen = Almacen.objects.select_for_update().get(pk=devolucion.almacen_id)
    if not almacen.activo:
        raise ValidationError({'almacen': 'El almacén dejó de estar activo. Corrige el borrador antes de recibir.'})
    validar_fecha(devolucion.fecha_recepcion, entrega, completo=True)
    if not devolucion.motivo.strip():
        raise ValidationError({'motivo': 'Indica el motivo de la devolución.'})
    lineas = list(devolucion.lineas.select_related('aporte__lote__unidad', 'aporte__lote__producto', 'aporte__entrega').order_by('pk'))
    normalizar_recepcion([{'aporte': fila.aporte_id, 'cantidad_recibida': fila.cantidad_recibida, 'peso_kg_recibido': fila.peso_kg_recibido}
        for fila in lineas], {aporte.pk: aporte for aporte in aportes_origen(entrega)}, completo=True)
    devolucion.movimiento_ingreso = recibir_inventario(actor, devolucion, lineas, datos['clave_operacion'])
    devolucion.estado = 'recibida'
    devolucion.recibido_por, devolucion.recibido_por_nombre = actor, nombre_responsable(actor)
    devolucion.recibido_en = timezone.now()
    registrar(actor, devolucion, 'recibir', datos, firma)
    return devolucion


@transaction.atomic
def guardar_revision(actor, identificador, datos):
    datos = formulario(SerializadorRevision, datos)
    actor, entrega, devolucion = bloquear(actor, 'revisar_devolucion', identificador)
    firma, previa = operacion_previa(actor, entrega, devolucion, identificador, 'guardar_revision', datos)
    if previa:
        return previa
    if devolucion.estado != 'recibida':
        raise ConflictoDevolucion('La revisión se registra después de recibir y antes de confirmar su clasificación.')
    existentes = {fila.aporte_id: fila for fila in devolucion.lineas.select_related('aporte__lote__unidad', 'lote_retenido')}
    lineas = normalizar_revision(datos['lineas'], existentes)
    for fila in lineas:
        linea = existentes[fila['aporte']]
        for campo in ['cantidad_aprovechable', 'cantidad_merma', 'peso_kg_aprovechable', 'peso_kg_merma']:
            setattr(linea, campo, fila[campo])
        linea.save(update_fields=['cantidad_aprovechable', 'cantidad_merma', 'peso_kg_aprovechable', 'peso_kg_merma'])
    devolucion.motivo_revision = datos['motivo_revision'].strip()
    registrar(actor, devolucion, 'guardar_revision', datos, firma)
    return devolucion


@transaction.atomic
def revisar(actor, identificador, datos):
    datos = formulario(SerializadorAccion, datos)
    actor, entrega, devolucion = bloquear(actor, 'revisar_devolucion', identificador)
    firma, previa = operacion_previa(actor, entrega, devolucion, identificador, 'revisar', datos)
    if previa:
        return previa
    if devolucion.estado != 'recibida':
        raise ConflictoDevolucion('La devolución ya fue revisada o todavía no fue recibida.')
    if not devolucion.motivo_revision.strip():
        raise ValidationError({'motivo_revision': 'Describe el motivo o resultado de la clasificación de calidad.'})
    existentes = {fila.aporte_id: fila for fila in devolucion.lineas.select_related('aporte__lote__unidad', 'lote_retenido')}
    normalizar_revision([{'aporte': fila.aporte_id, 'cantidad_aprovechable': fila.cantidad_aprovechable,
        'cantidad_merma': fila.cantidad_merma, 'peso_kg_aprovechable': fila.peso_kg_aprovechable,
        'peso_kg_merma': fila.peso_kg_merma} for fila in existentes.values()], existentes, completo=True)
    salida, entrada, merma = revisar_inventario(actor, devolucion, list(existentes.values()), datos['clave_operacion'])
    devolucion.movimiento_salida_aprovechable, devolucion.movimiento_aprovechable, devolucion.movimiento_merma = salida, entrada, merma
    devolucion.estado = 'revisada'
    devolucion.revisado_por, devolucion.revisado_por_nombre = actor, nombre_responsable(actor)
    devolucion.revisado_en = timezone.now()
    registrar(actor, devolucion, 'revisar', datos, firma)
    return devolucion


@transaction.atomic
def cancelar(actor, identificador, datos):
    datos = formulario(SerializadorAccion, datos)
    actor, entrega, devolucion = bloquear(actor, 'cancelar_devolucion', identificador)
    firma, previa = operacion_previa(actor, entrega, devolucion, identificador, 'cancelar', datos)
    if previa:
        return previa
    if devolucion.estado != 'borrador':
        raise ConflictoDevolucion('Solo se cancela un borrador; el retorno físico confirmado conserva su evidencia.')
    devolucion.estado = 'cancelada'
    registrar(actor, devolucion, 'cancelar', datos, firma)
    return devolucion
