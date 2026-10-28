from decimal import Decimal
from collections.abc import Mapping
from rest_framework import serializers
from clientes.validadores import normalizar_texto
from .models import Almacen


class SerializadorEstricto(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            desconocidos = set(data) - set(self.fields)
            if desconocidos:
                raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        return super().to_internal_value(data)


class SerializadorAlmacen(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()

    def get_version(self, obj):
        from .servicios import version_almacen
        return version_almacen(obj)

    class Meta:
        model = Almacen
        fields = ('id', 'nombre', 'direccion', 'latitud', 'longitud', 'activo', 'creado_en', 'version')
        read_only_fields = fields


class SerializadorEscrituraAlmacen(SerializadorEstricto):
    nombre = serializers.CharField(max_length=150)
    direccion = serializers.CharField(max_length=255)
    latitud = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=Decimal('-90'), max_value=Decimal('90'), required=False, allow_null=True)
    longitud = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=Decimal('-180'), max_value=Decimal('180'), required=False, allow_null=True)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate_nombre(self, valor):
        return normalizar_texto(valor)

    def validate_direccion(self, valor):
        return normalizar_texto(valor)

    def validate(self, attrs):
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el almacén antes de guardar.'})
        latitud = attrs.get('latitud', self.instance.latitud if self.instance else None)
        longitud = attrs.get('longitud', self.instance.longitud if self.instance else None)
        if (latitud is None) != (longitud is None):
            raise serializers.ValidationError({campo: 'Completa latitud y longitud, o deja ambas vacías.' for campo in ('latitud', 'longitud')})
        for campo in ('latitud', 'longitud'):
            if attrs.get(campo) is not None and attrs[campo] == 0:
                attrs[campo] = Decimal('0.0000000')
        return attrs


class SerializadorEstadoAlmacen(SerializadorEstricto):
    activo = serializers.BooleanField()
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')


class SerializadorFiltrosAlmacenes(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    activo = serializers.BooleanField(required=False)
    orden = serializers.ChoiceField(choices=['nombre', '-nombre', 'creado_en', '-creado_en'], default='nombre')
