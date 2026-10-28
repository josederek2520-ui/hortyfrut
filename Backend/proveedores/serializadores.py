from rest_framework import serializers
from clientes.validadores import normalizar_texto
from .models import Proveedor


class SerializadorProveedor(serializers.ModelSerializer):
    categoria = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()

    def get_categoria(self, obj):
        return {'id': obj.categoria_id, 'nombre': obj.categoria.nombre, 'activo': obj.categoria.activo} if obj.categoria_id else None

    def get_version(self, obj):
        from .servicios import version_proveedor
        return version_proveedor(obj)

    class Meta:
        model = Proveedor
        fields = ('id', 'nombre', 'categoria', 'telefono', 'direccion', 'activo', 'creado_en', 'version')
        read_only_fields = fields


class SerializadorEscrituraProveedor(serializers.Serializer):
    nombre = serializers.CharField(max_length=150)
    categoria = serializers.IntegerField(min_value=1, allow_null=True, required=False)
    telefono = serializers.RegexField(r'\A[0-9]*\Z', max_length=30, allow_blank=True, required=False)
    direccion = serializers.CharField(max_length=255, allow_blank=True, required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate_nombre(self, valor):
        return normalizar_texto(valor)

    def validate_direccion(self, valor):
        return normalizar_texto(valor)

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el proveedor antes de guardar.'})
        return attrs


class SerializadorEstadoProveedor(serializers.Serializer):
    activo = serializers.BooleanField()
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        return attrs


class SerializadorFiltrosProveedores(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    categoria = serializers.IntegerField(min_value=1, required=False)
    activo = serializers.BooleanField(required=False)
    orden = serializers.ChoiceField(choices=['nombre', '-nombre', 'creado_en', '-creado_en'], default='nombre')


class SerializadorOpcionesCategorias(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    incluir_inactivos = serializers.BooleanField(default=False)
