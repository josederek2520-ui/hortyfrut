from collections.abc import Mapping
from decimal import Decimal
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from compras.serializadores import SerializadorEstricto
from .models import Preparacion, LineaPreparacion, AsignacionPreparacion, AportePreparacion, CajillaPrevista
from .consultas import version_preparacion, avance_detalles, ruta_imagen_preparacion


class SerializadorLineaEscritura(SerializadorEstricto):
    lote = serializers.IntegerField(min_value=1)
    cantidad_utilizada = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    merma = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    aprovechable = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    motivo_separacion = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class SerializadorAporteEscritura(SerializadorEstricto):
    lote = serializers.IntegerField(min_value=1)
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0'), default=Decimal('0'))
    peso_kg = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=Decimal('0.001'), allow_null=True, required=False, default=None)


class SerializadorAsignacionEscritura(SerializadorEstricto):
    detalle_pedido = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=0, max_value=999999, default=0)
    aportes = SerializadorAporteEscritura(many=True, max_length=20)


class SerializadorCajillaEscritura(SerializadorEstricto):
    sucursal = serializers.IntegerField(min_value=1)
    cajilla = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1, max_value=2147483647)


class SerializadorEscrituraPreparacion(SerializadorEstricto):
    cliente = serializers.IntegerField(min_value=1)
    fecha_pedidos = serializers.DateField()
    almacen = serializers.IntegerField(min_value=1)
    observaciones = serializers.CharField(max_length=1000, allow_blank=True, required=False, default='')
    lineas = SerializadorLineaEscritura(many=True, max_length=500)
    asignaciones = SerializadorAsignacionEscritura(many=True, max_length=500)
    cajillas = SerializadorCajillaEscritura(many=True, max_length=500)
    clave_operacion = serializers.UUIDField(required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate(self, datos):
        campo = 'version' if self.instance else 'clave_operacion'
        if campo not in datos:
            raise serializers.ValidationError({campo: 'Recarga el formulario antes de guardar.'})
        if self.instance:
            if 'clave_operacion' in datos:
                raise serializers.ValidationError({'clave_operacion': 'La clave de creación no se puede modificar.'})
            if datos['cliente'] != self.instance.cliente_id or datos['fecha_pedidos'] != self.instance.fecha_pedidos:
                raise serializers.ValidationError({'cliente': 'El cliente y la fecha de pedidos de un borrador guardado no se pueden cambiar.'})
        return datos


def leer_formulario(formulario):
    if formulario.is_valid():
        return formulario.validated_data
    errores = {}
    def recorrer(valor, ruta=''):
        if isinstance(valor, Mapping):
            for clave, contenido in valor.items():
                recorrer(contenido, f'{ruta}_{clave}' if ruta else str(clave))
        elif isinstance(valor, list) and any(isinstance(elemento, Mapping) for elemento in valor):
            for indice, contenido in enumerate(valor):
                recorrer(contenido, f'{ruta}_{indice}')
        else:
            errores[ruta or 'non_field_errors'] = valor
    recorrer(formulario.errors)
    raise ValidationError(errores)


class SerializadorAporte(serializers.ModelSerializer):
    lote = serializers.IntegerField(source='linea.lote_id', read_only=True)
    lote_codigo = serializers.CharField(source='linea.lote.codigo', read_only=True)
    unidad_abreviatura = serializers.CharField(source='linea.unidad_abreviatura', read_only=True)

    class Meta:
        model = AportePreparacion
        fields = ('id', 'lote', 'lote_codigo', 'cantidad', 'peso_kg', 'unidad_abreviatura')
        read_only_fields = fields


class DatosImagenPreparacion:
    def get_producto_imagen(self, obj):
        return ruta_imagen_preparacion(obj.producto_id, obj.producto.imagen,
            self.context.get('cliente_imagen'), self.context.get('fecha_imagen'))

    def get_producto_categoria(self, obj):
        return {'id': obj.producto.categoria_id, 'nombre': obj.producto.categoria.nombre}


class SerializadorAsignacion(DatosImagenPreparacion, serializers.ModelSerializer):
    producto_imagen = serializers.SerializerMethodField()
    producto_categoria = serializers.SerializerMethodField()
    aportes = SerializadorAporte(many=True, read_only=True)
    codigo = serializers.CharField(source='pedido.codigo', read_only=True)
    pendiente_actual = serializers.SerializerMethodField()
    disponible = serializers.SerializerMethodField()

    def get_pendiente_actual(self, obj):
        return max(0, obj.detalle_pedido.cantidad - self.context.get('avances', {}).get(obj.detalle_pedido_id, 0)) if obj.detalle_pedido_id else 0

    def get_disponible(self, obj):
        return bool(obj.detalle_pedido_id and obj.pedido.estado == 'pendiente' and obj.sucursal.activo and self.get_pendiente_actual(obj) > 0)

    class Meta:
        model = AsignacionPreparacion
        fields = ('id', 'pedido', 'codigo', 'detalle_pedido', 'sucursal', 'sucursal_nombre', 'producto', 'producto_nombre',
                  'presentacion_nombre', 'columna', 'cantidad_solicitada', 'cantidad', 'aportes', 'pendiente_actual', 'disponible',
                  'producto_imagen', 'producto_categoria')
        read_only_fields = fields


class SerializadorLinea(DatosImagenPreparacion, serializers.ModelSerializer):
    producto_imagen = serializers.SerializerMethodField()
    producto_categoria = serializers.SerializerMethodField()
    lote_codigo = serializers.CharField(source='lote.codigo', read_only=True)
    lote_aprovechable_codigo = serializers.CharField(source='lote_aprovechable.codigo', read_only=True, default=None)
    es_kg = serializers.SerializerMethodField()

    def get_es_kg(self, obj):
        return obj.unidad_abreviatura.strip().casefold() == 'kg'

    class Meta:
        model = LineaPreparacion
        fields = ('id', 'lote', 'lote_codigo', 'producto', 'producto_nombre', 'unidad', 'unidad_nombre', 'unidad_abreviatura',
                  'cantidad_utilizada', 'merma', 'aprovechable', 'motivo_separacion', 'lote_aprovechable', 'lote_aprovechable_codigo', 'es_kg',
                  'producto_imagen', 'producto_categoria')
        read_only_fields = fields


class SerializadorCajilla(serializers.ModelSerializer):
    class Meta:
        model = CajillaPrevista
        fields = ('id', 'sucursal', 'sucursal_nombre', 'cajilla', 'color', 'cantidad')
        read_only_fields = fields


class SerializadorPreparacion(serializers.ModelSerializer):
    codigo = serializers.CharField(read_only=True)
    version = serializers.SerializerMethodField()
    cantidad_productos = serializers.SerializerMethodField()

    def get_version(self, obj):
        return version_preparacion(obj)

    def get_cantidad_productos(self, obj):
        return len({linea.producto_id for linea in obj.lineas.all()})

    class Meta:
        model = Preparacion
        fields = ('id', 'codigo', 'cliente', 'cliente_nombre', 'fecha_pedidos', 'almacen', 'almacen_nombre', 'estado',
                  'responsable_nombre', 'creado_en', 'version', 'cantidad_productos')
        read_only_fields = fields


class SerializadorPreparacionCompleta(SerializadorPreparacion):
    lineas = SerializadorLinea(many=True, read_only=True)
    asignaciones = SerializadorAsignacion(many=True, read_only=True)
    cajillas = SerializadorCajilla(many=True, read_only=True)
    salida_codigo = serializers.CharField(source='movimiento_salida.codigo', read_only=True, default=None)
    aprovechable_codigo = serializers.CharField(source='movimiento_aprovechable.codigo', read_only=True, default=None)

    def to_representation(self, instance):
        self.context['cliente_imagen'] = instance.cliente_id
        self.context['fecha_imagen'] = instance.fecha_pedidos
        self.context['avances'] = avance_detalles([fila.detalle_pedido_id for fila in instance.asignaciones.all() if fila.detalle_pedido_id])
        return super().to_representation(instance)

    class Meta(SerializadorPreparacion.Meta):
        fields = (*SerializadorPreparacion.Meta.fields, 'observaciones', 'lineas', 'asignaciones', 'cajillas', 'confirmado_en', 'cancelado_en',
                  'motivo_cancelacion', 'movimiento_salida', 'movimiento_aprovechable', 'salida_codigo', 'aprovechable_codigo')
        read_only_fields = fields


class SerializadorFiltrosPreparaciones(serializers.Serializer):
    fecha_pedidos = serializers.DateField(required=False)
    cliente = serializers.IntegerField(min_value=1, required=False)
    almacen = serializers.IntegerField(min_value=1, required=False)
    categoria = serializers.IntegerField(min_value=1, required=False)
    producto = serializers.IntegerField(min_value=1, required=False)
    sucursal = serializers.IntegerField(min_value=1, required=False)
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    estado = serializers.ChoiceField(choices=['borrador', 'confirmada', 'cancelada'], required=False)
    vista = serializers.ChoiceField(choices=['solicitado', 'pendiente'], default='solicitado')
    version_hoja = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)
