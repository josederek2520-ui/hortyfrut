import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q
from .nombres import nombre_respaldo


class Respaldo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitud_uuid = models.UUIDField(unique=True, editable=False)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    responsable_nombre = models.CharField(max_length=200)
    nombre = models.CharField(max_length=100, unique=True)
    fecha_respaldo = models.DateField()
    consecutivo = models.PositiveIntegerField()
    estado = models.CharField(max_length=12, default='preparando', choices=[
        ('preparando', 'Preparando'), ('completado', 'Completado'), ('fallido', 'Fallido')])
    creado_en = models.DateTimeField(auto_now_add=True)
    finalizado_en = models.DateTimeField(null=True)
    vence_en = models.DateTimeField()
    tamano_bytes = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)
    error = models.CharField(max_length=250, blank=True)

    class Meta:
        db_table = 'respaldos'
        ordering = ['-creado_en', '-id']
        default_permissions = ('view', 'add')
        permissions = [('descargar_respaldo', 'Descargar respaldos completos del sistema')]
        constraints = [
            models.UniqueConstraint(fields=['fecha_respaldo', 'consecutivo'], name='respaldo_consecutivo_diario_unico'),
            models.CheckConstraint(condition=Q(consecutivo__gt=0), name='respaldo_consecutivo_positivo'),
            models.UniqueConstraint(fields=['estado'], condition=Q(estado='preparando'), name='respaldo_unico_en_preparacion'),
            models.CheckConstraint(condition=Q(estado__in=['preparando', 'completado', 'fallido']), name='respaldo_estado_valido'),
        ]

    @property
    def nombre_publico(self):
        return nombre_respaldo(self.fecha_respaldo, self.consecutivo)
