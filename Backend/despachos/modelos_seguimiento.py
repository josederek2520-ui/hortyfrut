"""Evidencia del seguimiento consentido por viaje y sesión móvil."""
from django.conf import settings
from django.db import models
from django.db.models import Q


class SesionSeguimiento(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    despacho = models.ForeignKey('despachos.Despacho', on_delete=models.PROTECT, related_name='seguimientos')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    sesion_movil = models.ForeignKey('usuarios.SesionMovil', on_delete=models.PROTECT, related_name='seguimientos')
    version_inicio = models.CharField(max_length=64)
    iniciada_en = models.DateTimeField(auto_now_add=True)
    vence_en = models.DateTimeField()
    cerrada_en = models.DateTimeField(null=True, blank=True)
    motivo_cierre = models.CharField(max_length=30, blank=True)
    ultima_recepcion_en = models.DateTimeField(null=True, blank=True)
    ultima_posicion = models.ForeignKey('despachos.PosicionSeguimiento', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        db_table = 'sesiones_seguimiento'
        default_permissions = ()
        ordering = ['-iniciada_en', '-pk']
        constraints = [
            models.UniqueConstraint(fields=['despacho'], condition=Q(cerrada_en__isnull=True), name='seguimiento_activo_por_viaje'),
            models.CheckConstraint(condition=Q(cerrada_en__isnull=True, motivo_cierre='') | (Q(cerrada_en__isnull=False) & ~Q(motivo_cierre='')), name='seguimiento_cierre_coherente'),
        ]


class LotePosiciones(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    sesion = models.ForeignKey(SesionSeguimiento, on_delete=models.PROTECT, related_name='lotes')
    huella = models.CharField(max_length=64)
    recibido_en = models.DateTimeField(auto_now_add=True)
    cantidad_nueva = models.PositiveSmallIntegerField()

    class Meta:
        db_table = 'lotes_posiciones'
        default_permissions = ()


class PosicionSeguimiento(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    sesion = models.ForeignKey(SesionSeguimiento, on_delete=models.PROTECT, related_name='posiciones')
    lote = models.ForeignKey(LotePosiciones, on_delete=models.PROTECT, related_name='posiciones')
    latitud = models.DecimalField(max_digits=10, decimal_places=7)
    longitud = models.DecimalField(max_digits=10, decimal_places=7)
    precision_m = models.DecimalField(max_digits=8, decimal_places=2)
    velocidad_m_s = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    rumbo = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    capturada_en = models.DateTimeField()
    recibida_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'posiciones_seguimiento'
        default_permissions = ()
        ordering = ['-capturada_en', '-pk']
        indexes = [models.Index(fields=['sesion', '-capturada_en'], name='posicion_sesion_fecha')]
        constraints = [models.CheckConstraint(condition=Q(latitud__gte=-90, latitud__lte=90,
            longitud__gte=-180, longitud__lte=180, precision_m__gte=0, precision_m__lte=100), name='posicion_coordenadas_validas')]
