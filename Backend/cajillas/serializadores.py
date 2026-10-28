from rest_framework import serializers
from compras.serializadores import SerializadorEstricto
from clientes.validadores import normalizar_texto
from .models import Cajilla, MovimientoCajilla
from .consultas import version_cajilla


class SerializadorCajilla(serializers.ModelSerializer):
    total = serializers.IntegerField(read_only=True)
    en_almacen = serializers.IntegerField(read_only=True)
    en_sucursales = serializers.IntegerField(read_only=True)
    version = serializers.SerializerMethodField()

    def get_version(self, obj):
        return version_cajilla(obj)

    class Meta:
        model = Cajilla
        fields = ('id', 'color', 'total', 'en_almacen', 'en_sucursales', 'creado_en', 'responsable_nombre', 'version')
        read_only_fields = fields


class SerializadorAltaCajilla(SerializadorEstricto):
    color = serializers.CharField(max_length=60)
    cantidad_inicial = serializers.IntegerField(min_value=0, max_value=2147483647, default=0)
    almacen = serializers.IntegerField(min_value=1, allow_null=True, required=False, default=None)
    clave_operacion = serializers.UUIDField()

    def validate_color(self, valor):
        color = normalizar_texto(valor).capitalize()
        if not color:
            raise serializers.ValidationError('Escribe el color de las cajillas.')
        return color

    def validate(self, datos):
        if datos['cantidad_inicial'] > 0 and not datos['almacen']:
            raise serializers.ValidationError({'almacen': 'Selecciona dónde están las cajillas iniciales.'})
        if datos['cantidad_inicial'] == 0:
            datos['almacen'] = None
        return datos


class SerializadorAltaMovimiento(SerializadorEstricto):
    tipo = serializers.ChoiceField(choices=['ingreso', 'salida', 'devolucion'])
    cantidad = serializers.IntegerField(min_value=1, max_value=2147483647)
    almacen = serializers.IntegerField(min_value=1)
    sucursal = serializers.IntegerField(min_value=1, allow_null=True, required=False, default=None)
    observaciones = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
    clave_operacion = serializers.UUIDField()

    def validate(self, datos):
        if datos['tipo'] in ('salida', 'devolucion') and not datos['sucursal']:
            raise serializers.ValidationError({'sucursal': 'Selecciona la sucursal de esta operación.'})
        if datos['tipo'] == 'ingreso' and datos['sucursal']:
            raise serializers.ValidationError({'sucursal': 'Un ingreso nuevo no corresponde a una devolución de sucursal.'})
        return datos


class SerializadorMovimientoCajilla(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)

    class Meta:
        model = MovimientoCajilla
        fields = ('id', 'codigo', 'cajilla', 'color', 'tipo', 'cantidad', 'almacen', 'almacen_nombre',
                  'sucursal', 'sucursal_nombre', 'cliente_nombre', 'observaciones', 'responsable_nombre', 'creado_en')
        read_only_fields = fields


class SerializadorFiltrosCajillas(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    cajilla = serializers.IntegerField(min_value=1, required=False)
    almacen = serializers.IntegerField(min_value=1, required=False)
    sucursal = serializers.IntegerField(min_value=1, required=False)
    tipo = serializers.ChoiceField(choices=MovimientoCajilla.Tipo.choices, required=False)
    fecha = serializers.DateField(required=False)
    operacion = serializers.ChoiceField(choices=['salida', 'devolucion'], required=False)
