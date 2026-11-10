import hashlib
import json
from decimal import Decimal
from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from entregas.models import AporteEntrega
from inventario.consultas import es_kilogramo


def huella(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, default=str, separators=(',', ':')).encode()).hexdigest()


def version_devolucion(devolucion):
    return huella([devolucion.pk, devolucion.actualizado_en.isoformat(), devolucion.estado])


def version_entrega(entrega):
    return huella([entrega.pk, entrega.actualizado_en.isoformat(), entrega.estado])


def aportes_origen(entrega):
    confirmados = Q(devoluciones__devolucion__estado__in=['recibida', 'revisada'])
    decimal = DecimalField(max_digits=24, decimal_places=3)
    return AporteEntrega.objects.filter(entrega=entrega).select_related('lote__producto', 'lote__unidad', 'entrega').annotate(
        cantidad_devuelta=Coalesce(Sum('devoluciones__cantidad_recibida', filter=confirmados), Value(Decimal(0)), output_field=decimal),
        peso_devuelto=Coalesce(Sum('devoluciones__peso_kg_recibido', filter=confirmados), Value(Decimal(0)), output_field=decimal)
    ).order_by('lote__producto_id', 'pk')


def referencia_aporte(aporte):
    producto = next(p for p in aporte.entrega.origen['productos'] if p['producto'] == aporte.lote.producto_id)
    origen = next(a for a in producto['aportes'] if a['carga'] == aporte.carga_id and a['lote'] == aporte.lote_id)
    return producto, origen


def representar_aporte(aporte):
    producto, origen = referencia_aporte(aporte)
    cantidad = Decimal(str(origen['cantidad']))
    devuelto = getattr(aporte, 'cantidad_devuelta', Decimal(0))
    peso_devuelto = getattr(aporte, 'peso_devuelto', Decimal(0))
    return {'id': aporte.pk, 'producto': aporte.lote.producto_id, 'producto_nombre': producto['nombre'],
        'carga': aporte.carga_id, 'lote': aporte.lote_id, 'codigo_lote': origen['codigo_lote'], 'preparacion': origen['preparacion'],
        'unidad': aporte.lote.unidad_id, 'unidad_nombre': aporte.lote.unidad_nombre, 'unidad_abreviatura': aporte.lote.unidad_abreviatura,
        'es_kg': es_kilogramo(aporte.lote.unidad), 'cantidad_enviada': str(cantidad), 'peso_recibido_entrega': str(aporte.peso_recibido_kg),
        'peso_rechazado_entrega': str(aporte.peso_rechazado_kg), 'cantidad_devuelta': str(devuelto), 'peso_devuelto': str(peso_devuelto),
        'maximo_cantidad': str(max(Decimal(0), cantidad - devuelto)),
        'maximo_peso': str(max(Decimal(0), aporte.peso_recibido_kg - peso_devuelto)),
        'fecha_vencimiento': aporte.lote.fecha_vencimiento, 'vencido': bool(aporte.lote.fecha_vencimiento and aporte.lote.fecha_vencimiento < timezone.localdate())}
