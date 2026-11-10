import hashlib
import json
from decimal import Decimal
from django.db.models import BigIntegerField, Count, DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from preparaciones.models import AportePreparacion
from .consultas import asignaciones_disponibles
from .cajillas_preparadas import previsiones_carga


def carga_disponible(filtros):
    consulta = asignaciones_disponibles(filtros.get('despacho')).filter(
        preparacion__almacen_id=filtros['almacen'])
    if filtros.get('fecha'):
        consulta = consulta.filter(preparacion__fecha_pedidos=filtros['fecha'])
    if filtros.get('sucursal'):
        consulta = consulta.filter(sucursal_id=filtros['sucursal'])
    if filtros.get('pedido'):
        consulta = consulta.filter(pedido_id=filtros['pedido'])
    return consulta


def resumir_carga(consulta, *campos):
    decimal = DecimalField(max_digits=24, decimal_places=3)
    pesos = (AportePreparacion.objects.filter(asignacion_id=OuterRef('pk'), cantidad__gt=0)
             .order_by().values('asignacion_id').annotate(total=Sum('peso_kg')).values('total'))
    consulta = consulta.annotate(peso_asignacion=Coalesce(
        Subquery(pesos, output_field=decimal), Value(Decimal('0')), output_field=decimal))
    # Sumar cada asignacion una vez; sus multiples lotes no multiplican cajas o unidades.
    return consulta.order_by().values(*campos).annotate(
        asignaciones=Count('pk'),
        productos=Count('producto_id', distinct=True),
        cajas=Coalesce(Sum('cantidad', filter=Q(columna='cajas'), output_field=BigIntegerField()),
                       Value(0), output_field=BigIntegerField()),
        unidades=Coalesce(Sum('cantidad', filter=Q(columna='unidades'), output_field=BigIntegerField()),
                          Value(0), output_field=BigIntegerField()),
        peso_kg=Sum('peso_asignacion', output_field=decimal))


def destinos_disponibles(filtros):
    consulta = carga_disponible(filtros)
    buscar = filtros.get('buscar', '').strip()
    if buscar:
        consulta = consulta.filter(Q(sucursal__nombre__icontains=buscar) |
                                   Q(sucursal__cliente__razon_social__icontains=buscar))
    return resumir_carga(consulta, 'sucursal_id', 'sucursal__nombre', 'sucursal__direccion',
                         'sucursal__cliente__razon_social').annotate(
        pedidos=Count('pedido_id', distinct=True)).order_by(
        'sucursal__cliente__razon_social', 'sucursal__nombre', 'sucursal_id')


def pedidos_disponibles(filtros):
    return resumir_carga(carga_disponible(filtros), 'pedido_id', 'pedido__fecha_requerida').order_by(
        'pedido__fecha_requerida', 'pedido_id')


def version_carga_disponible(consulta):
    referencias = list(consulta.order_by('pk').values_list('pk', 'preparacion_id', 'sucursal_id', 'producto_id'))
    previstas = previsiones_carga((preparacion, sucursal, producto) for _, preparacion, sucursal, producto in referencias)
    return hashlib.sha256(json.dumps([referencias, previstas], sort_keys=True).encode()).hexdigest()
