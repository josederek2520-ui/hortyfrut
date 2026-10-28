from decimal import Decimal
from django.db.models import Sum, OuterRef, Subquery, DecimalField, Value, F, Exists
from django.db.models.functions import Coalesce
from compras.models import Compra, DetalleCompra
from .models import DetalleRecepcion


def avance_compra(compra_id):
    filas = DetalleRecepcion.objects.filter(recepcion__compra_id=compra_id, recepcion__estado='confirmada').values('detalle_compra_id').annotate(recibido=Sum('cantidad_compra'))
    return {fila['detalle_compra_id']: fila['recibido'] for fila in filas}


def detalles_con_pendiente(consulta):
    recibidos = DetalleRecepcion.objects.filter(
        detalle_compra_id=OuterRef('pk'), recepcion__estado='confirmada',
    ).values('detalle_compra_id').annotate(total=Sum('cantidad_compra')).values('total')
    return consulta.annotate(recibido_confirmado=Coalesce(
        Subquery(recibidos, output_field=DecimalField(max_digits=14, decimal_places=3)),
        Value(Decimal('0')),
    )).filter(cantidad__gt=F('recibido_confirmado'))


def compras_pendientes():
    recibidos = DetalleRecepcion.objects.filter(detalle_compra_id=OuterRef('pk'), recepcion__estado='confirmada').values('detalle_compra_id').annotate(total=Sum('cantidad_compra')).values('total')
    pendientes = DetalleCompra.objects.filter(compra_id=OuterRef('pk')).annotate(recibido=Coalesce(Subquery(recibidos, output_field=DecimalField(max_digits=14, decimal_places=3)), Value(Decimal('0')))).filter(cantidad__gt=F('recibido'))
    return Compra.objects.filter(estado='registrada').annotate(tiene_pendientes=Exists(pendientes))
