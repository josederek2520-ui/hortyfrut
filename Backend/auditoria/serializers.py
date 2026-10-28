from datetime import date
from rest_framework import serializers
from .models import RegistroActividad


class RegistroActividadListaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroActividad
        fields = ('id', 'fecha', 'actor', 'responsable', 'modulo', 'accion', 'descripcion', 'objeto_tipo', 'objeto_id', 'objeto_nombre', 'resultado', 'origen')
        read_only_fields = fields


class RegistroActividadDetalleSerializer(RegistroActividadListaSerializer):
    class Meta(RegistroActividadListaSerializer.Meta):
        fields = RegistroActividadListaSerializer.Meta.fields + ('cambios', 'solicitud_id', 'metodo', 'ruta', 'codigo_http')
        read_only_fields = fields


class FiltrosActividadSerializer(serializers.Serializer):
    corte = serializers.IntegerField(required=False, min_value=0)
    buscar = serializers.CharField(required=False, allow_blank=True, max_length=150)
    modulo = serializers.SlugField(required=False, allow_blank=True, max_length=64)
    accion = serializers.SlugField(required=False, allow_blank=True, max_length=64)
    resultado = serializers.ChoiceField(choices=['', 'exito', 'rechazado', 'error'], required=False)
    responsable = serializers.CharField(required=False, allow_blank=True, max_length=150)
    actor = serializers.IntegerField(required=False, min_value=1)
    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)

    def validate_hasta(self, valor):
        if valor == date.max:
            raise serializers.ValidationError('Selecciona una fecha anterior al 31/12/9999.')
        return valor

    def validate(self, attrs):
        if attrs.get('desde') and attrs.get('hasta') and attrs['desde'] > attrs['hasta']:
            raise serializers.ValidationError({'hasta': 'La fecha final debe ser igual o posterior a la inicial.'})
        return attrs
