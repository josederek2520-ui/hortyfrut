from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models


class ActividadRol(models.Model):
    rol = models.ForeignKey(Group, null=True, on_delete=models.SET_NULL, related_name='actividad_roles')
    nombre_rol = models.CharField(max_length=150)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='actividad_roles')
    accion = models.CharField(max_length=20)
    cambios = models.JSONField(default=dict)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', '-pk']
        default_permissions = ()
