import uuid
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from inventario.models import Lote, MovimientoInventario, DetalleMovimientoInventario
from inventario.servicios import _crear_lote_con_codigo
from inventario.consultas import lotes_con_saldo


def movimiento(actor, devolucion, tipo, naturaleza, clave):
    return MovimientoInventario.objects.create(almacen=devolucion.almacen, almacen_nombre=devolucion.almacen_nombre,
        tipo=tipo, naturaleza=naturaleza, fecha=devolucion.fecha_recepcion if tipo == 'entrada_devolucion' else timezone.localdate(),
        referencia_tipo='devolucion', referencia_id=devolucion.pk, referencia_codigo=devolucion.codigo,
        clave_operacion=uuid.uuid5(clave, tipo), responsable=actor, responsable_nombre=nombre_responsable(actor))


def detalle(movimiento, lote, cantidad):
    if cantidad:
        DetalleMovimientoInventario.objects.create(movimiento=movimiento, lote=lote, producto=lote.producto,
            unidad=lote.unidad, cantidad=cantidad)


def lote_derivado(actor, devolucion, origen, calidad, peso, fecha):
    lote = _crear_lote_con_codigo(producto=origen.producto, unidad=origen.unidad, almacen_origen=devolucion.almacen,
        producto_nombre=origen.producto_nombre, unidad_nombre=origen.unidad_nombre, unidad_abreviatura=origen.unidad_abreviatura,
        almacen_nombre=devolucion.almacen_nombre, fecha_ingreso=fecha, fecha_vencimiento=origen.fecha_vencimiento,
        peso_kg_ingreso=peso, estado='bloqueado', calidad=calidad, lote_origen=origen)
    registrar_actividad('lotes', 'recibir_devolucion' if calidad == 'devuelto' else 'separar_aprovechable', actor=actor,
        objeto=lote, objeto_nombre=lote.codigo, cambios={'devolucion': devolucion.codigo, 'origen': origen.codigo, 'calidad': calidad, 'estado': 'bloqueado'})
    return lote


def recibir_inventario(actor, devolucion, lineas, clave):
    if not transaction.get_connection().in_atomic_block:
        raise ValidationError('Confirma la recepción mediante su servicio central.')
    ingreso = movimiento(actor, devolucion, 'entrada_devolucion', 'entrada', clave)
    for linea in lineas:
        lote = lote_derivado(actor, devolucion, linea.aporte.lote, 'devuelto', linea.peso_kg_recibido, devolucion.fecha_recepcion)
        detalle(ingreso, lote, linea.cantidad_recibida)
        linea.lote_retenido = lote
        linea.save(update_fields=['lote_retenido'])
    return ingreso


def revisar_inventario(actor, devolucion, lineas, clave):
    if not transaction.get_connection().in_atomic_block:
        raise ValidationError('Confirma la revisión mediante su servicio central.')
    identificadores = sorted(linea.lote_retenido_id for linea in lineas)
    lotes = {lote.pk: lote for lote in Lote.objects.select_for_update().filter(pk__in=identificadores).order_by('pk')}
    saldos = {lote.pk: lote.saldo for lote in lotes_con_saldo().filter(pk__in=identificadores)}
    if any(lotes[linea.lote_retenido_id].estado != 'bloqueado' or lotes[linea.lote_retenido_id].calidad != 'devuelto' or
           saldos.get(linea.lote_retenido_id) != linea.cantidad_recibida for linea in lineas):
        raise ValidationError({'inventario': 'El lote retenido cambió; revisa su saldo antes de confirmar.'})
    salida = movimiento(actor, devolucion, 'salida_aprovechable_devolucion', 'salida', clave) if any(f.cantidad_aprovechable for f in lineas) else None
    entrada = movimiento(actor, devolucion, 'entrada_aprovechable_devolucion', 'entrada', clave) if salida else None
    merma = movimiento(actor, devolucion, 'salida_merma_devolucion', 'salida', clave) if any(f.cantidad_merma for f in lineas) else None
    for linea in lineas:
        if linea.cantidad_aprovechable:
            detalle(salida, linea.lote_retenido, linea.cantidad_aprovechable)
            lote = lote_derivado(actor, devolucion, linea.lote_retenido, 'aprovechable', linea.peso_kg_aprovechable, timezone.localdate())
            detalle(entrada, lote, linea.cantidad_aprovechable)
            linea.lote_aprovechable = lote
            linea.save(update_fields=['lote_aprovechable'])
        if linea.cantidad_merma:
            detalle(merma, linea.lote_retenido, linea.cantidad_merma)
    return salida, entrada, merma
