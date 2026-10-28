from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim


class Cajilla(models.Model):
    color = models.CharField(max_length=60)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='colores_cajillas_creados')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_creacion = models.CharField(max_length=64, editable=False)

    class Meta:
        db_table = 'cajillas'
        ordering = ['color', 'pk']
        default_permissions = ('view', 'add')
        permissions = [
            ('registrar_ingreso', 'Registrar ingresos de cajillas'),
            ('registrar_salida', 'Registrar salidas de cajillas'),
            ('registrar_devolucion', 'Registrar devoluciones de cajillas'),
        ]
        constraints = [
            models.UniqueConstraint(Lower('color'), name='cajilla_color_unico_ci'),
            models.CheckConstraint(condition=~Q(color='') & Q(color=Trim('color')), name='cajilla_color_valido'),
        ]


class MovimientoCajilla(models.Model):
    class Tipo(models.TextChoices):
        INICIAL = 'inicial', 'Existencias iniciales'
        INGRESO = 'ingreso', 'Ingreso'
        SALIDA = 'salida', 'Salida a sucursal'
        DEVOLUCION = 'devolucion', 'Devolución de sucursal'

    cajilla = models.ForeignKey(Cajilla, on_delete=models.PROTECT, related_name='movimientos')
    color = models.CharField(max_length=60)
    tipo = models.CharField(max_length=12, choices=Tipo.choices)
    cantidad = models.PositiveIntegerField()
    almacen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT, related_name='movimientos_cajillas')
    almacen_nombre = models.CharField(max_length=150)
    sucursal = models.ForeignKey('clientes.Sucursal', on_delete=models.PROTECT, null=True, blank=True, related_name='movimientos_cajillas')
    sucursal_nombre = models.CharField(max_length=150, blank=True)
    cliente_nombre = models.CharField(max_length=150, blank=True)
    observaciones = models.CharField(max_length=500, blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='movimientos_cajillas_registrados')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_operacion = models.CharField(max_length=64, editable=False)

    class Meta:
        db_table = 'movimientos_cajilla'
        ordering = ['-creado_en', '-pk']
        default_permissions = ()
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gte=1, cantidad__lte=2147483647), name='cajilla_cantidad_positiva'),
            models.CheckConstraint(condition=(Q(tipo__in=['inicial', 'ingreso'], sucursal__isnull=True) |
                                              Q(tipo__in=['salida', 'devolucion'], sucursal__isnull=False)), name='cajilla_movimiento_destino_valido'),
            models.UniqueConstraint(fields=['cajilla'], condition=Q(tipo='inicial'), name='cajilla_un_saldo_inicial'),
        ]
        indexes = [models.Index(fields=['cajilla', 'almacen']), models.Index(fields=['cajilla', 'sucursal'])]

    @property
    def codigo(self):
        return f'CAJ-{self.pk:06d}'
