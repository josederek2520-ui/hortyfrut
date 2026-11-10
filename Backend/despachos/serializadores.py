from rest_framework import serializers
from compras.serializadores import SerializadorEstricto
from .models import Despacho, ParadaDespacho


class SerializadorCajillaDespacho(SerializadorEstricto):
    sucursal = serializers.IntegerField(min_value=1)
    cajilla = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1, max_value=2147483647)


class SerializadorEscrituraDespacho(SerializadorEstricto):
    almacen = serializers.IntegerField(min_value=1)
    vehiculo = serializers.IntegerField(min_value=1)
    chofer = serializers.IntegerField(min_value=1)
    fecha_reparto = serializers.DateField()
    observaciones = serializers.CharField(max_length=1000, allow_blank=True, default='')
    asignaciones = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=True, max_length=1000)
    orden_sucursales = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=True, max_length=1000)
    cajillas = SerializadorCajillaDespacho(many=True, max_length=1000)
    cajillas_automaticas = serializers.BooleanField(required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)
    clave_operacion = serializers.UUIDField(required=False)

    def validate(self, datos):
        for campo in ('asignaciones', 'orden_sucursales'):
            if len(datos[campo]) != len(set(datos[campo])):
                raise serializers.ValidationError({campo: 'Hay selecciones repetidas.'})
        pares = [(fila['sucursal'], fila['cajilla']) for fila in datos['cajillas']]
        if len(pares) != len(set(pares)):
            raise serializers.ValidationError({'cajillas': 'Registra cada color una sola vez por sucursal.'})
        if self.instance and not datos.get('version'):
            raise serializers.ValidationError({'version': 'Recarga el despacho antes de guardar.'})
        if not self.instance and not datos.get('clave_operacion'):
            raise serializers.ValidationError({'clave_operacion': 'Falta identificar esta operación.'})
        return datos


class SerializadorAccionDespacho(SerializadorEstricto):
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
    clave_operacion = serializers.UUIDField()
    parada = serializers.IntegerField(min_value=1, required=False)


class SerializadorDescargaPedido(SerializadorAccionDespacho):
    parada = serializers.IntegerField(min_value=1)
    pedido = serializers.IntegerField(min_value=1)
    cargas_comprobadas = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1, max_length=1000)

    def validate_cargas_comprobadas(self, valores):
        if len(valores) != len(set(valores)):
            raise serializers.ValidationError('No repitas productos al confirmar la descarga.')
        return valores


class SerializadorParadaDespacho(serializers.ModelSerializer):
    pedidos = serializers.SerializerMethodField()
    pedidos_descargados = serializers.SerializerMethodField()

    def get_pedidos(self, obj):
        from .descargas import agrupar_pedidos_descarga
        return len(agrupar_pedidos_descarga(obj.cargas.all()))

    def get_pedidos_descargados(self, obj):
        from .descargas import agrupar_pedidos_descarga
        return sum(fila['descargada_en'] is not None for fila in agrupar_pedidos_descarga(obj.cargas.all()))
    class Meta:
        model = ParadaDespacho
        fields = ('id', 'sucursal', 'cliente_nombre', 'sucursal_nombre', 'direccion', 'orden', 'llegada_en', 'descargada_en', 'pedidos', 'pedidos_descargados')
        read_only_fields = fields


