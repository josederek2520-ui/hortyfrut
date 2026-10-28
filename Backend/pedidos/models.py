from django.conf import settings
from django.db import models
from django.db.models import Q


class Pedido(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        PREPARADO = 'preparado', 'Preparado'
        CANCELADO = 'cancelado', 'Cancelado'

    sucursal = models.ForeignKey('clientes.Sucursal', on_delete=models.PROTECT, related_name='pedidos')
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='pedidos_creados')
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='pedidos_responsable')
    responsable_nombre = models.CharField(max_length=200)
    cliente_nombre = models.CharField(max_length=150)
    sucursal_nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255)
    fecha_requerida = models.DateField()
    observaciones = models.CharField(max_length=1000, blank=True)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PENDIENTE)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_creacion = models.CharField(max_length=64, editable=False)
    cancelado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos_cancelados')
    cancelado_en = models.DateTimeField(null=True, blank=True)
    motivo_cancelacion = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'pedidos'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('cancelar_pedido', 'Cancelar pedidos'), ('ver_todos_pedidos', 'Ver pedidos de todas las sucursales'),
                       ('gestionar_todos_pedidos', 'Gestionar pedidos de todas las sucursales')]
        constraints = [models.CheckConstraint(condition=Q(estado__in=['pendiente', 'preparado', 'cancelado']), name='pedido_estado_valido')]
        indexes = [models.Index(fields=['sucursal', '-creado_en']), models.Index(fields=['fecha_requerida', 'estado'])]

    @property
    def codigo(self):
        return f'PED-{self.pk:06d}'

    def __str__(self):
        return self.codigo


class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT, related_name='detalles_pedidos')
    presentacion = models.ForeignKey('productos.PresentacionProducto', on_delete=models.PROTECT, related_name='detalles_pedidos')
    columna = models.CharField(max_length=10, choices=[('cajas', 'Cajas'), ('unidades', 'Unidades')])
    cantidad = models.PositiveIntegerField()
    producto_nombre = models.CharField(max_length=100)
    presentacion_nombre = models.CharField(max_length=100)
    categoria_nombre = models.CharField(max_length=100)

    class Meta:
        db_table = 'detalles_pedidos'
        ordering = ['producto_nombre', 'producto_id', 'columna']
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['pedido', 'producto', 'columna'], name='detalle_pedido_columna_unica'),
                       models.CheckConstraint(condition=Q(cantidad__gte=1, cantidad__lte=999999), name='detalle_pedido_cantidad_valida'),
                       models.CheckConstraint(condition=Q(columna__in=['cajas', 'unidades']), name='detalle_pedido_columna_valida')]
