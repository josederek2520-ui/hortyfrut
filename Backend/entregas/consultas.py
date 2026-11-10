import hashlib
import json
from decimal import Decimal, InvalidOperation
from django.db.models import Count, F, Max, OuterRef, Subquery, Value, Q
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from despachos.models import CargaDespacho
from .models import Entrega
from .permisos import alcance_cargas


def huella(valor):
    return hashlib.sha256(json.dumps(valor, sort_keys=True, default=str, separators=(',', ':')).encode()).hexdigest()


def cargas_origen(actor, despacho=None, pedido=None):
    consulta = alcance_cargas(CargaDespacho.objects.filter(despacho__estado__in=['en_ruta', 'finalizado']), actor)
    if despacho is not None:
        consulta = consulta.filter(despacho_id=despacho)
    if pedido is not None:
        consulta = consulta.filter(asignacion__pedido_id=pedido)
    return consulta


def pendientes(actor):
    entrega = Entrega.objects.filter(despacho_id=OuterRef('despacho_id'), pedido_id=OuterRef('asignacion__pedido_id'))
    return cargas_origen(actor).values('despacho_id', 'asignacion__pedido_id', 'parada_id',
        'parada__cliente_nombre', 'parada__sucursal_nombre', 'despacho__fecha_reparto').annotate(
        filas=Count('pk'), descargadas=Count('pk', filter=Q(descargada_en__isnull=False)), descargada_en=Max('descargada_en'),
        entrega_id=Subquery(entrega.values('id')[:1]),
        estado=Coalesce(Subquery(entrega.values('estado')[:1]), Value('pendiente'))).filter(filas=F('descargadas')).order_by('-descargada_en', '-despacho_id', '-asignacion__pedido_id')


def origen_entrega(actor, despacho, pedido, bloquear=False):
    consulta = cargas_origen(actor, despacho, pedido).select_related('parada__sucursal', 'asignacion__pedido')
    if bloquear:
        consulta = consulta.select_for_update(of=('self',))
    cargas = list(consulta.order_by('pk'))
    if not cargas:
        get_object_or_404(consulta)
    if any(carga.descargada_en is None for carga in cargas):
        raise ValidationError({'descarga': 'El chofer debe confirmar la descarga completa de este pedido en el viaje.'})
    productos = {}
    for carga in cargas:
        contenido = carga.contenido
        producto = productos.setdefault(contenido['producto'], {'producto': contenido['producto'], 'nombre': contenido['producto_nombre'],
            'cajas': 0, 'unidades': 0, 'peso_kg': Decimal(0), 'peso_completo': True, 'aportes': []})
        producto[contenido['columna']] += contenido['cantidad']
        for aporte in contenido.get('aportes', []):
            try:
                peso = Decimal(aporte['peso_kg'])
                if not peso.is_finite() or peso <= 0:
                    raise InvalidOperation
            except (InvalidOperation, TypeError, KeyError):
                producto['peso_completo'] = False
                peso = None
            if peso is not None:
                producto['peso_kg'] += peso
            producto['aportes'].append({'carga': carga.pk, 'lote': aporte['lote'], 'codigo_lote': aporte['codigo_lote'],
                'preparacion': contenido['codigo_preparacion'], 'cantidad': aporte['cantidad'], 'unidad': aporte['unidad'],
                'peso_kg': str(peso) if peso is not None else None})
        if not contenido.get('aportes'):
            producto['peso_completo'] = False
    for producto in productos.values():
        producto['peso_kg'] = str(producto['peso_kg']) if producto.pop('peso_completo') else None
    parada = cargas[0].parada
    return {'despacho': despacho, 'pedido': pedido, 'codigo_despacho': f'DES-{despacho:06d}', 'codigo_pedido': f'PED-{pedido:06d}',
        'parada': parada.pk, 'sucursal': parada.sucursal_id, 'cliente_nombre': parada.cliente_nombre,
        'sucursal_nombre': parada.sucursal_nombre, 'descargada_en': max(c.descargada_en for c in cargas).isoformat(),
        'cargas': [{'id': c.pk, 'contenido': c.contenido, 'descargada_en': c.descargada_en.isoformat()} for c in cargas],
        'productos': sorted(productos.values(), key=lambda p: (p['nombre'], p['producto']))}, parada.sucursal


def version_entrega(entrega, origen):
    version = [origen, entrega.pk, entrega.actualizado_en.isoformat()] if entrega else [origen]
    if entrega is None or (entrega.estado == 'borrador' and not entrega.recibido_por):
        from clientes.models import Sucursal
        from .receptores import encargado_pedidos_recepcion, representar_receptor
        sucursal = Sucursal.objects.get(pk=origen['sucursal'])
        version.append(representar_receptor(encargado_pedidos_recepcion(sucursal)))
    return huella(version)
