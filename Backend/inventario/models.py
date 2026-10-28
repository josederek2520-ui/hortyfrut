from django.conf import settings
from django.db import models
from django.db.models import Q


class UnidadInventarioProducto(models.Model):
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT, related_name='unidades_inventario')
    unidad = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT, related_name='productos_inventario')
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'unidades_inventario_producto'
        default_permissions = ()
        permissions = [('gestionar_unidades_inventario', 'Gestionar unidades de inventario por producto')]
        constraints = [models.UniqueConstraint(fields=['producto', 'unidad'], name='inventario_producto_unidad_unica')]


class SecuenciaLote(models.Model):
    fecha = models.DateField(primary_key=True)
    ultimo = models.PositiveBigIntegerField(default=0)

    class Meta:
        db_table = 'secuencias_lote'
        default_permissions = ()


class Lote(models.Model):
    class Estado(models.TextChoices):
        DISPONIBLE = 'disponible', 'Disponible'
        BLOQUEADO = 'bloqueado', 'Bloqueado'

    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT, related_name='lotes_inventario')
    calidad = models.CharField(max_length=15, choices=[('apto', 'Apto para pedidos'), ('aprovechable', 'Aprovechable para producción')], default='apto')
    lote_origen = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='lotes_derivados')
    unidad = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT, related_name='lotes_inventario')
    almacen_origen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT, related_name='lotes_recibidos')
    producto_nombre = models.CharField(max_length=100)
    unidad_nombre = models.CharField(max_length=100)
    unidad_abreviatura = models.CharField(max_length=10)
    almacen_nombre = models.CharField(max_length=150)
    fecha_ingreso = models.DateField()
    codigo_lote = models.CharField(max_length=32, unique=True, null=True, editable=False)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    peso_kg_ingreso = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.DISPONIBLE)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lotes'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view',)
        permissions = [('cambiar_estado_lote', 'Bloquear o desbloquear lotes')]
        constraints = [
            models.CheckConstraint(condition=Q(codigo_lote__isnull=True) | Q(codigo_lote__regex=r'^L[0-9]{6}-[0-9]{2,}$'), name='lote_codigo_formato_valido'),
            models.CheckConstraint(condition=Q(estado__in=['disponible', 'bloqueado']), name='lote_estado_valido'),
            models.CheckConstraint(condition=Q(calidad__in=['apto', 'aprovechable']), name='lote_calidad_valida'),
            models.CheckConstraint(condition=Q(fecha_vencimiento__isnull=True) | Q(fecha_vencimiento__gte=models.F('fecha_ingreso')), name='lote_vencimiento_valido'),
            models.CheckConstraint(condition=Q(peso_kg_ingreso__isnull=True) | Q(peso_kg_ingreso__gt=0), name='lote_peso_positivo'),
        ]
        indexes = [models.Index(fields=['producto', 'unidad']), models.Index(fields=['fecha_vencimiento'])]

    @property
    def codigo(self):
        return self.codigo_lote or f'LOT-{self.pk:06d}'


class MovimientoInventario(models.Model):
    almacen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT, related_name='movimientos_inventario')
    almacen_nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=30, choices=[('entrada_recepcion', 'Entrada por recepción'), ('salida_preparacion', 'Salida por preparación'), ('entrada_aprovechable', 'Entrada aprovechable')])
    naturaleza = models.CharField(max_length=10, choices=[('entrada', 'Entrada'), ('salida', 'Salida')], default='entrada')
    estado = models.CharField(max_length=12, default='registrado', choices=[('registrado', 'Registrado')])
    fecha = models.DateField()
    referencia_tipo = models.CharField(max_length=30)
    referencia_id = models.PositiveBigIntegerField()
    referencia_codigo = models.CharField(max_length=30)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='movimientos_inventario_registrados')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'movimientos_inventario'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view',)
        constraints = [
            models.UniqueConstraint(fields=['tipo', 'referencia_tipo', 'referencia_id', 'almacen'], name='inventario_origen_movimiento_unico'),
            models.CheckConstraint(condition=Q(estado='registrado') & (
                Q(tipo='entrada_recepcion', naturaleza='entrada', referencia_tipo='recepcion') |
                Q(tipo='salida_preparacion', naturaleza='salida', referencia_tipo='preparacion') |
                Q(tipo='entrada_aprovechable', naturaleza='entrada', referencia_tipo='preparacion')), name='inventario_movimiento_tipo_valido'),
        ]

    @property
    def codigo(self):
        return f'MOV-{self.pk:06d}'


class DetalleMovimientoInventario(models.Model):
    movimiento = models.ForeignKey(MovimientoInventario, on_delete=models.PROTECT, related_name='detalles')
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='movimientos')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT, related_name='movimientos_inventario')
    unidad = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT, related_name='movimientos_inventario')
    cantidad = models.DecimalField(max_digits=14, decimal_places=3)

    class Meta:
        db_table = 'detalles_movimientos_inventario'
        default_permissions = ()
        ordering = ['pk']
        constraints = [
            models.UniqueConstraint(fields=['movimiento', 'lote'], name='inventario_movimiento_lote_unico'),
            models.CheckConstraint(condition=Q(cantidad__gt=0), name='inventario_cantidad_positiva'),
        ]
