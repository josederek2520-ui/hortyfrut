from decimal import Decimal
from django.db.models import OuterRef, Subquery, Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from cobros.consultas import ventas_con_saldos, representar_saldo
from ventas.models import Venta
from .models import AvisoPago, AplicacionAvisoPago, ComprobanteAvisoPago


def ventas_propias_con_saldos(clientes):
    pendientes = AplicacionAvisoPago.objects.filter(venta_id=OuterRef('pk'), aviso__estado='por_verificar').values('venta_id').annotate(importe=Sum('importe')).values('importe')
    return ventas_con_saldos(Venta.objects.filter(estado='emitida', cliente_id__in=clientes.values('pk'))).annotate(
        por_verificar=Coalesce(Subquery(pendientes), Value(Decimal('0.00')), output_field=DecimalField(max_digits=18, decimal_places=2)))


def representar_venta(venta):
    return {**representar_saldo(venta), 'por_verificar': format(venta.por_verificar, '.2f'), 'cliente_nombre': venta.cliente_nombre}


def representar_aviso(aviso):
    comprobante = ComprobanteAvisoPago.objects.filter(aviso=aviso).values('nombre', 'tipo', 'tamano', 'sha256').first()
    return {'id': aviso.pk, 'codigo': aviso.codigo, 'version': str(aviso.version), 'cliente': aviso.cliente_id,
        'cliente_nombre': aviso.cliente_nombre, 'cliente_nit': aviso.cliente_nit,
        'fecha_cobro': aviso.fecha_pago, 'importe': str(aviso.importe), 'medio': aviso.medio,
        'estado': aviso.estado, 'informado_por_nombre': aviso.informado_por_nombre, 'informado_en': aviso.informado_en,
        'revisado_por_nombre': aviso.revisado_por_nombre, 'revisado_en': aviso.revisado_en,
        'motivo_observacion': aviso.motivo_observacion, 'cobro': aviso.cobro_id,
        'codigo_cobro': aviso.cobro.codigo if aviso.cobro_id else None, 'comprobante': comprobante,
        'total_aplicaciones': aviso.aplicaciones.count()}


def representar_aplicacion(fila):
    saldo = representar_saldo(fila.venta)
    return {'venta': fila.venta_id, 'codigo': fila.venta_codigo, 'importe': str(fila.importe),
        'saldo_informado': str(fila.saldo_informado), 'saldo_actual': saldo['saldo'], 'total': str(fila.venta.total)}
