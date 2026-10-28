from decimal import Decimal
from collections.abc import Mapping
from rest_framework import serializers
from .models import Compra, DetalleCompra, ReferenciaPedidoCompra


class SerializadorEstricto(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            desconocidos = set(data) - set(self.fields)
            if desconocidos:
                raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        return super().to_internal_value(data)


class SerializadorDetalleEscritura(SerializadorEstricto):
    id = serializers.IntegerField(min_value=1, required=False)
    producto = serializers.IntegerField(min_value=1)
    presentacion = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    proveedor = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'), default=Decimal('0'))


class SerializadorEscrituraCompra(SerializadorEstricto):
    fecha_pedidos = serializers.DateField()
    fecha_compra = serializers.DateField()
    observaciones = serializers.CharField(max_length=1000, allow_blank=True, required=False, default='')
    detalles = SerializadorDetalleEscritura(many=True, max_length=500)
    clave_operacion = serializers.UUIDField(required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        requerido = 'version' if self.instance else 'clave_operacion'
        if requerido not in attrs:
            raise serializers.ValidationError({requerido: 'Recarga el formulario antes de guardar.'})
        if self.instance and 'clave_operacion' in attrs:
            raise serializers.ValidationError({'clave_operacion': 'La clave de creación no se puede modificar.'})
        if not self.instance and any('id' in linea for linea in attrs['detalles']):
            raise serializers.ValidationError({'detalles': 'Una compra nueva no admite identificadores de detalles anteriores.'})
        return attrs


class SerializadorAccionCompra(SerializadorEstricto):
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
    clave_operacion = serializers.UUIDField()


class SerializadorCancelacionCompra(SerializadorAccionCompra):
    motivo = serializers.CharField(max_length=500)


class SerializadorDetalleCompra(serializers.ModelSerializer):
    cantidad_recibida = serializers.SerializerMethodField()
    cantidad_pendiente = serializers.SerializerMethodField()

    def get_cantidad_recibida(self, obj):
        return str(self.context.get('avance_recepcion', {}).get(obj.pk, Decimal('0')))

    def get_cantidad_pendiente(self, obj):
        return str(max(Decimal('0'), obj.cantidad - self.context.get('avance_recepcion', {}).get(obj.pk, Decimal('0'))))

    class Meta:
        model = DetalleCompra
        fields = ('id', 'producto', 'presentacion', 'proveedor', 'producto_nombre', 'presentacion_nombre', 'unidad_nombre',
                  'proveedor_nombre', 'cantidad', 'precio_unitario', 'subtotal', 'cantidad_recibida', 'cantidad_pendiente')
        read_only_fields = fields


class SerializadorReferenciaCompra(serializers.ModelSerializer):
    class Meta:
        model = ReferenciaPedidoCompra
        fields = ('pedido', 'codigo', 'cliente_nombre', 'sucursal_nombre', 'detalles')
        read_only_fields = fields


class SerializadorCompra(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    version = serializers.SerializerMethodField()
    cantidad_productos = serializers.SerializerMethodField()

    def get_version(self, obj):
        from .servicios import version_compra
        return version_compra(obj)

    def get_cantidad_productos(self, obj):
        return obj.detalles.count()

    class Meta:
        model = Compra
        fields = ('id', 'codigo', 'fecha_pedidos', 'fecha_compra', 'responsable_nombre', 'estado', 'total', 'creado_en', 'version', 'cantidad_productos')
        read_only_fields = fields


class SerializadorCompraCompleta(SerializadorCompra):
    tiene_recepciones_activas = serializers.SerializerMethodField()
    detalles = SerializadorDetalleCompra(many=True, read_only=True)
    pedidos_referencia = SerializadorReferenciaCompra(many=True, read_only=True)

    def get_tiene_recepciones_activas(self, obj):
        return obj.recepciones.exclude(estado='cancelada').exists()

    def to_representation(self, instance):
        from recepciones.consultas import avance_compra
        self.context['avance_recepcion'] = avance_compra(instance.pk)
        return super().to_representation(instance)

    class Meta(SerializadorCompra.Meta):
        fields = (*SerializadorCompra.Meta.fields, 'observaciones', 'detalles', 'pedidos_referencia', 'registrado_en', 'cancelado_en', 'motivo_cancelacion', 'tiene_recepciones_activas')
        read_only_fields = fields


class SerializadorFiltrosCompras(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    estado = serializers.ChoiceField(choices=Compra.Estado.choices, required=False)
    fecha_pedidos = serializers.DateField(required=False)
    fecha_compra = serializers.DateField(required=False)


class SerializadorNecesidades(serializers.Serializer):
    fecha_pedidos = serializers.DateField()
    vista = serializers.ChoiceField(choices=['resumen', 'sucursales'], default='resumen')
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)


class SerializadorOpcionesCompras(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    producto = serializers.IntegerField(min_value=1, required=False)
    categoria = serializers.IntegerField(min_value=1, required=False)
    todos = serializers.BooleanField(default=False)
