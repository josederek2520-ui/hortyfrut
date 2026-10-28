from django.conf import settings
from django.db import models
from django.db.models import Q


class Preparacion(models.Model):
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.PROTECT, related_name='preparaciones')
    cliente_nombre = models.CharField(max_length=150)
    fecha_pedidos = models.DateField()
    almacen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT, related_name='preparaciones')
    almacen_nombre = models.CharField(max_length=150)
    estado = models.CharField(max_length=12, choices=[('borrador', 'Borrador'), ('confirmada', 'Confirmada'), ('cancelada', 'Cancelada')], default='borrador')
    observaciones = models.CharField(max_length=1000, blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='preparaciones_creadas')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_creacion = models.CharField(max_length=64, editable=False)
    confirmado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='preparaciones_confirmadas')
    confirmado_en = models.DateTimeField(null=True, blank=True)
    clave_confirmacion = models.UUIDField(unique=True, null=True, blank=True, editable=False)
    cancelado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='preparaciones_canceladas')
    cancelado_en = models.DateTimeField(null=True, blank=True)
    motivo_cancelacion = models.CharField(max_length=500, blank=True)
    clave_cancelacion = models.UUIDField(unique=True, null=True, blank=True, editable=False)
    movimiento_salida = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='preparacion_salida')
    movimiento_aprovechable = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='preparacion_aprovechable')

    class Meta:
        db_table = 'preparaciones'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('confirmar_preparacion', 'Confirmar preparaciones'), ('cancelar_preparacion', 'Cancelar borradores de preparación')]
        indexes = [models.Index(fields=['cliente', 'fecha_pedidos', 'estado'])]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'confirmada', 'cancelada']), name='preparacion_estado_valido'),
            models.CheckConstraint(condition=Q(estado='confirmada', confirmado_en__isnull=False, movimiento_salida__isnull=False) |
                (Q(estado__in=['borrador', 'cancelada'], movimiento_salida__isnull=True, movimiento_aprovechable__isnull=True)), name='preparacion_salida_confirmada'),
        ]

    @property
    def codigo(self):
        return f'PRE-{self.pk:06d}'


class LineaPreparacion(models.Model):
    preparacion = models.ForeignKey(Preparacion, on_delete=models.CASCADE, related_name='lineas')
    lote = models.ForeignKey('inventario.Lote', on_delete=models.PROTECT, related_name='usos_preparacion')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT)
    unidad = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT)
    producto_nombre = models.CharField(max_length=100)
    unidad_nombre = models.CharField(max_length=100)
    unidad_abreviatura = models.CharField(max_length=10)
    cantidad_utilizada = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    merma = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    aprovechable = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    motivo_separacion = models.CharField(max_length=500, blank=True)
    lote_aprovechable = models.OneToOneField('inventario.Lote', on_delete=models.PROTECT, null=True, blank=True, related_name='separacion_preparacion')

    class Meta:
        db_table = 'lineas_preparacion'
        default_permissions = ()
        ordering = ['pk']
        constraints = [models.UniqueConstraint(fields=['preparacion', 'lote'], name='preparacion_lote_unico'),
                       models.CheckConstraint(condition=Q(cantidad_utilizada__gte=0, merma__gte=0, aprovechable__gte=0), name='preparacion_cantidades_no_negativas')]


class AsignacionPreparacion(models.Model):
    preparacion = models.ForeignKey(Preparacion, on_delete=models.CASCADE, related_name='asignaciones')
    pedido = models.ForeignKey('pedidos.Pedido', on_delete=models.PROTECT, related_name='asignaciones_preparacion')
    detalle_pedido = models.ForeignKey('pedidos.DetallePedido', on_delete=models.SET_NULL, null=True, related_name='asignaciones_preparacion')
    sucursal = models.ForeignKey('clientes.Sucursal', on_delete=models.PROTECT)
    sucursal_nombre = models.CharField(max_length=150)
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT)
    producto_nombre = models.CharField(max_length=100)
    presentacion_nombre = models.CharField(max_length=100)
    columna = models.CharField(max_length=10, choices=[('cajas', 'Cajas'), ('unidades', 'Unidades')])
    cantidad_solicitada = models.PositiveIntegerField()
    cantidad = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'asignaciones_preparacion'
        default_permissions = ()
        ordering = ['sucursal_nombre', 'producto_nombre', 'pk']
        constraints = [models.UniqueConstraint(fields=['preparacion', 'detalle_pedido'], condition=Q(detalle_pedido__isnull=False), name='preparacion_detalle_pedido_unico'),
                       models.CheckConstraint(condition=Q(columna__in=['cajas', 'unidades'], cantidad__lte=999999), name='preparacion_asignacion_valida')]


class AportePreparacion(models.Model):
    linea = models.ForeignKey(LineaPreparacion, on_delete=models.CASCADE, related_name='aportes')
    asignacion = models.ForeignKey(AsignacionPreparacion, on_delete=models.CASCADE, related_name='aportes')
    cantidad = models.DecimalField(max_digits=14, decimal_places=3)
    peso_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)

    class Meta:
        db_table = 'aportes_preparacion'
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['linea', 'asignacion'], name='preparacion_aporte_unico'),
                       models.CheckConstraint(condition=Q(cantidad__gte=0) & (Q(peso_kg__isnull=True) | Q(peso_kg__gt=0)), name='preparacion_aporte_valido')]


class CajillaPrevista(models.Model):
    preparacion = models.ForeignKey(Preparacion, on_delete=models.CASCADE, related_name='cajillas')
    sucursal = models.ForeignKey('clientes.Sucursal', on_delete=models.PROTECT)
    sucursal_nombre = models.CharField(max_length=150)
    cajilla = models.ForeignKey('cajillas.Cajilla', on_delete=models.PROTECT)
    color = models.CharField(max_length=60)
    cantidad = models.PositiveIntegerField()

    class Meta:
        db_table = 'cajillas_previstas_preparacion'
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['preparacion', 'sucursal', 'cajilla'], name='preparacion_cajilla_destino_unico'),
                       models.CheckConstraint(condition=Q(cantidad__gte=1, cantidad__lte=2147483647), name='preparacion_cajilla_cantidad_valida')]
