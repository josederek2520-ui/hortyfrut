import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q, F


class AcuerdoPrecio(models.Model):
    familia = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.PROTECT, related_name='acuerdos_precios')
    cliente_nombre = models.CharField(max_length=150)
    alcance = models.CharField(max_length=12, choices=[('periodo', 'Por fechas'), ('entregas', 'Entregas específicas')], default='periodo')
    desde = models.DateField(null=True, blank=True)
    hasta = models.DateField(null=True, blank=True)
    referencia_propuesta = models.CharField(max_length=150, blank=True)
    estado = models.CharField(max_length=12, default='borrador', choices=[('borrador', 'Borrador'), ('propuesta', 'Pendiente de aceptación'),
        ('aceptado', 'Aceptado'), ('rechazado', 'Rechazado'), ('cancelado', 'Cancelado')])
    anterior = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='versiones')
    numero_version = models.PositiveIntegerField(default=1)
    motivo_version = models.CharField(max_length=500, blank=True)
    motivo_rechazo = models.CharField(max_length=500, blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    registrado_por_nombre = models.CharField(max_length=200)
    propuesto_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    propuesto_por_nombre = models.CharField(max_length=200, blank=True)
    propuesto_en = models.DateTimeField(null=True, blank=True)
    revisado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    revisado_por_nombre = models.CharField(max_length=200, blank=True)
    revisado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'acuerdos_precios'
        default_permissions = ('view', 'add', 'change')
        permissions = [('presentar_acuerdoprecio', 'Registrar propuestas del supermercado'),
            ('aceptar_acuerdoprecio', 'Aceptar precios en nombre de HortyFru'),
            ('rechazar_acuerdoprecio', 'Rechazar propuestas de precios'), ('cancelar_acuerdoprecio', 'Cancelar borradores de precios')]
        ordering = ['-creado_en', '-pk']
        indexes = [models.Index(fields=['cliente', 'estado'], name='precios_cliente_estado')]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'propuesta', 'aceptado', 'rechazado', 'cancelado']), name='precio_estado_valido'),
            models.CheckConstraint(condition=Q(alcance__in=['periodo', 'entregas']), name='precio_alcance_valido'),
            models.CheckConstraint(condition=Q(desde__isnull=True) | Q(hasta__isnull=True) | Q(hasta__gte=F('desde')), name='precio_fechas_ordenadas'),
            models.CheckConstraint(condition=(Q(estado__in=['borrador', 'cancelado'], propuesto_en__isnull=True, revisado_en__isnull=True) |
                Q(estado='propuesta', propuesto_en__isnull=False, revisado_en__isnull=True) |
                Q(estado__in=['aceptado', 'rechazado'], propuesto_en__isnull=False, revisado_en__isnull=False)), name='precio_revision_estado'),
            models.UniqueConstraint(fields=['anterior'], condition=Q(estado='aceptado'), name='precio_sucesor_aceptado_unico'),
        ]

    @property
    def codigo(self):
        return f'PRE-{self.pk:06d}'


class DetallePrecio(models.Model):
    acuerdo = models.ForeignKey(AcuerdoPrecio, on_delete=models.CASCADE, related_name='lineas')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT)
    producto_nombre = models.CharField(max_length=100)
    categoria_nombre = models.CharField(max_length=100)
    precio_kg = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'detalles_acuerdos_precios'
        default_permissions = ()
        ordering = ['producto_nombre', 'producto_id']
        constraints = [models.UniqueConstraint(fields=['acuerdo', 'producto'], name='precio_producto_unico'),
            models.CheckConstraint(condition=Q(precio_kg__isnull=True) | Q(precio_kg__gt=0), name='precio_positivo')]


class EntregaPrecio(models.Model):
    acuerdo = models.ForeignKey(AcuerdoPrecio, on_delete=models.CASCADE, related_name='entregas')
    entrega = models.ForeignKey('entregas.Entrega', on_delete=models.PROTECT)

    class Meta:
        db_table = 'entregas_acuerdos_precios'
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['acuerdo', 'entrega'], name='precio_entrega_unica')]


class OperacionPrecio(models.Model):
    acuerdo = models.ForeignKey(AcuerdoPrecio, on_delete=models.PROTECT, related_name='operaciones')
    clave_operacion = models.UUIDField(unique=True)
    huella = models.CharField(max_length=64)
    accion = models.CharField(max_length=20)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_precios'
        default_permissions = ()
