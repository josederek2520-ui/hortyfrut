from django.utils import timezone
from datetime import datetime
from .consultas import version_devolucion, version_entrega, representar_aporte
from inventario.consultas import es_kilogramo


CAMPOS_LINEA = ('cantidad_recibida', 'peso_kg_recibido', 'cantidad_aprovechable', 'cantidad_merma', 'peso_kg_aprovechable', 'peso_kg_merma')


def origen_entrega(entrega):
    return {'id': entrega.pk, 'codigo': entrega.codigo, 'pedido': entrega.pedido_id, 'despacho': entrega.despacho_id, 'codigo_pedido': entrega.origen['codigo_pedido'],
        'codigo_despacho': entrega.origen['codigo_despacho'], 'cliente_nombre': entrega.origen['cliente_nombre'],
        'sucursal_nombre': entrega.origen['sucursal_nombre'], 'confirmado_en': entrega.confirmado_en,
        'descargada_en': entrega.origen['descargada_en'], 'fecha_minima': timezone.localtime(datetime.fromisoformat(entrega.origen['descargada_en'])).date(), 'version': version_entrega(entrega)}


def datos_linea(linea):
    return {'aporte': linea.aporte_id, 'es_kg': es_kilogramo(linea.aporte.lote.unidad), 'producto_nombre': linea.aporte.lote.producto_nombre,
        'unidad_abreviatura': linea.aporte.lote.unidad_abreviatura, **{campo: str(getattr(linea, campo)) if getattr(linea, campo) is not None else None for campo in CAMPOS_LINEA},
        'lote_retenido': {'id': linea.lote_retenido_id, 'codigo': linea.lote_retenido.codigo} if linea.lote_retenido_id else None,
        'lote_aprovechable': {'id': linea.lote_aprovechable_id, 'codigo': linea.lote_aprovechable.codigo} if linea.lote_aprovechable_id else None}


def representar(devolucion, completo=True):
    datos = {'id': devolucion.pk, 'codigo': devolucion.codigo, 'estado': devolucion.estado, 'version': version_devolucion(devolucion),
        'entrega': devolucion.entrega_id, 'codigo_entrega': devolucion.entrega.codigo, 'almacen': devolucion.almacen_id,
        'almacen_nombre': devolucion.almacen_nombre, 'cliente_nombre': devolucion.cliente_nombre, 'sucursal_nombre': devolucion.sucursal_nombre,
        'codigo_pedido': devolucion.codigo_pedido, 'fecha_recepcion': devolucion.fecha_recepcion, 'creado_en': devolucion.creado_en,
        'motivo': devolucion.motivo, 'motivo_revision': devolucion.motivo_revision, 'responsable_nombre': devolucion.responsable_nombre,
        'recibido_por_nombre': devolucion.recibido_por_nombre, 'recibido_en': devolucion.recibido_en,
        'revisado_por_nombre': devolucion.revisado_por_nombre, 'revisado_en': devolucion.revisado_en}
    if completo:
        datos.update(origen=origen_entrega(devolucion.entrega), fecha_maxima=timezone.localdate(),
            lineas=[datos_linea(fila) for fila in devolucion.lineas.select_related('aporte__lote__unidad', 'lote_retenido', 'lote_aprovechable').order_by('aporte_id')],
            movimientos=[{'id': movimiento.pk, 'codigo': movimiento.codigo, 'tipo': movimiento.tipo} for movimiento in
                [devolucion.movimiento_ingreso, devolucion.movimiento_salida_aprovechable, devolucion.movimiento_aprovechable, devolucion.movimiento_merma] if movimiento])
    return datos


def representar_linea(linea, aporte):
    return {**representar_aporte(aporte), **datos_linea(linea)}
