from decimal import Decimal
from rest_framework import serializers
from .modelos_seguimiento import PosicionSeguimiento


class SerializadorInicioSeguimiento(serializers.Serializer):
    clave_operacion = serializers.UUIDField()
    version = serializers.RegexField(r'^[0-9a-f]{64}$')


class SerializadorCierreSeguimiento(serializers.Serializer):
    sesion = serializers.UUIDField()
    motivo = serializers.ChoiceField(choices=['chofer', 'segundo_plano', 'permiso', 'cuenta', 'sin_conexion', 'error_gps'])


class SerializadorPosicion(serializers.Serializer):
    id = serializers.UUIDField()
    latitud = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90)
    longitud = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180)
    precision_m = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=0, max_value=100)
    velocidad_m_s = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=0, max_value=100, allow_null=True, required=False)
    rumbo = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=Decimal('359.99'), allow_null=True, required=False)
    capturada_en = serializers.DateTimeField()


class SerializadorLotePosiciones(serializers.Serializer):
    sesion = serializers.UUIDField()
    clave_operacion = serializers.UUIDField()
    posiciones = SerializadorPosicion(many=True, allow_empty=False, max_length=30)


class SerializadorPosicionGuardada(serializers.ModelSerializer):
    class Meta:
        model = PosicionSeguimiento
        fields = ['id', 'latitud', 'longitud', 'precision_m', 'velocidad_m_s', 'rumbo', 'capturada_en', 'recibida_en']
