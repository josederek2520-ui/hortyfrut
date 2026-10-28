from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from .validadores import normalizar_nombre, normalizar_abreviatura


class CatalogoBase(models.Model):
    nombre = models.CharField(max_length=100)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['nombre', 'pk']
        default_permissions = ('view', 'add', 'change')

    def __str__(self):
        return self.nombre

    def clean(self):
        super().clean()
        try:
            self.nombre = normalizar_nombre(self.nombre)
        except ValidationError as error:
            raise ValidationError({'nombre': error.messages}) from error

    def save(self, *args, **kwargs):
        self.nombre = normalizar_nombre(self.nombre)
        return super().save(*args, **kwargs)


class UnidadMedida(CatalogoBase):
    abreviatura = models.CharField(max_length=10)

    class Meta(CatalogoBase.Meta):
        abstract = False
        db_table = 'unidades_medida'
        verbose_name = 'unidad de medida'
        verbose_name_plural = 'unidades de medida'
        permissions = [('cambiar_estado_unidadmedida', 'Activar o desactivar unidades de medida')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), name='unidad_nombre_unico_ci'),
            models.UniqueConstraint(fields=['abreviatura'], name='unidad_abreviatura_unica'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='unidad_nombre_valido'),
            models.CheckConstraint(condition=~Q(abreviatura='') & ~Q(abreviatura__regex=r'\s'), name='unidad_abreviatura_valida'),
        ]

    def clean(self):
        super().clean()
        try:
            self.abreviatura = normalizar_abreviatura(self.abreviatura)
        except ValidationError as error:
            raise ValidationError({'abreviatura': error.messages}) from error

    def save(self, *args, **kwargs):
        self.abreviatura = normalizar_abreviatura(self.abreviatura)
        return super().save(*args, **kwargs)


class CategoriaProducto(CatalogoBase):
    class Meta(CatalogoBase.Meta):
        abstract = False
        db_table = 'categorias_productos'
        verbose_name = 'categoría de productos'
        verbose_name_plural = 'categorías de productos'
        permissions = [('cambiar_estado_categoriaproducto', 'Activar o desactivar categorías de productos')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), name='categoria_nombre_unico_ci'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='categoria_nombre_valido'),
        ]
