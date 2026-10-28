from django.core.exceptions import ValidationError as ErrorValidacion
from django.db.models.functions import Lower
from rest_framework import serializers
from catalogos.validadores import normalizar_nombre
from catalogos.serializers import CategoriaProductoSerializer, UnidadMedidaSerializer
from .models import Producto
from .servicios import version_producto


class ProductoSerializer(serializers.ModelSerializer):
    categoria = CategoriaProductoSerializer(read_only=True)
    unidad_medida = UnidadMedidaSerializer(read_only=True)
    version = serializers.SerializerMethodField()
    imagen = serializers.SerializerMethodField()

    def get_imagen(self, obj):
        return f'/api/v1/productos/{obj.pk}/imagen/?v={version_producto(obj)}' if obj.imagen else None

    def get_version(self, obj):
        return version_producto(obj)

    class Meta:
        model = Producto
        fields = ('id', 'nombre', 'categoria', 'unidad_medida', 'imagen', 'activo', 'creado_en', 'version')
        read_only_fields = fields


class ProductoEscrituraSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    categoria = serializers.IntegerField(min_value=1)
    unidad_medida = serializers.IntegerField(min_value=1)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)
    imagen = serializers.FileField(required=False)
    quitar_imagen = serializers.BooleanField(required=False)

    def validate_nombre(self, valor):
        try:
            nombre = normalizar_nombre(valor)
        except ErrorValidacion as error:
            raise serializers.ValidationError(error.messages) from error
        consulta = Producto.objects.annotate(nombre_normalizado=Lower('nombre')).filter(nombre_normalizado=nombre.lower())
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Ya existe un producto con este nombre.')
        return nombre

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el formulario antes de guardar.'})
        if attrs.get('imagen') and attrs.get('quitar_imagen'):
            raise serializers.ValidationError({'imagen': 'Selecciona una imagen o quítala; realiza una sola acción.'})
        return attrs


class FiltrosProductoSerializer(serializers.Serializer):
    buscar = serializers.CharField(required=False, allow_blank=True, max_length=100)
    activo = serializers.BooleanField(required=False)
    categoria = serializers.IntegerField(min_value=1, required=False)
    unidad_medida = serializers.IntegerField(min_value=1, required=False)
    orden = serializers.ChoiceField(choices=['nombre', '-nombre', 'creado_en', '-creado_en'], default='nombre')


class OpcionesProductoSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=['categorias_productos', 'unidades_medida'])
    buscar = serializers.CharField(required=False, allow_blank=True, max_length=100)
    incluir_inactivos = serializers.BooleanField(required=False, default=False)
