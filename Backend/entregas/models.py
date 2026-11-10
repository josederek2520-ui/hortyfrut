from django.conf import settings
from django.db import models
from django.db.models import Q, F


class Entrega(models.Model):
    despacho = models.ForeignKey('despachos.Despacho', on_delete=models.PROTECT)
    pedido = models.ForeignKey('pedidos.Pedido', on_delete=models.PROTECT, related_name='entregas')
    parada = models.ForeignKey('despachos.ParadaDespacho', on_delete=models.PROTECT)
    estado = models.CharField(max_length=12, default='borrador', choices=[('borrador', 'Borrador'), ('revision', 'En revisión'), ('confirmada', 'Confirmada')])
    origen = models.JSONField()
    fecha_recepcion = models.DateField(null=True, blank=True)
    recibido_por = models.CharField(max_length=200, blank=True)
    recibido_por_usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    responsable_nombre = models.CharField(max_length=200)
    actualizado_en = models.DateTimeField(auto_now=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    enviado_en = models.DateTimeField(null=True, blank=True)
    confirmado_en = models.DateTimeField(null=True, blank=True)
    confirmado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    confirmado_por_nombre = models.CharField(max_length=200, blank=True)
    comprobante = models.CharField(max_length=100, blank=True)
    comprobante_tipo = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'entregas'
        default_permissions = ('view', 'add', 'change')
        permissions = [('enviar_entrega', 'Enviar recepción a revisión'), ('confirmar_entrega', 'Confirmar entregas'),
                       ('ver_todas_entregas', 'Consultar entregas de todas las sucursales'),
                       ('gestionar_todas_entregas', 'Gestionar entregas de todas las sucursales')]
        constraints = [models.UniqueConstraint(fields=['despacho', 'pedido'], name='entrega_viaje_pedido_unica'),
                       models.CheckConstraint(condition=Q(estado__in=['borrador', 'revision', 'confirmada']), name='entrega_estado_valido'),
                       models.CheckConstraint(condition=Q(estado='confirmada', confirmado_en__isnull=False) | Q(estado__in=['borrador', 'revision'], confirmado_en__isnull=True), name='entrega_confirmacion_valida')]

    @property
    def codigo(self):
        return f'ENT-{self.pk:06d}'


class LineaEntrega(models.Model):
    entrega = models.ForeignKey(Entrega, on_delete=models.CASCADE, related_name='lineas')
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT)
    cajas_recibidas = models.PositiveIntegerField(null=True, blank=True)
    unidades_recibidas = models.PositiveIntegerField(null=True, blank=True)
    peso_recibido_kg = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    cajas_rechazadas = models.PositiveIntegerField(default=0)
    unidades_rechazadas = models.PositiveIntegerField(default=0)
    peso_rechazado_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    motivo_rechazo = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'lineas_entrega'
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['entrega', 'producto'], name='entrega_producto_unico'),
                       models.CheckConstraint(condition=Q(cajas_recibidas__isnull=True) | Q(cajas_rechazadas__lte=F('cajas_recibidas')), name='entrega_cajas_rechazo_valido'),
                       models.CheckConstraint(condition=Q(unidades_recibidas__isnull=True) | Q(unidades_rechazadas__lte=F('unidades_recibidas')), name='entrega_unidades_rechazo_valido'),
                       models.CheckConstraint(condition=Q(peso_recibido_kg__isnull=True) | Q(peso_recibido_kg__gte=0), name='entrega_recibido_no_negativo'),
                       models.CheckConstraint(condition=Q(peso_rechazado_kg__gte=0) & (Q(peso_recibido_kg__isnull=True) | Q(peso_rechazado_kg__lte=F('peso_recibido_kg'))), name='entrega_rechazo_valido')]


class AporteEntrega(models.Model):
    entrega = models.ForeignKey(Entrega, on_delete=models.CASCADE, related_name='aportes')
    carga = models.ForeignKey('despachos.CargaDespacho', on_delete=models.PROTECT)
    lote = models.ForeignKey('inventario.Lote', on_delete=models.PROTECT)
    peso_recibido_kg = models.DecimalField(max_digits=14, decimal_places=3)
    peso_rechazado_kg = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        db_table = 'aportes_entrega'
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['entrega', 'carga', 'lote'], name='entrega_aporte_unico'),
                       models.CheckConstraint(condition=Q(peso_recibido_kg__gte=0, peso_rechazado_kg__gte=0) & Q(peso_rechazado_kg__lte=F('peso_recibido_kg')), name='entrega_aporte_pesos_validos')]


class OperacionEntrega(models.Model):
    entrega = models.ForeignKey(Entrega, on_delete=models.PROTECT, related_name='operaciones')
    clave_operacion = models.UUIDField(unique=True)
    accion = models.CharField(max_length=30)
    huella = models.CharField(max_length=64)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_entrega'
        default_permissions = ()
