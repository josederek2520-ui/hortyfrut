from rest_framework import serializers
from cobros.serializadores import FiltrosCobro
from ventas.serializadores import SerializadorEstricto


class FiltrosPagos(FiltrosCobro):
    estado = serializers.ChoiceField(choices=['por_verificar', 'confirmado', 'observado'], required=False)


class DecisionPago(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.UUIDField()
    revision = serializers.CharField(max_length=64, allow_blank=True, default='')
    motivo = serializers.CharField(max_length=1000, allow_blank=True, default='')
