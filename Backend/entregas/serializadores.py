from decimal import Decimal
from rest_framework import serializers


def peso(**opciones):
    return serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal(0), **opciones)


class SerializadorLinea(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1)
    cajas_recibidas = serializers.IntegerField(min_value=0, max_value=999999, allow_null=True)
    unidades_recibidas = serializers.IntegerField(min_value=0, max_value=999999, allow_null=True)
    peso_recibido_kg = peso(allow_null=True)
    cajas_rechazadas = serializers.IntegerField(min_value=0, max_value=999999, default=0)
    unidades_rechazadas = serializers.IntegerField(min_value=0, max_value=999999, default=0)
    peso_rechazado_kg = peso(default=Decimal(0))
    motivo_rechazo = serializers.CharField(max_length=500, allow_blank=True, default='')


class SerializadorAporte(serializers.Serializer):
    carga = serializers.IntegerField(min_value=1)
    lote = serializers.IntegerField(min_value=1)
    peso_recibido_kg = peso()
    peso_rechazado_kg = peso(default=Decimal(0))


class SerializadorHoja(serializers.Serializer):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64)
    fecha_recepcion = serializers.DateField(allow_null=True)
    recibido_por = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')
    lineas = SerializadorLinea(many=True, max_length=500)
    aportes = SerializadorAporte(many=True, max_length=2000, default=list)


class SerializadorAccion(serializers.Serializer):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64)


class SerializadorFiltros(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, required=False, allow_blank=True)
    estado = serializers.ChoiceField(choices=['pendiente', 'borrador', 'revision', 'confirmada'], required=False)
    pedido = serializers.IntegerField(min_value=1, required=False)
    fecha = serializers.DateField(required=False)
