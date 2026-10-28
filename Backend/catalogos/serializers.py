from django.core.exceptions import ValidationError as ErrorValidacion
from django.db.models.functions import Lower
from rest_framework import serializers
from .models import UnidadMedida, CategoriaProducto
from .servicios import version_catalogo
from .validadores import normalizar_nombre, normalizar_abreviatura


class CatalogoLecturaSerializer(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()

    def get_version(self, obj):
        return version_catalogo(obj)

    class Meta:
        fields = ('id', 'nombre', 'activo', 'creado_en', 'version')
        read_only_fields = fields


class UnidadMedidaSerializer(CatalogoLecturaSerializer):
    class Meta(CatalogoLecturaSerializer.Meta):
        model = UnidadMedida
        fields = CatalogoLecturaSerializer.Meta.fields + ('abreviatura',)
        read_only_fields = fields


class CategoriaProductoSerializer(CatalogoLecturaSerializer):
    class Meta(CatalogoLecturaSerializer.Meta):
        model = CategoriaProducto


class CatalogoEscrituraSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate_nombre(self, valor):
        try:
            nombre = normalizar_nombre(valor)
        except ErrorValidacion as error:
            raise serializers.ValidationError(error.messages) from error
        consulta = self.context['modelo'].objects.annotate(nombre_normalizado=Lower('nombre')).filter(nombre_normalizado=nombre.lower())
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Ya existe un registro con este nombre.')
        return nombre

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el formulario antes de guardar.'})
        return attrs


class UnidadMedidaEscrituraSerializer(CatalogoEscrituraSerializer):
    abreviatura = serializers.CharField(max_length=10)

    def validate_abreviatura(self, valor):
        try:
            abreviatura = normalizar_abreviatura(valor)
        except ErrorValidacion as error:
            raise serializers.ValidationError(error.messages) from error
        consulta = UnidadMedida.objects.filter(abreviatura=abreviatura)
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Ya existe una unidad con esta abreviatura.')
        return abreviatura


class EstadoCatalogoSerializer(serializers.Serializer):
    activo = serializers.BooleanField()
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')


class FiltrosCatalogoSerializer(serializers.Serializer):
    buscar = serializers.CharField(required=False, allow_blank=True, max_length=100)
    activo = serializers.BooleanField(required=False)
    orden = serializers.ChoiceField(choices=['nombre', '-nombre', 'creado_en', '-creado_en'], required=False, default='nombre')
