from decimal import Decimal
from django.db.models import Case, CharField, DecimalField, F, OuterRef, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from precios.consultas import huella
from .models import AplicacionCobro, ComprobanteCobro


def ventas_con_saldos(consulta):
    importes = AplicacionCobro.objects.filter(venta_id=OuterRef('pk')).values('venta_id').annotate(total=Sum('importe')).values('total')
    consulta = consulta.annotate(cobrado_calculado=Coalesce(Subquery(importes), Value(Decimal('0.00')), output_field=DecimalField(max_digits=18, decimal_places=2)))
    return consulta.annotate(saldo_calculado=F('total') - F('cobrado_calculado'), estado_cobro_calculado=Case(
        When(cobrado_calculado__gte=F('total'), then=Value('pagada')),
        When(cobrado_calculado__gt=0, then=Value('parcial')), default=Value('pendiente'), output_field=CharField()))


def saldo_venta(venta):
    cobrado = venta.cobrado_calculado if hasattr(venta, 'cobrado_calculado') else (venta.aplicaciones_cobro.aggregate(total=Sum('importe'))['total'] or Decimal('0.00'))
    return {'cobrado': format(cobrado, '.2f'), 'saldo': format(venta.total - cobrado, '.2f'),
        'estado_cobro': 'pagada' if cobrado >= venta.total else 'parcial' if cobrado else 'pendiente'}


def representar_saldo(venta):
    datos = saldo_venta(venta)
    return {'id': venta.pk, 'codigo': venta.codigo, 'cliente': venta.cliente_id, 'fecha_emision': venta.fecha_emision,
        'desde': venta.desde, 'hasta': venta.hasta, 'total': format(venta.total, '.2f'), **datos,
        'version_saldo': huella([venta.pk, venta.estado, venta.total, datos['cobrado']])}


def representar_cobro(cobro):
    comprobante = ComprobanteCobro.objects.filter(cobro=cobro).values('nombre', 'tipo', 'tamano', 'sha256').first()
    return {'id': cobro.pk, 'codigo': cobro.codigo, 'cliente': cobro.cliente_id, 'cliente_nombre': cobro.cliente_nombre,
        'cliente_nit': cobro.cliente_nit, 'fecha_cobro': cobro.fecha_cobro, 'importe': str(cobro.importe),
        'medio': cobro.medio, 'referencia': cobro.referencia, 'comprobante': comprobante, 'registrado_por_nombre': cobro.registrado_por_nombre,
        'registrado_en': cobro.registrado_en, 'total_aplicaciones': cobro.aplicaciones.count()}


def representar_aplicacion(fila):
    return {'venta': fila.venta_id, 'codigo': fila.venta_codigo, 'importe': str(fila.importe),
        'saldo_anterior': str(fila.saldo_anterior), 'saldo_posterior': str(fila.saldo_posterior)}
