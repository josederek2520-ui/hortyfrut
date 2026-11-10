from decimal import Decimal
from rest_framework import serializers


class SerializadorEstricto(serializers.Serializer):
    def to_internal_value(self, datos):
        if isinstance(datos, dict):
            extras = set(datos) - set(self.fields)
            if extras:
                raise serializers.ValidationError({campo: 'Este campo no pertenece a esta operación.' for campo in extras})
        return super().to_internal_value(datos)


def identificador(**opciones):
    return serializers.IntegerField(min_value=1, max_value=999999999999999, **opciones)


class SerializadorLinea(SerializadorEstricto):
    producto = identificador()
    precio_kg = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'), allow_null=True)


class SerializadorAccion(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64, allow_blank=True)
    motivo = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class SerializadorAcuerdo(SerializadorAccion):
    cliente = identificador()
    alcance = serializers.ChoiceField(choices=['periodo', 'entregas'])
    desde = serializers.DateField(allow_null=True)
    hasta = serializers.DateField(allow_null=True)
    referencia_propuesta = serializers.CharField(max_length=150, allow_blank=True)
    lineas = SerializadorLinea(many=True, max_length=500)
    entregas = serializers.ListField(child=identificador(), max_length=500)


class SerializadorFiltros(serializers.Serializer):
    seleccion = serializers.CharField(max_length=8500, required=False, allow_blank=True)
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    estado = serializers.ChoiceField(choices=['borrador', 'propuesta', 'aceptado', 'rechazado', 'cancelado'], required=False)
    cliente = identificador(required=False)
    fecha = serializers.DateField(required=False)

    def validate_seleccion(self, valor):
        partes = valor.split(',') if valor else []
        if len(partes) > 500 or any(not p.isascii() or not p.isdigit() or not 1 <= len(p) <= 15 for p in partes):
            raise serializers.ValidationError('Selecciona hasta 500 identificadores válidos.')
        return [int(p) for p in partes]
