import hashlib
import json
from urllib.parse import urlencode
from django.db.models import BigIntegerField, OuterRef, Subquery, Sum, Value, F, Q
from django.db.models.functions import Coalesce, Greatest
from pedidos.models import DetallePedido
from .models import AsignacionPreparacion


def version_preparacion(preparacion):
    return hashlib.sha256(f'{preparacion.pk}:{preparacion.actualizado_en.isoformat()}'.encode()).hexdigest()


def detalles_con_avance(fecha=None, cliente=None):
    avance = AsignacionPreparacion.objects.filter(detalle_pedido_id=OuterRef('pk'), preparacion__estado='confirmada').values('detalle_pedido_id').annotate(
        total=Sum('cantidad', output_field=BigIntegerField())).values('total')
    consulta = DetallePedido.objects.annotate(preparada=Coalesce(Subquery(avance, output_field=BigIntegerField()), Value(0), output_field=BigIntegerField()))
    consulta = consulta.annotate(pendiente=Greatest(F('cantidad') - F('preparada'), Value(0), output_field=BigIntegerField()))
    if fecha:
        consulta = consulta.filter(pedido__fecha_requerida=fecha)
    if cliente:
        consulta = consulta.filter(pedido__sucursal__cliente_id=cliente)
    return consulta.exclude(pedido__estado='cancelado')


def avance_detalles(identificadores):
    return dict(AsignacionPreparacion.objects.filter(detalle_pedido_id__in=identificadores, preparacion__estado='confirmada').values('detalle_pedido_id').annotate(
        total=Sum('cantidad', output_field=BigIntegerField())).values_list('detalle_pedido_id', 'total'))


def ruta_imagen_preparacion(producto_id, archivo, cliente, fecha):
    if not archivo:
        return None
    contexto = urlencode({'cliente': cliente, 'fecha_pedidos': str(fecha)})
    return f'/api/v1/preparaciones/imagenes/{producto_id}/?{contexto}'


def resumen_productos(consulta):
    sumas = {}
    for columna, nombre in (('cajas', 'cajas'), ('unidades', 'unidades')):
        for campo, prefijo in (('cantidad', ''), ('preparada', 'preparadas_'), ('pendiente', 'pendientes_')):
            sumas[f'{prefijo}{nombre}'] = Coalesce(Sum(campo, filter=Q(columna=columna), output_field=BigIntegerField()), Value(0), output_field=BigIntegerField())
    return consulta.values('producto_id', 'producto__nombre', 'producto__categoria_id', 'producto__categoria__nombre', 'producto__imagen').annotate(**sumas).order_by('producto__nombre', 'producto_id')


def version_hoja(consulta, cliente):
    filas = list(consulta.order_by('pk').values_list('pk', 'cantidad', 'preparada', 'pedido__estado', 'pedido__actualizado_en',
        'pedido__sucursal__actualizado_en', 'producto__actualizado_en', 'producto__categoria__actualizado_en'))
    return hashlib.sha256(json.dumps([cliente.pk, cliente.actualizado_en.isoformat(), filas], default=str).encode()).hexdigest()


def datos_necesidad(linea):
    return {'id': linea.pk, 'pedido': linea.pedido_id, 'codigo': linea.pedido.codigo,
        'sucursal': linea.pedido.sucursal_id, 'sucursal_nombre': linea.pedido.sucursal_nombre,
        'producto': linea.producto_id, 'producto_nombre': linea.producto_nombre, 'presentacion_nombre': linea.presentacion_nombre,
        'columna': linea.columna, 'cantidad': linea.cantidad, 'preparada': linea.preparada, 'pendiente': linea.pendiente,
        'disponible': linea.pedido.estado == 'pendiente' and linea.pedido.sucursal.activo and linea.pedido.sucursal.cliente.activo and
            linea.producto.activo and linea.producto.categoria.activo and linea.pendiente > 0}
