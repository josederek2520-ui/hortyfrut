import uuid
from django.conf import settings
from django.db import models


class AvisoPago(models.Model):
    clave_operacion = models.UUIDField(unique=True)
    huella = models.CharField(max_length=64)
    clave_cobro = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    version = models.UUIDField(default=uuid.uuid4, editable=False)
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.PROTECT, related_name='pagos_informados')
    cliente_nombre = models.CharField(max_length=150)
    cliente_nit = models.CharField(max_length=20)
    fecha_pago = models.DateField()
    importe = models.DecimalField(max_digits=18, decimal_places=2)
    medio = models.CharField(max_length=20, choices=[('transferencia', 'Transferencia'), ('deposito', 'Depósito')])
    estado = models.CharField(max_length=20, default='por_verificar', choices=[('por_verificar', 'Por verificar'), ('confirmado', 'Confirmado'), ('observado', 'Observado')])
    informado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='pagos_informados')
    informado_por_nombre = models.CharField(max_length=200)
    informado_en = models.DateTimeField(auto_now_add=True)
    revisado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='pagos_verificados')
    revisado_por_nombre = models.CharField(max_length=200, blank=True)
    revisado_en = models.DateTimeField(null=True)
    motivo_observacion = models.CharField(max_length=1000, blank=True)
    cobro = models.OneToOneField('cobros.Cobro', null=True, on_delete=models.PROTECT, related_name='aviso_pago')

    class Meta:
        db_table = 'avisos_pagos'
        default_permissions = ('view',)
        permissions = [('consultar_pagos_propios', 'Consultar pagos de supermercados asignados'),
            ('informar_pagos_propios', 'Informar pagos de supermercados asignados'),
            ('confirmar_avisopago', 'Confirmar recepción de pagos informados'), ('observar_avisopago', 'Observar pagos informados')]
        ordering = ['-informado_en', '-pk']
        constraints = [models.CheckConstraint(condition=models.Q(importe__gt=0), name='aviso_pago_positivo'),
            models.CheckConstraint(condition=models.Q(medio__in=['transferencia', 'deposito']), name='aviso_pago_medio'),
            models.CheckConstraint(condition=(models.Q(estado='confirmado', cobro__isnull=False, revisado_en__isnull=False) |
                models.Q(estado='por_verificar', cobro__isnull=True, revisado_en__isnull=True) |
                (models.Q(estado='observado', cobro__isnull=True, revisado_en__isnull=False) & ~models.Q(motivo_observacion=''))), name='aviso_pago_estado')]

    @property
    def codigo(self):
        return f'PAG-{self.pk:06d}'


class AplicacionAvisoPago(models.Model):
    aviso = models.ForeignKey(AvisoPago, on_delete=models.PROTECT, related_name='aplicaciones')
    venta = models.ForeignKey('ventas.Venta', on_delete=models.PROTECT, related_name='pagos_informados')
    venta_codigo = models.CharField(max_length=30)
    importe = models.DecimalField(max_digits=18, decimal_places=2)
    saldo_informado = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table = 'aplicaciones_avisos_pagos'
        default_permissions = ()
        ordering = ['pk']
        constraints = [models.UniqueConstraint(fields=['aviso', 'venta'], name='aviso_pago_venta_unica'),
            models.CheckConstraint(condition=models.Q(importe__gt=0, saldo_informado__gte=models.F('importe')), name='aviso_pago_aplicacion')]


class ComprobanteAvisoPago(models.Model):
    aviso = models.OneToOneField(AvisoPago, primary_key=True, on_delete=models.PROTECT, related_name='archivo_comprobante')
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=50)
    tamano = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    contenido = models.BinaryField(editable=False)

    class Meta:
        db_table = 'comprobantes_avisos_pagos'
        default_permissions = ()
        constraints = [models.CheckConstraint(condition=models.Q(tamano__gt=0, tamano__lte=8 * 1024 * 1024), name='comprobante_aviso_tamano'),
            models.CheckConstraint(condition=models.Q(tipo__in=['image/jpeg', 'image/png', 'image/webp', 'application/pdf']), name='comprobante_aviso_tipo')]


class OperacionPago(models.Model):
    clave_operacion = models.UUIDField(unique=True)
    aviso = models.ForeignKey(AvisoPago, on_delete=models.PROTECT, related_name='operaciones')
    accion = models.CharField(max_length=20)
    huella = models.CharField(max_length=64)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    registrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_avisos_pagos'
        default_permissions = ()
