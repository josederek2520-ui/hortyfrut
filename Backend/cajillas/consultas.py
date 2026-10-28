import hashlib
from django.db.models import BigIntegerField, Max, Q, Sum, Value
from django.db.models.functions import Coalesce
from .models import Cajilla, MovimientoCajilla


def sumar_cantidad(criterio, prefijo=''):
    return Coalesce(Sum(f'{prefijo}cantidad', filter=criterio, output_field=BigIntegerField()), Value(0), output_field=BigIntegerField())


def cajillas_con_saldos():
    entradas = Q(movimientos__tipo__in=['inicial', 'ingreso'])
    salidas = Q(movimientos__tipo='salida')
    devueltas = Q(movimientos__tipo='devolucion')
    return Cajilla.objects.annotate(total=sumar_cantidad(entradas, 'movimientos__'),
        en_sucursales=sumar_cantidad(salidas, 'movimientos__') - sumar_cantidad(devueltas, 'movimientos__'),
        en_almacen=sumar_cantidad(entradas | devueltas, 'movimientos__') - sumar_cantidad(salidas, 'movimientos__'),
        ultima_operacion=Max('movimientos__pk'))


def version_cajilla(cajilla):
    ultima = cajilla.ultima_operacion if hasattr(cajilla, 'ultima_operacion') else cajilla.movimientos.aggregate(ultima=Max('pk'))['ultima']
    return hashlib.sha256(f'{cajilla.pk}:{cajilla.color}:{ultima}'.encode()).hexdigest()


def saldo_almacen(cajilla_id, almacen_id):
    datos = MovimientoCajilla.objects.filter(cajilla_id=cajilla_id, almacen_id=almacen_id).aggregate(
        entradas=sumar_cantidad(Q(tipo__in=['inicial', 'ingreso', 'devolucion'])), salidas=sumar_cantidad(Q(tipo='salida')))
    return datos['entradas'] - datos['salidas']


def saldos_almacenes(cajilla_id):
    return MovimientoCajilla.objects.filter(cajilla_id=cajilla_id).values('almacen_id', 'almacen__nombre', 'almacen__activo').annotate(
        cantidad=sumar_cantidad(Q(tipo__in=['inicial', 'ingreso', 'devolucion'])) - sumar_cantidad(Q(tipo='salida')),
    ).filter(cantidad__gt=0).order_by('almacen__nombre', 'almacen_id')


def saldos_sucursales(cajilla_id):
    return MovimientoCajilla.objects.filter(cajilla_id=cajilla_id, sucursal__isnull=False).values('sucursal_id', 'sucursal__nombre', 'sucursal__activo',
        'sucursal__cliente__razon_social', 'sucursal__cliente__activo').annotate(
        cantidad=sumar_cantidad(Q(tipo='salida')) - sumar_cantidad(Q(tipo='devolucion')),
    ).filter(cantidad__gt=0).order_by('sucursal__cliente__razon_social', 'sucursal__nombre', 'sucursal_id')


def pendiente_sucursal(cajilla_id, sucursal_id):
    datos = MovimientoCajilla.objects.filter(cajilla_id=cajilla_id, sucursal_id=sucursal_id).aggregate(
        salidas=sumar_cantidad(Q(tipo='salida')), devueltas=sumar_cantidad(Q(tipo='devolucion')))
    return datos['salidas'] - datos['devueltas']
