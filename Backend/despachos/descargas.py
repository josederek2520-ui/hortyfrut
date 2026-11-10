"""Descargas sobre las asignaciones transportadas, sin duplicar pedidos o paradas."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from auditoria.servicios import nombre_responsable


def contenido_carga_descarga(carga):
    return {'id': carga.pk, 'asignacion': carga.asignacion_id, 'parada': carga.parada_id, **carga.contenido,
            'descargada_en': carga.descargada_en, 'responsable_descarga_nombre': carga.responsable_descarga_nombre}


def agrupar_pedidos_descarga(cargas):
    grupos = {}
    for carga in cargas:
        grupos.setdefault((carga.parada_id, carga.contenido['pedido']), []).append(carga)
    pedidos = []
    for (parada_id, pedido_id), filas in grupos.items():
        referencia = filas[0].contenido
        completas = all(fila.descargada_en is not None for fila in filas)
        ultima = max(filas, key=lambda fila: fila.descargada_en) if completas else None
        pedidos.append({
            'pedido': pedido_id, 'parada': parada_id,
            'codigo_pedido': referencia['codigo_pedido'], 'fecha_requerida': referencia['fecha_requerida'],
            'sucursal': referencia['sucursal'],
            'productos': len({fila.contenido['producto'] for fila in filas}), 'asignaciones': len(filas),
            'cajas': sum(fila.contenido['cantidad'] for fila in filas if fila.contenido['columna'] == 'cajas'),
            'unidades': sum(fila.contenido['cantidad'] for fila in filas if fila.contenido['columna'] == 'unidades'),
            'peso_kg': str(sum((Decimal(fila.contenido['peso_kg']) for fila in filas), Decimal('0'))),
            'descargada_en': ultima.descargada_en if ultima else None,
            'responsable_descarga_nombre': ultima.responsable_descarga_nombre if ultima else '',
            'registro_anterior': completas and all(not fila.responsable_descarga_nombre for fila in filas),
        })
    return sorted(pedidos, key=lambda fila: (fila['parada'], fila['fecha_requerida'], fila['pedido']))


def anotar_descarga_pedido(parada, actor, pedido_id=None, comprobadas=None, como_chofer=False):
    # El llamador mantiene bloqueado el despacho dentro de la transacción.
    cargas = list(parada.cargas.order_by('pk'))
    elegidas = [fila for fila in cargas if pedido_id is None or fila.contenido['pedido'] == pedido_id]
    if not elegidas:
        raise ValidationError({'pedido': 'El pedido no tiene carga en esta parada del despacho.'})
    pendientes = [fila for fila in elegidas if fila.descargada_en is None]
    if not pendientes:
        raise ValidationError({'pedido': 'La descarga de este pedido ya está confirmada.'})
    if pedido_id is not None and set(comprobadas or []) != {fila.pk for fila in elegidas}:
        raise ValidationError({'cargas_comprobadas': 'Revisa todos los productos de este pedido antes de confirmar su descarga.'})
    if como_chofer and pedido_id is None and len({fila.contenido['pedido'] for fila in pendientes}) > 1:
        raise ValidationError({'pedido': 'Esta sucursal tiene varios pedidos. Confirma la descarga de cada pedido por separado.'})
    momento = timezone.now()
    identificadores = [fila.pk for fila in pendientes]
    parada.cargas.filter(pk__in=identificadores).update(descargada_en=momento, responsable_descarga=actor,
                                                      responsable_descarga_nombre=nombre_responsable(actor))
    return {'cargas_descargadas': identificadores,
            'pedidos_descargados': sorted({fila.contenido['pedido'] for fila in pendientes}),
            'parada_completa': not parada.cargas.filter(descargada_en__isnull=True).exists(), 'momento': momento}
