from decimal import Decimal
from rest_framework import serializers


def medicion(**opciones):
    return serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal(0), allow_null=True, **opciones)


class SerializadorEstricto(serializers.Serializer):
    def to_internal_value(self, datos):
        if isinstance(datos, dict):
            desconocidos = set(datos) - set(self.fields)
            if desconocidos:
                raise serializers.ValidationError({campo: 'Este campo no pertenece a esta operación.' for campo in desconocidos})
        return super().to_internal_value(datos)


class SerializadorLineaRecepcion(SerializadorEstricto):
    aporte = serializers.IntegerField(min_value=1, max_value=999999999999999)
    cantidad_recibida = medicion()
    peso_kg_recibido = medicion(required=False, default=None)


class SerializadorRecepcion(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64, allow_blank=True)
    entrega = serializers.IntegerField(min_value=1, max_value=999999999999999)
    almacen = serializers.IntegerField(min_value=1, max_value=999999999999999)
    fecha_recepcion = serializers.DateField(allow_null=True)
    motivo = serializers.CharField(max_length=500, allow_blank=True)
    lineas = SerializadorLineaRecepcion(many=True, max_length=500)


class SerializadorLineaRevision(SerializadorEstricto):
    aporte = serializers.IntegerField(min_value=1, max_value=999999999999999)
    cantidad_aprovechable = medicion()
    cantidad_merma = medicion()
    peso_kg_aprovechable = medicion(required=False, default=None)
    peso_kg_merma = medicion(required=False, default=None)


class SerializadorRevision(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64)
    motivo_revision = serializers.CharField(max_length=500, allow_blank=True)
    lineas = SerializadorLineaRevision(many=True, max_length=500)


class SerializadorAccion(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64)


class SerializadorFiltros(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, required=False, allow_blank=True)
    estado = serializers.ChoiceField(choices=['borrador', 'recibida', 'revisada', 'cancelada'], required=False)
    entrega = serializers.IntegerField(min_value=1, max_value=999999999999999, required=False)
    fecha = serializers.DateField(required=False)


class SerializadorOrigen(SerializadorFiltros):
    entrega = serializers.IntegerField(min_value=1, max_value=999999999999999)
    solo_anotados = serializers.BooleanField(required=False, default=False)
    aportes = serializers.CharField(required=False, allow_blank=True, max_length=8500)

    def validate_aportes(self, valor):
        partes = valor.split(',') if valor else []
        if len(partes) > 500 or any(not parte.isascii() or not parte.isdigit() or not 1 <= len(parte) <= 15 for parte in partes):
            raise serializers.ValidationError('Selecciona como máximo 500 aportes válidos.')
        return [int(parte) for parte in partes]
