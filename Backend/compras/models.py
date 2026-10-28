from django.conf import settings
from django.db import models
from django.db.models import Q


class Compra(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = 'borrador', 'Borrador'
        REGISTRADA = 'registrada', 'Registrada'
        CANCELADA = 'cancelada', 'Cancelada'

    fecha_pedidos = models.DateField()
    fecha_compra = models.DateField()
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='compras_creadas')
    responsable_nombre = models.CharField(max_length=200)
    observaciones = models.CharField(max_length=1000, blank=True)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.BORRADOR)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_creacion = models.CharField(max_length=64, editable=False)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='compras_registradas')
    registrado_en = models.DateTimeField(null=True, blank=True)
    clave_registro = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    cancelado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='compras_canceladas')
    cancelado_en = models.DateTimeField(null=True, blank=True)
    clave_cancelacion = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    motivo_cancelacion = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'compras'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('registrar_compra', 'Registrar compras'), ('cancelar_compra', 'Cancelar compras')]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'registrada', 'cancelada']), name='compra_estado_valido'),
            models.CheckConstraint(condition=Q(total__gte=0), name='compra_total_no_negativo'),
        ]
        indexes = [models.Index(fields=['fecha_pedidos', 'estado']), models.Index(fields=['fecha_compra'])]

    @property
    def codigo(self):
        return f'COM-{self.pk:06d}'

    def __str__(self):
        return self.codigo


class DetalleCompra(models.Model):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT, related_name='detalles_compras')
    presentacion = models.ForeignKey('productos.PresentacionProducto', on_delete=models.PROTECT, null=True, blank=True, related_name='detalles_compras')
    unidad_medida = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT, related_name='detalles_compras')
    proveedor = models.ForeignKey('proveedores.Proveedor', on_delete=models.PROTECT, null=True, blank=True, related_name='detalles_compras')
    producto_nombre = models.CharField(max_length=100)
    presentacion_nombre = models.CharField(max_length=100, blank=True)
    unidad_nombre = models.CharField(max_length=100)
    proveedor_nombre = models.CharField(max_length=150, blank=True)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = 'detalles_compras'
        ordering = ['pk']
        default_permissions = ()
        constraints = [models.CheckConstraint(condition=Q(cantidad__gte=0) & Q(precio_unitario__gte=0) & Q(subtotal__gte=0), name='detalle_compra_importes_validos')]


class ReferenciaPedidoCompra(models.Model):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name='pedidos_referencia')
    pedido = models.ForeignKey('pedidos.Pedido', on_delete=models.PROTECT, related_name='compras_referencia')
    codigo = models.CharField(max_length=30)
    cliente_nombre = models.CharField(max_length=150)
    sucursal_nombre = models.CharField(max_length=150)
    detalles = models.JSONField(default=list)

    class Meta:
        db_table = 'referencias_pedidos_compras'
        ordering = ['cliente_nombre', 'sucursal_nombre', 'pedido_id']
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['compra', 'pedido'], name='compra_pedido_referencia_unico')]
