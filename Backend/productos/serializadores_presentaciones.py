from django.db.models.functions import Lower
from rest_framework import serializers
from catalogos.validadores import normalizar_nombre
from django.core.exceptions import ValidationError as ErrorValidacion
from .models import PresentacionProducto
from .servicios_presentaciones import obtener_version_presentacion


class SerializadorPresentacion(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()

    def get_version(self, obj):
        return obtener_version_presentacion(obj)

    class Meta:
        model = PresentacionProducto
        fields = ('id', 'producto', 'nombre', 'uso', 'columna_pedido', 'activo', 'creado_en', 'version')
        read_only_fields = fields


class SerializadorEscrituraPresentacion(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    uso = serializers.ChoiceField(choices=PresentacionProducto.Uso.choices, default=PresentacionProducto.Uso.AMBOS)
    columna_pedido = serializers.ChoiceField(choices=PresentacionProducto.ColumnaPedido.choices, required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate_nombre(self, valor):
        try:
            nombre = normalizar_nombre(valor)
        except ErrorValidacion as error:
            raise serializers.ValidationError(error.messages) from error
        consulta = PresentacionProducto.objects.filter(producto_id=self.context['producto_id']).annotate(nombre_normalizado=Lower('nombre')).filter(nombre_normalizado=nombre.lower())
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Este producto ya tiene una presentación con ese nombre, incluso si está inactiva.')
        return nombre

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Recarga la presentación antes de guardar.'})
        return attrs


class SerializadorFiltrosPresentacion(serializers.Serializer):
    buscar = serializers.CharField(required=False, allow_blank=True, max_length=100)
    activo = serializers.BooleanField(required=False)
    uso = serializers.ChoiceField(choices=['compra', 'pedido', 'ambos'], required=False)
    orden = serializers.ChoiceField(choices=['nombre', '-nombre', 'creado_en', '-creado_en'], default='nombre')
