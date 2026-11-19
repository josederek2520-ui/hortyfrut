from django.conf import settings
from django.db import models


class DatosEmpresa(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    razon_social = models.CharField(max_length=150, blank=True)
    nit = models.CharField(max_length=20, blank=True)
    direccion = models.CharField(max_length=250, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    ciudad = models.CharField(max_length=100, blank=True)
    logo_base64 = models.TextField(blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'datos_empresa'
        default_permissions = ('view', 'change')
        constraints = [models.CheckConstraint(condition=models.Q(pk=1), name='empresa_unica')]


class OperacionEmpresa(models.Model):
    clave_operacion = models.UUIDField(unique=True)
    huella = models.CharField(max_length=64)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_empresa'
        default_permissions = ()
