from decimal import Decimal
from django.db.models.functions import Lower
from rest_framework import serializers
from .models import Cliente, Sucursal
from .servicios import obtener_version
from .validadores import normalizar_texto


class SerializadorBaseLectura(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()

    def get_version(self, obj):
        return obtener_version(obj)


class SerializadorCliente(SerializadorBaseLectura):
    cantidad_sucursales = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cliente
        fields = ('id', 'razon_social', 'nit', 'telefono', 'email', 'activo', 'creado_en', 'version', 'cantidad_sucursales')
        read_only_fields = fields


class SerializadorSucursal(SerializadorBaseLectura):
    encargado_pedidos = serializers.SerializerMethodField()

    def get_encargado_pedidos(self, obj):
        usuario = obj.encargado_pedidos
        return {'id': usuario.pk, 'nombre': usuario.get_full_name() or f'Cuenta #{usuario.pk}', 'activo': usuario.is_active} if usuario else None

    class Meta:
        model = Sucursal
        fields = ('id', 'cliente', 'nombre', 'direccion', 'telefono', 'referencia', 'latitud', 'longitud', 'encargado_pedidos', 'activo', 'creado_en', 'version')
        read_only_fields = fields


class SerializadorEscrituraBase(serializers.Serializer):
    telefono = serializers.RegexField(r'\A[0-9]*\Z', max_length=30, allow_blank=True, required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el registro antes de guardar.'})
        return attrs


class SerializadorEscrituraCliente(SerializadorEscrituraBase):
    razon_social = serializers.CharField(max_length=150)
    nit = serializers.RegexField(r'\A[0-9]+\Z', max_length=20)
    email = serializers.EmailField(max_length=150, allow_blank=True, required=False)

    def validate_razon_social(self, valor):
        return normalizar_texto(valor)

    def validate_nit(self, valor):
        consulta = Cliente.objects.filter(nit=valor)
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Ya existe un cliente con este NIT, incluso si está inactivo.')
        return valor

    def validate_email(self, valor):
        return valor.strip().lower()


class SerializadorEscrituraSucursal(SerializadorEscrituraBase):
    encargado_pedidos_id = serializers.IntegerField(min_value=1, allow_null=True, required=False)
    nombre = serializers.CharField(max_length=150)
    direccion = serializers.CharField(max_length=255)
    referencia = serializers.CharField(max_length=255, allow_blank=True, required=False)
    latitud = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=Decimal('-90'), max_value=Decimal('90'), allow_null=True, required=False)
    longitud = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=Decimal('-180'), max_value=Decimal('180'), allow_null=True, required=False)

    def validate_nombre(self, valor):
        nombre = normalizar_texto(valor)
        consulta = Sucursal.objects.filter(cliente_id=self.context['cliente_id']).annotate(nombre_normalizado=Lower('nombre')).filter(nombre_normalizado=nombre.lower())
        if self.instance:
            consulta = consulta.exclude(pk=self.instance.pk)
        if consulta.exists():
            raise serializers.ValidationError('Este cliente ya tiene una sucursal con ese nombre, incluso si está inactiva.')
        return nombre

    def validate(self, attrs):
        attrs = super().validate(attrs)
        latitud = attrs.get('latitud', self.instance.latitud if self.instance else None)
        longitud = attrs.get('longitud', self.instance.longitud if self.instance else None)
        if (latitud is None) != (longitud is None):
            raise serializers.ValidationError({campo: 'Completa ambas coordenadas o deja ambas vacías.' for campo in ('latitud', 'longitud')})
        return attrs


class SerializadorFiltros(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    activo = serializers.BooleanField(required=False)
    orden = serializers.ChoiceField(choices=['nombre', '-nombre', 'creado_en', '-creado_en'], default='nombre')
