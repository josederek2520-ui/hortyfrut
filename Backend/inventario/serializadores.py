from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from compras.serializadores import SerializadorEstricto
from .models import Lote, MovimientoInventario, DetalleMovimientoInventario
from .servicios import version_lote


class SerializadorAltaUnidad(SerializadorEstricto):
    unidad = serializers.IntegerField(min_value=1)


class SerializadorEstadoUnidad(SerializadorEstricto):
    activo = serializers.BooleanField()
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')


class SerializadorEstadoLote(SerializadorEstricto):
    estado = serializers.ChoiceField(choices=Lote.Estado.choices)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')


class SerializadorLote(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    saldo = serializers.DecimalField(max_digits=24, decimal_places=3, read_only=True)
    vencido = serializers.SerializerMethodField()
    disponible = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()
    recepcion = serializers.SerializerMethodField()
    preparacion = serializers.SerializerMethodField()

    def get_preparacion(self, obj):
        try:
            origen = obj.separacion_preparacion.preparacion
            return {'id': origen.pk, 'codigo': origen.codigo}
        except ObjectDoesNotExist:
            return None

    def get_version(self, obj):
        return version_lote(obj)

    def get_vencido(self, obj):
        return bool(obj.fecha_vencimiento and obj.fecha_vencimiento < timezone.localdate())

    def get_disponible(self, obj):
        return obj.calidad == 'apto' and obj.estado == 'disponible' and not self.get_vencido(obj) and obj.saldo > 0 and obj.producto.activo and obj.producto.categoria.activo and obj.unidad.activo and obj.almacen_origen.activo

    def get_recepcion(self, obj):
        try:
            return {'id': obj.detalle_recepcion.recepcion_id, 'codigo': obj.detalle_recepcion.recepcion.codigo}
        except obj.__class__.detalle_recepcion.RelatedObjectDoesNotExist:
            return None

    class Meta:
        model = Lote
        fields = ('id', 'codigo', 'producto', 'producto_nombre', 'unidad', 'unidad_nombre', 'unidad_abreviatura', 'calidad', 'lote_origen',
                  'almacen_origen', 'almacen_nombre', 'fecha_ingreso', 'fecha_vencimiento', 'peso_kg_ingreso', 'estado',
                  'saldo', 'vencido', 'disponible', 'version', 'recepcion', 'preparacion', 'creado_en')
        read_only_fields = fields


class SerializadorLineaMovimiento(serializers.ModelSerializer):
    lote_codigo = serializers.CharField(source='lote.codigo', read_only=True)
    producto_nombre = serializers.CharField(source='lote.producto_nombre', read_only=True)
    unidad_nombre = serializers.CharField(source='lote.unidad_nombre', read_only=True)
    unidad_abreviatura = serializers.CharField(source='lote.unidad_abreviatura', read_only=True)

    class Meta:
        model = DetalleMovimientoInventario
        fields = ('id', 'lote', 'lote_codigo', 'producto', 'producto_nombre', 'unidad', 'unidad_nombre', 'unidad_abreviatura', 'cantidad')
        read_only_fields = fields


class SerializadorMovimiento(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    cantidad_lotes = serializers.IntegerField(read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = ('id', 'codigo', 'almacen', 'almacen_nombre', 'tipo', 'naturaleza', 'estado', 'fecha', 'referencia_tipo',
                  'referencia_id', 'referencia_codigo', 'responsable_nombre', 'cantidad_lotes', 'creado_en')
        read_only_fields = fields


class SerializadorMovimientoCompleto(SerializadorMovimiento):
    detalles = SerializadorLineaMovimiento(many=True, read_only=True)

    class Meta(SerializadorMovimiento.Meta):
        fields = (*SerializadorMovimiento.Meta.fields, 'detalles')
        read_only_fields = fields


class SerializadorFiltrosInventario(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    almacen = serializers.IntegerField(min_value=1, required=False)
    producto = serializers.IntegerField(min_value=1, required=False)
    fecha = serializers.DateField(required=False)
    estado = serializers.ChoiceField(choices=['disponible', 'bloqueado', 'vencido'], required=False)
