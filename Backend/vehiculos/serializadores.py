from decimal import Decimal
from rest_framework import serializers
from compras.serializadores import SerializadorEstricto
from clientes.validadores import normalizar_texto
from .models import Vehiculo


class SerializadorVehiculo(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()
    imagen = serializers.SerializerMethodField()

    def get_version(self, obj):
        from .servicios import version_vehiculo
        return version_vehiculo(obj)

    def get_imagen(self, obj):
        return f'/api/v1/vehiculos/{obj.pk}/imagen/?v={obj.actualizado_en.timestamp()}' if obj.imagen else None

    class Meta:
        model = Vehiculo
        fields = ('id', 'placa', 'tipo', 'marca', 'capacidad_kg', 'imagen', 'activo', 'responsable_nombre', 'creado_en', 'version')
        read_only_fields = fields


class SerializadorEscrituraVehiculo(SerializadorEstricto):
    placa = serializers.RegexField(r'\A[A-Za-z0-9 -]+\Z', max_length=20)
    tipo = serializers.CharField(max_length=60)
    marca = serializers.CharField(max_length=100, allow_blank=True, required=False)
    capacidad_kg = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0.001'), allow_null=True, required=False)
    imagen = serializers.FileField(required=False)
    quitar_imagen = serializers.BooleanField(default=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate_placa(self, valor):
        return normalizar_texto(valor).upper()

    def validate_tipo(self, valor):
        return normalizar_texto(valor)

    def validate_marca(self, valor):
        return normalizar_texto(valor)

    def validate(self, datos):
        if self.instance and not datos.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el vehículo antes de guardar.'})
        if datos.get('imagen') and datos.get('quitar_imagen'):
            raise serializers.ValidationError({'imagen': 'Selecciona una imagen o quita la actual.'})
        return datos


class SerializadorEstadoVehiculo(SerializadorEstricto):
    activo = serializers.BooleanField()
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
