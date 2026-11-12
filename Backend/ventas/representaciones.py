from decimal import Decimal
from .consultas import version_venta, revisar_venta


def lineas_emitidas(venta):
    return [{**fila.contenido, 'aportes': [{'aporte': a.aporte_id, 'codigo_lote': a.codigo_lote,
        'peso_aceptado_kg': str(a.peso_aceptado_kg), 'importe': str(a.importe)} for a in fila.aportes.all()]}
        for fila in venta.lineas.prefetch_related('aportes').order_by('pk')]


def representar(venta, completo=True):
    # Cobros es una etapa independiente. No existe escritura de pagos ni un
    # indicador manual de "pagado"; hoy ninguna venta tiene cobros aplicados.
    datos = {'id': venta.pk, 'codigo': venta.codigo, 'estado': venta.estado, 'version': version_venta(venta),
        'cliente': venta.cliente_id, 'cliente_nombre': venta.cliente_nombre, 'cliente_nit': venta.cliente_nit,
        'desde': venta.desde, 'hasta': venta.hasta, 'fecha_emision': venta.fecha_emision, 'vencimiento': venta.vencimiento,
        'total': str(venta.total) if venta.estado == 'emitida' else None,
        'cobrado': '0.00' if venta.estado == 'emitida' else None,
        'saldo': str(venta.total) if venta.estado == 'emitida' else None,
        'estado_cobro': 'pendiente' if venta.estado == 'emitida' else None,
        'peso_aceptado_kg': str(venta.peso_aceptado_kg) if venta.estado == 'emitida' else None,
        'total_entregas': venta.selecciones.count(), 'creado_en': venta.creado_en,
        'registrado_por_nombre': venta.registrado_por_nombre, 'emitido_por_nombre': venta.emitido_por_nombre, 'emitido_en': venta.emitido_en}
    if completo:
        datos['seleccion'] = list(venta.selecciones.order_by('entrega_id').values_list('entrega_id', flat=True))
        if venta.estado != 'emitida':
            revision = revisar_venta(venta)
            datos.update({k: v for k, v in revision.items() if k != 'lineas'})
            datos['total_lineas'] = len(revision['lineas'])
        else:
            datos.update({'revision': '', 'incidencias': [], 'total_lineas': venta.lineas.count()})
            # Contexto histórico para continuar leyendo sin consultar catálogos.
            entregas = {}
            for fila in venta.lineas.all():
                origen = fila.contenido
                grupo = entregas.setdefault(origen['entrega'], {'id': origen['entrega'], 'codigo': origen['codigo_entrega'],
                    'sucursal_nombre': origen['sucursal_nombre'], 'codigo_pedido': origen['codigo_pedido'],
                    'fecha_recepcion': origen['fecha_recepcion'], 'fecha_requerida': origen['fecha_requerida'],
                    'productos': 0, 'peso_aceptado_kg': Decimal(0), 'total': Decimal(0), 'incidencias': []})
                grupo['productos'] += 1
                grupo['peso_aceptado_kg'] += fila.peso_aceptado_kg
                grupo['total'] += fila.importe
            datos['entregas'] = [{**g, 'peso_aceptado_kg': str(g['peso_aceptado_kg']), 'total': str(g['total'])} for g in entregas.values()]
    return datos
