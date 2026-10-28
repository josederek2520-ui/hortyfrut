from django.db.models import Count, Q, Sum
from pedidos.models import DetallePedido, Pedido


def necesidades_fecha(fecha):
    return DetallePedido.objects.filter(pedido__fecha_requerida=fecha, pedido__estado=Pedido.Estado.PENDIENTE,
                                       pedido__sucursal__activo=True, pedido__sucursal__cliente__activo=True)


def resumen_productos(consulta):
    return consulta.values('producto_id', 'producto__nombre', 'producto__activo', 'producto__categoria__activo',
                           'producto__unidad_medida__activo', 'producto__unidad_medida__nombre').annotate(
        cajas=Sum('cantidad', filter=Q(columna='cajas'), default=0),
        unidades=Sum('cantidad', filter=Q(columna='unidades'), default=0),
        pedidos=Count('pedido_id', distinct=True),
    ).order_by('producto__nombre', 'producto_id')


def datos_necesidad(linea):
    return {'id': linea.pk, 'pedido': linea.pedido_id, 'codigo': linea.pedido.codigo,
            'cliente': linea.pedido.cliente_nombre, 'sucursal': linea.pedido.sucursal_nombre,
            'producto': linea.producto_id, 'producto_nombre': linea.producto_nombre,
            'presentacion_nombre': linea.presentacion_nombre, 'columna': linea.columna, 'cantidad': linea.cantidad}