class SerializadorDespacho(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    version = serializers.SerializerMethodField()
    resumen = serializers.SerializerMethodField()
    siguiente_destino = serializers.SerializerMethodField()

    def get_siguiente_destino(self, obj):
        if obj.estado not in ('borrador', 'en_ruta'):
            return None
        parada = next((fila for fila in obj.paradas.all() if not fila.descargada_en), None)
        if parada:
            return {'cliente_nombre': parada.cliente_nombre, 'sucursal_nombre': parada.sucursal_nombre, 'orden': parada.orden}
        return None

    def get_version(self, obj):
        from .servicios import version_despacho
        return version_despacho(obj)

    def get_resumen(self, obj):
        from decimal import Decimal
        from .descargas import agrupar_pedidos_descarga
        pedidos = agrupar_pedidos_descarga(obj.cargas.all())
        cargas = [fila.contenido for fila in obj.cargas.all()]
        return {'cajas': sum(fila['cantidad'] for fila in cargas if fila['columna'] == 'cajas'),
                'unidades': sum(fila['cantidad'] for fila in cargas if fila['columna'] == 'unidades'),
                'peso_kg': str(sum((Decimal(fila['peso_kg']) for fila in cargas), Decimal('0'))),
                'paradas': len(obj.paradas.all()), 'completadas': sum(bool(fila.descargada_en) for fila in obj.paradas.all()),
                'cajillas': sum(fila.cantidad for fila in obj.cajillas.all()),
                'pedidos': len(pedidos), 'pedidos_descargados': sum(fila['descargada_en'] is not None for fila in pedidos)}

    class Meta:
        model = Despacho
        fields = ('id', 'codigo', 'almacen', 'almacen_nombre', 'vehiculo', 'vehiculo_placa', 'chofer', 'chofer_nombre',
                  'fecha_reparto', 'estado', 'observaciones', 'responsable_nombre', 'creado_en', 'salida_en', 'retorno_en', 'version', 'resumen', 'siguiente_destino',
                  'enviado_en', 'enviado_por_nombre')
        read_only_fields = fields


class SerializadorDetalleDespacho(SerializadorDespacho):
    vehiculo_capacidad_kg = serializers.DecimalField(source='vehiculo.capacidad_kg', max_digits=12, decimal_places=3, allow_null=True, read_only=True)
    comprobacion_capacidad = serializers.SerializerMethodField()
    paradas = SerializadorParadaDespacho(many=True, read_only=True)
    cargas = serializers.SerializerMethodField()
    cajillas = serializers.SerializerMethodField()
    cajillas_sugeridas = serializers.SerializerMethodField()
    cajillas_automaticas = serializers.BooleanField(read_only=True, allow_null=True)
    historial = serializers.SerializerMethodField()

    def get_comprobacion_capacidad(self, obj):
        from .capacidad import comprobar_capacidad
        return comprobar_capacidad(obj.vehiculo.capacidad_kg, (fila.contenido for fila in obj.cargas.all()))

    def get_cargas(self, obj):
        from .descargas import contenido_carga_descarga
        from .cajillas_preparadas import previsiones_carga, referencias_despacho
        previstas = previsiones_carga(referencias_despacho(obj)) if obj.estado == 'borrador' and obj.enviado_en is None else []
        return [{**contenido_carga_descarga(fila), 'cajillas_previstas': [cajilla for cajilla in previstas
                 if cajilla['preparacion_id'] == fila.contenido['preparacion'] and cajilla['sucursal_id'] == fila.contenido['sucursal']
                 and cajilla['producto_id'] in (None, fila.contenido['producto'])]} for fila in obj.cargas.all()]

    def get_cajillas_sugeridas(self, obj):
        from .cajillas_preparadas import sugeridas_despacho
        return sugeridas_despacho(obj)

    def get_cajillas(self, obj):
        return [{'id': fila.pk, 'sucursal': fila.parada.sucursal_id, 'cajilla': fila.cajilla_id, 'color': fila.color, 'cantidad': fila.cantidad} for fila in obj.cajillas.all()]

    def get_historial(self, obj):
        # Resumen reciente; el registro completo permanece paginado en Auditoría.
        return [{'accion': fila.accion, 'responsable_nombre': fila.responsable_nombre, 'creado_en': fila.creado_en} for fila in obj.operaciones.order_by('-pk')[:10]]

    class Meta(SerializadorDespacho.Meta):
        fields = SerializadorDespacho.Meta.fields + ('paradas', 'cargas', 'cajillas', 'cajillas_sugeridas', 'cajillas_automaticas', 'historial', 'vehiculo_capacidad_kg', 'comprobacion_capacidad')
        read_only_fields = fields
