from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from pedidos.models import Pedido, DetallePedido
from productos.models import Producto
from .consultas import huella


class ConsultaPedidosPrecio(serializers.Serializer):
    cliente = serializers.IntegerField(min_value=1)
    desde = serializers.DateField()
    hasta = serializers.DateField()
    buscar = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate(self, datos):
        if datos['desde'] > datos['hasta']:
            raise serializers.ValidationError({'hasta': 'La fecha final no puede ser anterior a la inicial.'})
        return datos


def productos_pedidos(cliente, desde, hasta):
    detalles = DetallePedido.objects.filter(pedido__sucursal__cliente=cliente,
        pedido__fecha_requerida__gte=desde, pedido__fecha_requerida__lte=hasta).exclude(pedido__estado=Pedido.Estado.CANCELADO)
    return Producto.objects.filter(pk__in=detalles.values('producto_id'), activo=True, categoria__activo=True).select_related('categoria').order_by('nombre', 'pk')


def version_productos(consulta, cliente, desde, hasta):
    return huella([cliente.pk, str(desde), str(hasta), list(consulta.values_list('pk', 'actualizado_en', 'nombre', 'categoria_id'))])


def validar_productos_supermercado(cliente, datos):
    if datos['alcance'] != 'periodo' or datos['entregas']:
        raise ValidationError({'alcance': 'El supermercado propone precios por fecha requerida de sus pedidos.'})
    if not datos['desde'] or not datos['hasta']:
        if datos['lineas']:
            raise ValidationError({'desde': 'Elige el período de los pedidos antes de escribir precios.'})
        return
    permitidos = set(productos_pedidos(cliente, datos['desde'], datos['hasta']).values_list('pk', flat=True))
    if any(fila['producto'] not in permitidos for fila in datos['lineas']):
        raise ValidationError({'lineas': 'Solo puedes proponer precios de productos solicitados por tus sucursales en ese período.'})
