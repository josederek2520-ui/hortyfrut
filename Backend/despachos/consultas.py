from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q
from preparaciones.models import AsignacionPreparacion
from .models import CargaDespacho, Despacho


def choferes_habilitados():
    return get_user_model().objects.filter(is_active=True).filter(Q(is_superuser=True) |
        Q(user_permissions__content_type__app_label='despachos', user_permissions__codename='conducir_despacho') |
        Q(groups__permissions__content_type__app_label='despachos', groups__permissions__codename='conducir_despacho')).distinct()


def asignaciones_disponibles(despacho_id=None):
    ocupadas = CargaDespacho.objects.filter(asignacion_id=OuterRef('pk'), activa=True)
    if despacho_id:
        ocupadas = ocupadas.exclude(despacho_id=despacho_id)
    return AsignacionPreparacion.objects.filter(preparacion__estado='confirmada', cantidad__gt=0,
        pedido__estado__in=['pendiente', 'preparado'], sucursal__activo=True, sucursal__cliente__activo=True).annotate(
        ocupada=Exists(ocupadas)).filter(ocupada=False).select_related('preparacion', 'pedido', 'sucursal__cliente').prefetch_related('aportes__linea__lote')


def contenido_asignacion(asignacion):
    aportes = [{'lote': aporte.linea.lote_id, 'codigo_lote': aporte.linea.lote.codigo,
                'cantidad': str(aporte.cantidad), 'unidad': aporte.linea.unidad_abreviatura, 'peso_kg': str(aporte.peso_kg)}
               for aporte in asignacion.aportes.all() if aporte.cantidad > 0]
    return {'preparacion': asignacion.preparacion_id, 'codigo_preparacion': asignacion.preparacion.codigo,
            'pedido': asignacion.pedido_id, 'codigo_pedido': asignacion.pedido.codigo,
            'sucursal': asignacion.sucursal_id, 'sucursal_nombre': asignacion.sucursal_nombre,
            'cliente_nombre': asignacion.preparacion.cliente_nombre, 'producto': asignacion.producto_id,
            'producto_nombre': asignacion.producto_nombre, 'presentacion_nombre': asignacion.presentacion_nombre,
            'columna': asignacion.columna, 'cantidad': asignacion.cantidad,
            'fecha_requerida': str(asignacion.preparacion.fecha_pedidos),
            'peso_kg': str(sum((aporte.peso_kg or Decimal('0') for aporte in asignacion.aportes.all() if aporte.cantidad > 0), Decimal('0'))),
            'aportes': aportes}


def despachos_con_relaciones():
    return Despacho.objects.select_related('vehiculo', 'almacen', 'chofer').prefetch_related('paradas__cargas', 'cargas', 'cajillas__parada')
