from django.conf import settings
from django.db import models
from django.db.models import F, Q


class BuzonChat(models.Model):
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE)
    revision = models.PositiveBigIntegerField(default=0)

    class Meta:
        default_permissions = ()


class Conversacion(models.Model):
    usuario_menor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    usuario_mayor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now_add=True)
    ultimo_mensaje = models.ForeignKey('Mensaje', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['usuario_menor', 'usuario_mayor'], name='chat_par_usuarios_unico'),
            models.CheckConstraint(condition=Q(usuario_menor__lt=F('usuario_mayor')), name='chat_participantes_distintos_ordenados')]
        indexes = [models.Index(fields=['usuario_menor', '-actualizada_en']), models.Index(fields=['usuario_mayor', '-actualizada_en'])]


class Mensaje(models.Model):
    conversacion = models.ForeignKey(Conversacion, on_delete=models.PROTECT, related_name='mensajes')
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    clave_cliente = models.UUIDField(unique=True, editable=False)
    texto = models.CharField(max_length=2000)
    creado_en = models.DateTimeField(auto_now_add=True)
    leido_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        default_permissions = ()
        ordering = ['-pk']
        indexes = [models.Index(fields=['conversacion', '-id']), models.Index(fields=['autor', 'creado_en'])]
