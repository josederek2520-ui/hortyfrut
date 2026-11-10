from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Upper, Trim


class Vehiculo(models.Model):
    placa = models.CharField(max_length=20)
    tipo = models.CharField(max_length=60)
    marca = models.CharField(max_length=100, blank=True)
    capacidad_kg = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    imagen = models.ImageField(upload_to='vehiculos/', blank=True)
    activo = models.BooleanField(default=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='vehiculos_creados')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vehiculos'
        ordering = ['placa', 'pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('cambiar_estado_vehiculo', 'Activar o desactivar vehículos')]
        constraints = [
            models.UniqueConstraint(Upper('placa'), name='vehiculo_placa_unica'),
            models.CheckConstraint(condition=~Q(placa='') & Q(placa=Upper(Trim('placa'))), name='vehiculo_placa_valida'),
            models.CheckConstraint(condition=~Q(tipo=''), name='vehiculo_tipo_valido'),
            models.CheckConstraint(condition=Q(capacidad_kg__isnull=True) | Q(capacidad_kg__gt=0), name='vehiculo_capacidad_positiva'),
        ]

    def __str__(self):
        return self.placa
