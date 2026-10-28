from django.conf import settings
from django.db import models
from django.db.models import Q


class Recepcion(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = 'borrador', 'Borrador'
        CONFIRMADA = 'confirmada', 'Confirmada'
        CANCELADA = 'cancelada', 'Cancelada'

    compra = models.ForeignKey('compras.Compra', on_delete=models.PROTECT, null=True, blank=True, related_name='recepciones')
    almacen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT, related_name='recepciones')
    almacen_nombre = models.CharField(max_length=150)
    fecha_recepcion = models.DateField()
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.BORRADOR)
    observaciones = models.CharField(max_length=1000, blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='recepciones_creadas')
    responsable_nombre = models.CharField(max_length=200)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_creacion = models.CharField(max_length=64, editable=False)
    confirmado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='recepciones_confirmadas')
    confirmado_en = models.DateTimeField(null=True, blank=True)
    clave_confirmacion = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    cancelado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='recepciones_canceladas')
    cancelado_en = models.DateTimeField(null=True, blank=True)
    clave_cancelacion = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    motivo_cancelacion = models.CharField(max_length=500, blank=True)
    movimiento = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='recepcion')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recepciones'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('confirmar_recepcion', 'Confirmar recepciones'), ('cancelar_recepcion', 'Cancelar recepciones en borrador')]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'confirmada', 'cancelada']), name='recepcion_estado_valido'),
            models.CheckConstraint(condition=Q(estado='confirmada', movimiento__isnull=False, confirmado_en__isnull=False) | (~Q(estado='confirmada') & Q(movimiento__isnull=True)), name='recepcion_ingreso_confirmado'),
        ]
        indexes = [models.Index(fields=['compra', 'estado']), models.Index(fields=['fecha_recepcion'])]

    @property
    def codigo(self):
        return f'REC-{self.pk:06d}'


class DetalleRecepcion(models.Model):
    recepcion = models.ForeignKey(Recepcion, on_delete=models.CASCADE, related_name='detalles')
    detalle_compra = models.ForeignKey('compras.DetalleCompra', on_delete=models.PROTECT, null=True, blank=True, related_name='recepciones_detalles')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT, related_name='recepciones_detalles')
    unidad_inventario = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT, related_name='recepciones_inventario')
    producto_nombre = models.CharField(max_length=100)
    medida_compra_nombre = models.CharField(max_length=100, blank=True)
    unidad_nombre = models.CharField(max_length=100)
    unidad_abreviatura = models.CharField(max_length=10)
    cantidad_compra = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    cantidad_inventario = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    lote = models.OneToOneField('inventario.Lote', on_delete=models.PROTECT, null=True, blank=True, related_name='detalle_recepcion')

    class Meta:
        db_table = 'detalles_recepciones'
        ordering = ['pk']
        default_permissions = ()
        constraints = [
            models.UniqueConstraint(fields=['recepcion', 'detalle_compra'], condition=Q(detalle_compra__isnull=False), name='recepcion_linea_compra_unica'),
            models.CheckConstraint(condition=Q(cantidad_compra__gte=0, cantidad_inventario__gte=0) & (Q(peso_kg__isnull=True) | Q(peso_kg__gt=0)), name='recepcion_cantidades_validas'),
        ]
