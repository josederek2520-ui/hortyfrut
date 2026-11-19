from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from ventas.serializadores import SerializadorEstricto


class AplicacionEntrada(SerializadorEstricto):
    venta = serializers.IntegerField(min_value=1)
    importe = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal('0.01'))
    version_saldo = serializers.CharField(max_length=64)


class EntradaCobro(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    cliente = serializers.IntegerField(min_value=1)
    fecha_cobro = serializers.DateField()
    importe = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal('0.01'))
    medio = serializers.ChoiceField(choices=['efectivo', 'transferencia', 'deposito', 'cheque', 'otro'])
    referencia = serializers.CharField(max_length=150, allow_blank=True, default='')
    aplicaciones = serializers.ListField(child=AplicacionEntrada(), min_length=1, max_length=100)
    revision = serializers.CharField(max_length=64, allow_blank=True, default='')

    def validate(self, datos):
        if datos['fecha_cobro'] > timezone.localdate():
            raise serializers.ValidationError({'fecha_cobro': 'La fecha del cobro no puede estar en el futuro.'})
        if len({fila['venta'] for fila in datos['aplicaciones']}) != len(datos['aplicaciones']):
            raise serializers.ValidationError({'aplicaciones': 'No repitas una venta dentro del mismo cobro.'})
        if sum((fila['importe'] for fila in datos['aplicaciones']), Decimal(0)) != datos['importe']:
            raise serializers.ValidationError({'importe': 'La suma de los importes asignados a las ventas debe ser igual al importe recibido.'})
        return datos


class FiltrosCobro(serializers.Serializer):
    cliente = serializers.IntegerField(min_value=1, required=False)
    venta = serializers.IntegerField(min_value=1, required=False)
    buscar = serializers.CharField(max_length=150, required=False, allow_blank=True)
    desde = serializers.DateField(required=False)
    hasta = serializers.DateField(required=False)
    pagina = serializers.IntegerField(min_value=1, required=False)
    seleccion = serializers.CharField(max_length=1600, required=False, allow_blank=True)

    def validate(self, datos):
        if datos.get('desde') and datos.get('hasta') and datos['desde'] > datos['hasta']:
            raise serializers.ValidationError({'hasta': 'La fecha final no puede ser anterior a la inicial.'})
        if datos.get('seleccion'):
            valores = datos['seleccion'].split(',')
            if len(valores) > 100 or any(not v.isascii() or not v.isdigit() or len(v) > 15 or int(v) < 1 for v in valores):
                raise serializers.ValidationError({'seleccion': 'Selecciona hasta cien ventas válidas.'})
            datos['seleccion'] = [int(v) for v in valores]
        return datos
