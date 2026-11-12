from django.conf import settings
from django.db import models
from django.db.models import Q


class Venta(models.Model):
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.PROTECT, related_name='ventas')
    cliente_nombre = models.CharField(max_length=150)
    cliente_nit = models.CharField(max_length=20)
    estado = models.CharField(max_length=12, default='borrador', choices=[('borrador', 'Borrador'), ('emitida', 'Emitida'), ('cancelada', 'Cancelada')])
    desde = models.DateField()
    hasta = models.DateField()
    fecha_emision = models.DateField(null=True, blank=True)
    vencimiento = models.DateField(null=True, blank=True)
    total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    peso_aceptado_kg = models.DecimalField(max_digits=18, decimal_places=3, default=0)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    registrado_por_nombre = models.CharField(max_length=200)
    emitido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    emitido_por_nombre = models.CharField(max_length=200, blank=True)
    emitido_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ventas'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('emitir_venta', 'Emitir resúmenes de venta'), ('cancelar_venta', 'Cancelar borradores de venta'), ('descargar_venta', 'Descargar resúmenes de venta')]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'emitida', 'cancelada']), name='venta_estado_valido'),
            models.CheckConstraint(condition=Q(hasta__gte=models.F('desde')), name='venta_periodo_valido'),
            models.CheckConstraint(condition=Q(total__gte=0, peso_aceptado_kg__gte=0), name='venta_totales_validos'),
            models.CheckConstraint(condition=(Q(estado='emitida', emitido_en__isnull=False, fecha_emision__isnull=False, total__gt=0) | Q(estado__in=['borrador', 'cancelada'], emitido_en__isnull=True, fecha_emision__isnull=True)), name='venta_emision_valida'),
        ]

    @property
    def codigo(self):
        return f'VEN-{self.pk:06d}'


class SeleccionVenta(models.Model):
    """Elegir o guardar un borrador no reserva una entrega."""
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='selecciones')
    entrega = models.ForeignKey('entregas.Entrega', on_delete=models.PROTECT)

    class Meta:
        db_table = 'selecciones_venta'
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['venta', 'entrega'], name='venta_seleccion_unica')]


class EntregaVenta(models.Model):
    """La unicidad física impide emitir la misma entrega desde dos documentos."""
    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name='entregas_emitidas')
    entrega = models.OneToOneField('entregas.Entrega', on_delete=models.PROTECT, related_name='venta_emitida')

    class Meta:
        db_table = 'entregas_venta'
        default_permissions = ()


class LineaVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name='lineas')
    linea_entrega = models.OneToOneField('entregas.LineaEntrega', on_delete=models.PROTECT, related_name='linea_venta')
    precio = models.ForeignKey('precios.DetallePrecio', on_delete=models.PROTECT)
    contenido = models.JSONField()
    peso_aceptado_kg = models.DecimalField(max_digits=14, decimal_places=3)
    precio_kg = models.DecimalField(max_digits=12, decimal_places=2)
    importe = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table = 'lineas_venta'
        default_permissions = ()
        ordering = ['pk']
        constraints = [models.CheckConstraint(condition=Q(peso_aceptado_kg__gt=0, precio_kg__gt=0, importe__gte=0), name='venta_linea_importes_validos')]


class AporteVenta(models.Model):
    linea = models.ForeignKey(LineaVenta, on_delete=models.PROTECT, related_name='aportes')
    aporte = models.OneToOneField('entregas.AporteEntrega', on_delete=models.PROTECT)
    codigo_lote = models.CharField(max_length=100)
    peso_aceptado_kg = models.DecimalField(max_digits=14, decimal_places=3)
    importe = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table = 'aportes_venta'
        default_permissions = ()
        constraints = [models.CheckConstraint(condition=Q(peso_aceptado_kg__gt=0, importe__gte=0), name='venta_aporte_importes_validos')]


class OperacionVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.PROTECT, related_name='operaciones')
    clave_operacion = models.UUIDField(unique=True)
    huella = models.CharField(max_length=64)
    accion = models.CharField(max_length=20)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_venta'
        default_permissions = ()
