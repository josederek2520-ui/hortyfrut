from .consultas import version_acuerdo


def representar(acuerdo, completo=True):
    actual = not acuerdo.tiene_sucesor if hasattr(acuerdo, 'tiene_sucesor') else not acuerdo.versiones.filter(estado='aceptado').exists()
    datos = {'id': acuerdo.pk, 'codigo': acuerdo.codigo, 'estado': acuerdo.estado, 'version': version_acuerdo(acuerdo),
        'cliente': acuerdo.cliente_id, 'cliente_nombre': acuerdo.cliente_nombre, 'alcance': acuerdo.alcance,
        'desde': acuerdo.desde, 'hasta': acuerdo.hasta, 'referencia_propuesta': acuerdo.referencia_propuesta,
        'numero_version': acuerdo.numero_version, 'anterior': acuerdo.anterior_id, 'es_actual': acuerdo.estado == 'aceptado' and actual,
        'motivo_version': acuerdo.motivo_version, 'motivo_rechazo': acuerdo.motivo_rechazo,
        'registrado_por_nombre': acuerdo.registrado_por_nombre, 'propuesto_por_nombre': acuerdo.propuesto_por_nombre,
        'propuesto_en': acuerdo.propuesto_en, 'revisado_por_nombre': acuerdo.revisado_por_nombre, 'revisado_en': acuerdo.revisado_en,
        'creado_en': acuerdo.creado_en, 'total_productos': acuerdo.lineas.count()}
    if completo:
        anteriores = {fila.producto_id: fila.precio_kg for fila in acuerdo.anterior.lineas.all()} if acuerdo.anterior_id else {}
        datos['lineas'] = [{'producto': fila.producto_id, 'producto_nombre': fila.producto_nombre, 'categoria_nombre': fila.categoria_nombre,
            'precio_kg': str(fila.precio_kg) if fila.precio_kg is not None else None,
            'precio_anterior': str(anteriores[fila.producto_id]) if fila.producto_id in anteriores else None} for fila in acuerdo.lineas.all()]
        datos['entregas'] = list(acuerdo.entregas.order_by('entrega_id').values_list('entrega_id', flat=True))
    return datos


def representar_entrega(entrega):
    return {'id': entrega.pk, 'nombre': entrega.codigo, 'sucursal_nombre': entrega.origen['sucursal_nombre'],
        'fecha_requerida': entrega.pedido.fecha_requerida, 'codigo_pedido': entrega.origen['codigo_pedido']}
