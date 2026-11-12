from decimal import Decimal
from django.db.models import Exists, F, OuterRef, Prefetch
from entregas.models import Entrega, LineaEntrega, AporteEntrega
from precios.consultas import huella, precio_para_entrega
from rest_framework.exceptions import ValidationError
from .calculos import calcular_importes, MAXIMO_IMPORTE
from .models import EntregaVenta


def version_venta(venta):
    return huella([venta.pk, venta.actualizado_en.isoformat(), venta.estado])


def entregas_con_datos():
    return Entrega.objects.select_related('pedido__sucursal__cliente').prefetch_related(
        Prefetch('lineas', queryset=LineaEntrega.objects.select_related('producto').order_by('producto_id')),
        Prefetch('aportes', queryset=AporteEntrega.objects.select_related('lote').order_by('pk')),
    )


def entregas_pendientes(cliente):
    positivas = LineaEntrega.objects.filter(entrega_id=OuterRef('pk'), peso_recibido_kg__gt=F('peso_rechazado_kg'))
    emitidas = EntregaVenta.objects.filter(entrega_id=OuterRef('pk'))
    return entregas_con_datos().filter(estado='confirmada', pedido__sucursal__cliente_id=cliente).annotate(
        tiene_aceptados=Exists(positivas), ya_emitida=Exists(emitidas),
    ).filter(tiene_aceptados=True, ya_emitida=False)


def calcular_entrega(entrega, incluir_lineas=True):
    lineas, incidencias = [], []
    if entrega.estado != 'confirmada' or not entrega.fecha_recepcion:
        incidencias.append('sin_confirmar')
    if EntregaVenta.objects.filter(entrega=entrega).exists():
        incidencias.append('ya_incluida')
    origenes = {p['producto']: p for p in entrega.origen.get('productos', [])}
    aportes = {(a.carga_id, a.lote_id): a for a in entrega.aportes.all()}
    for fila in entrega.lineas.all():
        if fila.peso_recibido_kg is None:
            incidencias.append('peso_incompleto')
            continue
        peso = fila.peso_recibido_kg - fila.peso_rechazado_kg
        if peso <= 0:
            continue
        origen = origenes.get(fila.producto_id, {})
        referencias = origen.get('aportes', [])
        medidos = [aportes.get((a['carga'], a['lote'])) for a in referencias]
        completos = bool(medidos) and all(a is not None for a in medidos)
        if completos:
            completos = (sum((a.peso_recibido_kg for a in medidos), Decimal(0)) == fila.peso_recibido_kg and
                sum((a.peso_rechazado_kg for a in medidos), Decimal(0)) == fila.peso_rechazado_kg)
        if not completos:
            incidencias.append('aportes_incompletos')
        medidos = sorted([a for a in medidos if a is not None and a.peso_recibido_kg > a.peso_rechazado_kg], key=lambda a: a.pk)
        try:
            precio = precio_para_entrega(entrega, fila.producto_id) if entrega.estado == 'confirmada' else None
        except ValidationError:
            precio = None
            incidencias.append('precio_ambiguo')
        if not precio or precio.precio_kg is None or precio.precio_kg <= 0:
            precio = None
            incidencias.append('sin_precio')
        importe, reparto = calcular_importes([a.peso_recibido_kg - a.peso_rechazado_kg for a in medidos], precio.precio_kg) if completos and precio else (None, [])
        if importe is not None and importe > MAXIMO_IMPORTE:
            incidencias.append('importe_excesivo')
        lineas.append({
            'linea_entrega': fila.pk, 'entrega': entrega.pk, 'codigo_entrega': entrega.codigo,
            'producto': fila.producto_id, 'producto_nombre': origen.get('nombre', fila.producto.nombre),
            'pedido': entrega.pedido_id, 'codigo_pedido': entrega.origen.get('codigo_pedido', f'PED-{entrega.pedido_id:06d}'),
            'sucursal': entrega.origen.get('sucursal', entrega.pedido.sucursal_id),
            'sucursal_nombre': entrega.origen.get('sucursal_nombre', entrega.pedido.sucursal.nombre),
            'fecha_recepcion': str(entrega.fecha_recepcion) if entrega.fecha_recepcion else None,
            'fecha_requerida': str(entrega.pedido.fecha_requerida),
            'peso_aceptado_kg': str(peso), 'precio_kg': str(precio.precio_kg) if precio else None,
            'precio': precio.pk if precio else None, 'acuerdo': precio.acuerdo_id if precio else None,
            'codigo_acuerdo': precio.acuerdo.codigo if precio else None,
            'version_acuerdo': precio.acuerdo.numero_version if precio else None,
            'importe': str(importe) if importe is not None else None,
            'aportes': [{'aporte': a.pk, 'carga': a.carga_id, 'lote': a.lote_id, 'codigo_lote': a.lote.codigo,
                'peso_aceptado_kg': str(a.peso_recibido_kg - a.peso_rechazado_kg),
                'importe': str(reparto[i]) if reparto else None} for i, a in enumerate(medidos)],
        })
    if not lineas:
        incidencias.append('sin_aceptados')
    total = sum((Decimal(f['importe']) for f in lineas if f['importe'] is not None), Decimal(0))
    if total > MAXIMO_IMPORTE:
        incidencias.append('importe_excesivo')
    datos = {'id': entrega.pk, 'codigo': entrega.codigo,
        'sucursal_nombre': entrega.origen.get('sucursal_nombre', entrega.pedido.sucursal.nombre),
        'codigo_pedido': entrega.origen.get('codigo_pedido', f'PED-{entrega.pedido_id:06d}'),
        'fecha_recepcion': entrega.fecha_recepcion, 'fecha_requerida': entrega.pedido.fecha_requerida,
        'productos': len(lineas), 'peso_aceptado_kg': str(sum((Decimal(f['peso_aceptado_kg']) for f in lineas), Decimal(0))),
        'total': str(total) if not incidencias else None, 'incidencias': sorted(set(incidencias))}
    if incluir_lineas:
        datos['lineas'] = lineas
    return datos


def revisar_venta(venta, entregas=None):
    entregas = list(entregas if entregas is not None else entregas_con_datos().filter(seleccionventa__venta=venta).order_by('fecha_recepcion', 'pk'))
    grupos = [calcular_entrega(entrega) for entrega in entregas]
    lineas = [fila for grupo in grupos for fila in grupo.pop('lineas')]
    incidencias = sorted({i for grupo in grupos for i in grupo['incidencias']})
    if not entregas:
        incidencias.append('sin_entregas')
    if len(lineas) > 500:
        incidencias.append('demasiadas_lineas')
    if any(e.pedido.sucursal.cliente_id != venta.cliente_id or not e.fecha_recepcion or not venta.desde <= e.fecha_recepcion <= venta.hasta for e in entregas):
        incidencias.append('fuera_periodo')
    if not venta.cliente.activo:
        incidencias.append('cliente_inactivo')
    total = sum((Decimal(f['importe']) for f in lineas if f['importe'] is not None), Decimal(0))
    if total > MAXIMO_IMPORTE:
        incidencias.append('importe_excesivo')
    if not incidencias and total <= 0:
        incidencias.append('total_cero')
    datos = {'entregas': grupos, 'lineas': lineas, 'incidencias': sorted(set(incidencias)),
        'total': str(total) if not incidencias else None,
        'peso_aceptado_kg': str(sum((Decimal(f['peso_aceptado_kg']) for f in lineas), Decimal(0)))}
    datos['revision'] = huella([version_venta(venta), venta.cliente.razon_social, venta.cliente.nit, datos])
    return datos
