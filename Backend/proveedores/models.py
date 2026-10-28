from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from clientes.validadores import validar_digitos


class Proveedor(models.Model):
    nombre = models.CharField(max_length=150)
    categoria = models.ForeignKey('catalogos.CategoriaProducto', on_delete=models.PROTECT,
                                  null=True, blank=True, related_name='proveedores')
    telefono = models.CharField(max_length=30, blank=True, validators=[validar_digitos])
    direccion = models.CharField(max_length=255, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'proveedores'
        ordering = ['nombre', 'pk']
        verbose_name = 'proveedor'
        verbose_name_plural = 'proveedores'
        default_permissions = ('view', 'add', 'change')
        permissions = [('cambiar_estado_proveedor', 'Activar o desactivar proveedores')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), name='proveedor_nombre_unico_ci'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='proveedor_nombre_valido'),
            models.CheckConstraint(condition=Q(telefono='') | Q(telefono__regex=r'^[0-9]+$'), name='proveedor_telefono_digitos'),
        ]

    def __str__(self):
        return self.nombre
