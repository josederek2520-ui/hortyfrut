from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim


class Almacen(models.Model):
    nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255)
    latitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'almacenes'
        ordering = ['nombre', 'pk']
        verbose_name = 'almacén'
        verbose_name_plural = 'almacenes'
        default_permissions = ('view', 'add', 'change')
        permissions = [('cambiar_estado_almacen', 'Activar o desactivar almacenes')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), name='almacen_nombre_unico_ci'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='almacen_nombre_valido'),
            models.CheckConstraint(condition=~Q(direccion='') & Q(direccion=Trim('direccion')), name='almacen_direccion_valida'),
            models.CheckConstraint(condition=Q(latitud__isnull=True, longitud__isnull=True) | Q(
                latitud__isnull=False, longitud__isnull=False, latitud__gte=-90, latitud__lte=90,
                longitud__gte=-180, longitud__lte=180), name='almacen_coordenadas_validas'),
        ]

    def __str__(self):
        return self.nombre
