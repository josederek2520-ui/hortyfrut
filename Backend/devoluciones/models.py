from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Devolucion(models.Model):
    entrega = models.ForeignKey('entregas.Entrega', on_delete=models.PROTECT, related_name='devoluciones')
    almacen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT)
    almacen_nombre = models.CharField(max_length=150)
    cliente_nombre = models.CharField(max_length=150)
    sucursal_nombre = models.CharField(max_length=150)
    codigo_pedido = models.CharField(max_length=30)
    estado = models.CharField(max_length=12, default='borrador', choices=[
        ('borrador', 'Borrador'), ('recibida', 'Pendiente de revisión'),
        ('revisada', 'Revisada'), ('cancelada', 'Cancelada')])
    fecha_recepcion = models.DateField(null=True, blank=True)
    motivo = models.CharField(max_length=500, blank=True)
    motivo_revision = models.CharField(max_length=500, blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    responsable_nombre = models.CharField(max_length=200)
    recibido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    recibido_por_nombre = models.CharField(max_length=200, blank=True)
    recibido_en = models.DateTimeField(null=True, blank=True)
    revisado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    revisado_por_nombre = models.CharField(max_length=200, blank=True)
    revisado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    movimiento_ingreso = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    movimiento_salida_aprovechable = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    movimiento_aprovechable = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    movimiento_merma = models.OneToOneField('inventario.MovimientoInventario', on_delete=models.PROTECT, null=True, blank=True, related_name='+')

    class Meta:
        db_table = 'devoluciones'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('recibir_devolucion', 'Confirmar recepción de devoluciones'),
                       ('revisar_devolucion', 'Revisar calidad de devoluciones'),
                       ('cancelar_devolucion', 'Cancelar borradores de devolución')]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'recibida', 'revisada', 'cancelada']), name='devolucion_estado_valido'),
            models.CheckConstraint(condition=(
                Q(estado__in=['borrador', 'cancelada'], recibido_en__isnull=True, movimiento_ingreso__isnull=True, revisado_en__isnull=True,
                  movimiento_salida_aprovechable__isnull=True, movimiento_aprovechable__isnull=True, movimiento_merma__isnull=True) |
                Q(estado='recibida', recibido_en__isnull=False, movimiento_ingreso__isnull=False, revisado_en__isnull=True,
                  movimiento_salida_aprovechable__isnull=True, movimiento_aprovechable__isnull=True, movimiento_merma__isnull=True) |
                (Q(estado='revisada', recibido_en__isnull=False, movimiento_ingreso__isnull=False, revisado_en__isnull=False) &
                 (Q(movimiento_aprovechable__isnull=False) | Q(movimiento_merma__isnull=False)))), name='devolucion_movimientos_estado'),
            models.CheckConstraint(condition=Q(movimiento_aprovechable__isnull=True, movimiento_salida_aprovechable__isnull=True) |
                Q(movimiento_aprovechable__isnull=False, movimiento_salida_aprovechable__isnull=False), name='devolucion_aprovechable_pareado'),
        ]

    @property
    def codigo(self):
        return f'DEV-{self.pk:06d}'


class LineaDevolucion(models.Model):
    devolucion = models.ForeignKey(Devolucion, on_delete=models.CASCADE, related_name='lineas')
    aporte = models.ForeignKey('entregas.AporteEntrega', on_delete=models.PROTECT, related_name='devoluciones')
    cantidad_recibida = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    peso_kg_recibido = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    cantidad_aprovechable = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    cantidad_merma = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    peso_kg_aprovechable = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    peso_kg_merma = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    lote_retenido = models.OneToOneField('inventario.Lote', on_delete=models.PROTECT, null=True, blank=True, related_name='devolucion_retenida')
    lote_aprovechable = models.OneToOneField('inventario.Lote', on_delete=models.PROTECT, null=True, blank=True, related_name='devolucion_aprovechable')

    class Meta:
        db_table = 'lineas_devolucion'
        ordering = ['aporte_id', 'pk']
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['devolucion', 'aporte'], name='devolucion_aporte_unico')]
        constraints += [models.CheckConstraint(condition=Q(**{f'{campo}__isnull': True}) | Q(**{f'{campo}__gte': 0}), name=f'dev_{campo}_positivo')
            for campo in ['cantidad_recibida', 'peso_kg_recibido', 'cantidad_aprovechable', 'cantidad_merma', 'peso_kg_aprovechable', 'peso_kg_merma']]
        constraints += [
            models.CheckConstraint(condition=Q(cantidad_aprovechable__isnull=True) | Q(cantidad_merma__isnull=True) |
                Q(cantidad_recibida=F('cantidad_aprovechable') + F('cantidad_merma')), name='devolucion_revision_cantidad_exacta'),
            models.CheckConstraint(condition=Q(peso_kg_aprovechable__isnull=True) | Q(peso_kg_merma__isnull=True) |
                Q(peso_kg_recibido=F('peso_kg_aprovechable') + F('peso_kg_merma')), name='devolucion_revision_peso_exacto'),
        ]


class OperacionDevolucion(models.Model):
    devolucion = models.ForeignKey(Devolucion, on_delete=models.PROTECT, related_name='operaciones')
    clave_operacion = models.UUIDField(unique=True)
    huella = models.CharField(max_length=64)
    accion = models.CharField(max_length=30)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_devolucion'
        default_permissions = ()
