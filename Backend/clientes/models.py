from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from .validadores import normalizar_texto, validar_digitos


class RegistroComercial(models.Model):
    telefono = models.CharField(max_length=30, blank=True, validators=[validar_digitos])
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        default_permissions = ('view', 'add', 'change')

    def clean(self):
        super().clean()
        self.telefono = (self.telefono or '').strip()


class Cliente(RegistroComercial):
    razon_social = models.CharField(max_length=150)
    nit = models.CharField(max_length=20, validators=[validar_digitos])
    email = models.EmailField(max_length=150, blank=True)

    class Meta(RegistroComercial.Meta):
        abstract = False
        db_table = 'clientes'
        ordering = ['razon_social', 'pk']
        verbose_name = 'cliente'
        verbose_name_plural = 'clientes'
        permissions = [('cambiar_estado_cliente', 'Activar o desactivar clientes')]
        constraints = [
            models.UniqueConstraint(fields=['nit'], name='cliente_nit_unico'),
            models.CheckConstraint(condition=~Q(razon_social='') & Q(razon_social=Trim('razon_social')), name='cliente_razon_social_valida'),
            models.CheckConstraint(condition=Q(nit__regex=r'^[0-9]+$'), name='cliente_nit_digitos'),
            models.CheckConstraint(condition=Q(telefono='') | Q(telefono__regex=r'^[0-9]+$'), name='cliente_telefono_digitos'),
            models.CheckConstraint(condition=Q(email=Lower(Trim('email'))), name='cliente_email_normalizado'),
        ]

    def __str__(self):
        return self.razon_social

    def clean(self):
        super().clean()
        self.razon_social = normalizar_texto(self.razon_social)
        self.nit = (self.nit or '').strip()
        self.email = (self.email or '').strip().lower()
        if not self.razon_social:
            raise ValidationError({'razon_social': 'Ingresa la razón social del cliente.'})


class Sucursal(RegistroComercial):
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name='sucursales')
    encargado_pedidos = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sucursales_asignadas')
    nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255)
    referencia = models.CharField(max_length=255, blank=True)
    latitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    class Meta(RegistroComercial.Meta):
        abstract = False
        db_table = 'sucursales'
        ordering = ['nombre', 'pk']
        verbose_name = 'sucursal'
        verbose_name_plural = 'sucursales'
        permissions = [('cambiar_estado_sucursal', 'Activar o desactivar sucursales'), ('asignar_encargado', 'Asignar encargado de pedidos')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), 'cliente', name='sucursal_nombre_unico_cliente'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='sucursal_nombre_valido'),
            models.CheckConstraint(condition=~Q(direccion='') & Q(direccion=Trim('direccion')), name='sucursal_direccion_valida'),
            models.CheckConstraint(condition=Q(telefono='') | Q(telefono__regex=r'^[0-9]+$'), name='sucursal_telefono_digitos'),
            models.CheckConstraint(condition=Q(latitud__isnull=True, longitud__isnull=True) | Q(
                latitud__isnull=False, longitud__isnull=False, latitud__gte=-90, latitud__lte=90,
                longitud__gte=-180, longitud__lte=180), name='sucursal_coordenadas_validas'),
        ]

    def __str__(self):
        return self.nombre

    def clean(self):
        super().clean()
        self.nombre = normalizar_texto(self.nombre)
        self.direccion = normalizar_texto(self.direccion)
        self.referencia = normalizar_texto(self.referencia)
        errores = {}
        for campo in ('nombre', 'direccion'):
            if not getattr(self, campo):
                errores[campo] = 'Este campo es obligatorio.'
        if (self.latitud is None) != (self.longitud is None):
            errores.update({campo: 'Completa ambas coordenadas o deja ambas vacías.' for campo in ('latitud', 'longitud')})
        for campo, limite in (('latitud', 90), ('longitud', 180)):
            valor = getattr(self, campo)
            if valor is not None:
                if not isinstance(valor, Decimal) or not valor.is_finite() or not -limite <= valor <= limite:
                    errores[campo] = f'Ingresa un número entre {-limite} y {limite}.'
                elif valor == 0:
                    setattr(self, campo, Decimal('0'))
        if errores:
            raise ValidationError(errores)
