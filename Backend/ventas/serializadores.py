from rest_framework import serializers


class SerializadorEstricto(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise serializers.ValidationError({'non_field_errors': ['La solicitud contiene campos no admitidos.']})
        return super().to_internal_value(data)


class SerializadorVenta(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(allow_blank=True, max_length=64)
    cliente = serializers.IntegerField(min_value=1)
    desde = serializers.DateField()
    hasta = serializers.DateField()
    vencimiento = serializers.DateField(allow_null=True, required=False, default=None)
    entregas = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=100, allow_empty=True)

    def validate(self, datos):
        if datos['hasta'] < datos['desde']:
            raise serializers.ValidationError({'hasta': 'La fecha final no puede ser anterior a la inicial.'})
        if len(set(datos['entregas'])) != len(datos['entregas']):
            raise serializers.ValidationError({'entregas': 'No repitas entregas en la selección.'})
        return datos


class SerializadorAccion(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64)
    revision = serializers.CharField(max_length=64, allow_blank=True, required=False, default='')


class SerializadorFiltros(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    estado = serializers.ChoiceField(choices=['borrador', 'emitida', 'cancelada'], required=False)
    cliente = serializers.IntegerField(min_value=1, required=False)
    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)
    pagina = serializers.IntegerField(min_value=1, required=False)

    def validate(self, datos):
        if datos.get('desde') and datos.get('hasta') and datos['hasta'] < datos['desde']:
            raise serializers.ValidationError({'hasta': 'Revisa el período seleccionado.'})
        return datos
