from decimal import Decimal
from rest_framework import serializers
from compras.serializadores import SerializadorEstricto
from .models import Recepcion, DetalleRecepcion


class SerializadorLineaEscritura(SerializadorEstricto):
    id = serializers.IntegerField(min_value=1, required=False)
    detalle_compra = serializers.IntegerField(min_value=1, allow_null=True, required=False, default=None)
    producto = serializers.IntegerField(min_value=1)
    unidad_inventario = serializers.IntegerField(min_value=1)
    cantidad_compra = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    cantidad_inventario = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    peso_kg = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0.001'), allow_null=True, required=False, default=None)
    fecha_vencimiento = serializers.DateField(allow_null=True, required=False, default=None)


class SerializadorEscrituraRecepcion(SerializadorEstricto):
    compra = serializers.IntegerField(min_value=1, allow_null=True, required=False, default=None)
    almacen = serializers.IntegerField(min_value=1)
    fecha_recepcion = serializers.DateField()
    observaciones = serializers.CharField(max_length=1000, allow_blank=True, required=False, default='')
    detalles = SerializadorLineaEscritura(many=True, max_length=500)
    clave_operacion = serializers.UUIDField(required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate(self, attrs):
        requerido = 'version' if self.instance else 'clave_operacion'
        if requerido not in attrs:
            raise serializers.ValidationError({requerido: 'Recarga el formulario antes de guardar.'})
        if self.instance:
            if 'clave_operacion' in attrs:
                raise serializers.ValidationError({'clave_operacion': 'La clave de creación no se puede modificar.'})
            if attrs['compra'] != self.instance.compra_id:
                raise serializers.ValidationError({'compra': 'El origen de una recepción guardada no se puede cambiar. Crea otra recepción.'})
        elif any('id' in linea for linea in attrs['detalles']):
            raise serializers.ValidationError({'detalles': 'Una recepción nueva no admite detalles anteriores.'})
        return attrs


class SerializadorDetalleRecepcion(serializers.ModelSerializer):
    lote_codigo = serializers.SerializerMethodField()
    es_kg = serializers.SerializerMethodField()
    proveedor_nombre = serializers.SerializerMethodField()
    unidad_compra = serializers.SerializerMethodField()
    cantidad_pendiente = serializers.SerializerMethodField()

    def get_proveedor_nombre(self, obj):
        return obj.detalle_compra.proveedor_nombre if obj.detalle_compra_id else ''

    def get_unidad_compra(self, obj):
        fuente = obj.detalle_compra
        return fuente.unidad_medida_id if fuente and fuente.presentacion_id is None else None

    def get_cantidad_pendiente(self, obj):
        if not obj.detalle_compra_id:
            return None
        recibido = self.context.get('avance_compra', {}).get(obj.detalle_compra_id, Decimal('0'))
        return str(max(Decimal('0'), obj.detalle_compra.cantidad - recibido))

    def get_lote_codigo(self, obj):
        return obj.lote.codigo if obj.lote_id else None

    def get_es_kg(self, obj):
        return obj.unidad_abreviatura.strip().casefold() == 'kg'

    class Meta:
        model = DetalleRecepcion
        fields = ('id', 'detalle_compra', 'producto', 'producto_nombre', 'unidad_inventario', 'unidad_nombre', 'unidad_abreviatura',
                  'medida_compra_nombre', 'cantidad_compra', 'cantidad_inventario', 'peso_kg', 'fecha_vencimiento', 'lote', 'lote_codigo', 'es_kg',
                  'proveedor_nombre', 'unidad_compra', 'cantidad_pendiente')
        read_only_fields = fields


class SerializadorRecepcion(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    compra_codigo = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()
    cantidad_productos = serializers.SerializerMethodField()

    def get_compra_codigo(self, obj):
        return obj.compra.codigo if obj.compra_id else None

    def get_version(self, obj):
        from .servicios import version_recepcion
        return version_recepcion(obj)

    def get_cantidad_productos(self, obj):
        return obj.detalles.count()

    class Meta:
        model = Recepcion
        fields = ('id', 'codigo', 'compra', 'compra_codigo', 'almacen', 'almacen_nombre', 'fecha_recepcion', 'estado',
                  'responsable_nombre', 'creado_en', 'version', 'cantidad_productos')
        read_only_fields = fields


class SerializadorRecepcionCompleta(SerializadorRecepcion):
    detalles = SerializadorDetalleRecepcion(many=True, read_only=True)
    movimiento_codigo = serializers.SerializerMethodField()
    compra_fecha = serializers.DateField(source='compra.fecha_compra', read_only=True, default=None)

    def to_representation(self, instance):
        from .consultas import avance_compra
        self.context['avance_compra'] = avance_compra(instance.compra_id) if instance.compra_id else {}
        return super().to_representation(instance)

    def get_movimiento_codigo(self, obj):
        return obj.movimiento.codigo if obj.movimiento_id else None

    class Meta(SerializadorRecepcion.Meta):
        fields = (*SerializadorRecepcion.Meta.fields, 'observaciones', 'detalles', 'confirmado_en', 'cancelado_en', 'motivo_cancelacion', 'movimiento', 'movimiento_codigo', 'compra_fecha')
        read_only_fields = fields


class SerializadorFiltrosRecepciones(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    estado = serializers.ChoiceField(choices=Recepcion.Estado.choices, required=False)
    compra = serializers.IntegerField(min_value=1, required=False)
    almacen = serializers.IntegerField(min_value=1, required=False)
    fecha = serializers.DateField(required=False)


class SerializadorOpcionesRecepciones(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    compra = serializers.IntegerField(min_value=1, required=False)
    producto = serializers.IntegerField(min_value=1, required=False)
    solo_pendientes = serializers.BooleanField(default=False)
