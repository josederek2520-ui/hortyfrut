import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class RegistroActividad(models.Model):
    class Resultado(models.TextChoices):
        EXITO = 'exito', 'Exitoso'
        RECHAZADO = 'rechazado', 'Rechazado'
        ERROR = 'error', 'Error'

    fecha = models.DateTimeField(default=timezone.now, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='registros_actividad')
    responsable = models.CharField(max_length=200)
    modulo = models.SlugField(max_length=64)
    accion = models.SlugField(max_length=64)
    descripcion = models.CharField(max_length=250)
    objeto_tipo = models.CharField(max_length=100, blank=True)
    objeto_id = models.CharField(max_length=64, blank=True)
    objeto_nombre = models.CharField(max_length=200, blank=True)
    resultado = models.CharField(max_length=12, choices=Resultado.choices, default=Resultado.EXITO)
    cambios = models.JSONField(default=dict)
    origen = models.CharField(max_length=20, default='sistema')
    solicitud_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    metodo = models.CharField(max_length=10, blank=True)
    ruta = models.CharField(max_length=300, blank=True)
    codigo_http = models.PositiveSmallIntegerField(null=True)
    clave_origen = models.CharField(max_length=100, null=True, unique=True)

    class Meta:
        ordering = ['-fecha', '-pk']
        default_permissions = ()
        permissions = [('ver_registroactividad', 'Ver registro de actividad')]
        verbose_name = 'registro de actividad'
        verbose_name_plural = 'registros de actividad'
        indexes = [
            models.Index(fields=['modulo', '-fecha'], name='actividad_modulo_fecha'),
            models.Index(fields=['actor', '-fecha'], name='actividad_actor_fecha'),
            models.Index(fields=['resultado', '-fecha'], name='actividad_resultado_fecha'),
        ]
