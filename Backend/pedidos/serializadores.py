from rest_framework import serializers
from .models import Pedido, DetallePedido


class SerializadorEstricto(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError('Envía un objeto válido.')
        desconocidos = set(data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
        return super().to_internal_value(data)


class SerializadorLinea(SerializadorEstricto):
    producto = serializers.IntegerField(min_value=1)
    presentacion = serializers.IntegerField(min_value=1)
    columna = serializers.ChoiceField(choices=['cajas', 'unidades'])
    cantidad = serializers.IntegerField(min_value=1, max_value=999999)


class SerializadorEscrituraPedido(SerializadorEstricto):
    sucursal = serializers.IntegerField(min_value=1, required=False)
    fecha_requerida = serializers.DateField()
    # Compatibilidad con clientes anteriores; la interfaz de Pedidos ya no lo utiliza.
    observaciones = serializers.CharField(max_length=1000, allow_blank=True, required=False)
    detalles = serializers.JSONField()
    clave_operacion = serializers.UUIDField(required=False)
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z', required=False)

    def validate_detalles(self, valor):
        if not isinstance(valor, list) or not 1 <= len(valor) <= 500:
            raise serializers.ValidationError('Selecciona entre 1 y 500 cantidades de productos.')
        resultado, claves = [], set()
        for indice, linea in enumerate(valor):
            formulario = SerializadorLinea(data=linea)
            if not formulario.is_valid():
                raise serializers.ValidationError(f'Cantidad {indice + 1}: revisa producto, presentación y cantidad entera entre 1 y 999999.')
            datos = formulario.validated_data
            clave = (datos['producto'], datos['columna'])
            if clave in claves:
                raise serializers.ValidationError('Cada producto admite una cantidad de cajas y otra de unidades.')
            claves.add(clave)
            resultado.append(datos)
        return resultado

    def validate(self, attrs):
        if self.instance:
            if 'sucursal' in attrs or 'clave_operacion' in attrs:
                raise serializers.ValidationError('La sucursal y la clave de creación no se pueden cambiar.')
            if not attrs.get('version') or 'detalles' not in attrs or 'fecha_requerida' not in attrs:
                raise serializers.ValidationError('Envía la hoja completa y su versión antes de guardar.')
        elif not attrs.get('sucursal') or not attrs.get('clave_operacion'):
            raise serializers.ValidationError('Selecciona una sucursal y envía la clave de creación.')
        return attrs


class SerializadorCancelar(SerializadorEstricto):
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
    motivo = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class SerializadorDetalle(serializers.ModelSerializer):
    imagen = serializers.SerializerMethodField()
    cantidad_preparada = serializers.SerializerMethodField()
    cantidad_pendiente = serializers.SerializerMethodField()

    def get_cantidad_preparada(self, obj):
        return self.context.get('avance_preparacion', {}).get(obj.pk, 0)

    def get_cantidad_pendiente(self, obj):
        return max(0, obj.cantidad - self.get_cantidad_preparada(obj))

    def get_imagen(self, obj):
        return f'/api/v1/pedidos/imagenes/{obj.producto_id}/' if obj.producto.imagen else None

    class Meta:
        model = DetallePedido
        fields = ('id', 'producto', 'presentacion', 'columna', 'cantidad', 'producto_nombre', 'presentacion_nombre', 'categoria_nombre', 'imagen', 'cantidad_preparada', 'cantidad_pendiente')


class SerializadorPedido(serializers.ModelSerializer):
    bloqueado_preparacion = serializers.SerializerMethodField()

    def get_bloqueado_preparacion(self, obj):
        if not hasattr(obj, '_bloqueado_preparacion'):
            obj._bloqueado_preparacion = obj.asignaciones_preparacion.filter(preparacion__estado='confirmada', cantidad__gt=0).exists()
        return obj._bloqueado_preparacion
    codigo = serializers.CharField(read_only=True)
    version = serializers.SerializerMethodField()
    cantidad_productos = serializers.SerializerMethodField()
    puede_editar = serializers.SerializerMethodField()
    puede_cancelar = serializers.SerializerMethodField()

    def permitido(self, obj, codigo):
        solicitud = self.context.get('request')
        if not solicitud or obj.estado != 'pendiente' or self.get_bloqueado_preparacion(obj):
            return False
        actor = solicitud.user
        return actor.has_perm(f'pedidos.{codigo}') and (actor.has_perm('pedidos.gestionar_todos_pedidos') or obj.sucursal.encargado_pedidos_id == actor.pk)

    def get_puede_editar(self, obj):
        return self.permitido(obj, 'change_pedido')

    def get_puede_cancelar(self, obj):
        return self.permitido(obj, 'cancelar_pedido')

    def get_version(self, obj):
        from .servicios import obtener_version
        return obtener_version(obj)

    def get_cantidad_productos(self, obj):
        return len({linea.producto_id for linea in obj.detalles.all()})

    class Meta:
        model = Pedido
        fields = ('id', 'codigo', 'sucursal', 'cliente_nombre', 'sucursal_nombre', 'responsable_nombre', 'fecha_requerida', 'estado', 'creado_en', 'cantidad_productos', 'version', 'puede_editar', 'puede_cancelar', 'bloqueado_preparacion')


class SerializadorPedidoCompleto(SerializadorPedido):
    detalles = SerializadorDetalle(many=True, read_only=True)

    def to_representation(self, instance):
        from preparaciones.consultas import avance_detalles
        self.context['avance_preparacion'] = avance_detalles([fila.pk for fila in instance.detalles.all()])
        return super().to_representation(instance)

    class Meta(SerializadorPedido.Meta):
        fields = (*SerializadorPedido.Meta.fields, 'direccion', 'observaciones', 'detalles', 'cancelado_en', 'motivo_cancelacion')
