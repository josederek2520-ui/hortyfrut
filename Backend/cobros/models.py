from django.conf import settings
from django.db import models


class Cobro(models.Model):
    clave_operacion = models.UUIDField(unique=True)
    huella = models.CharField(max_length=64)
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.PROTECT, related_name='cobros')
    cliente_nombre = models.CharField(max_length=150)
    cliente_nit = models.CharField(max_length=20)
    fecha_cobro = models.DateField()
    importe = models.DecimalField(max_digits=18, decimal_places=2)
    medio = models.CharField(max_length=20, choices=[('efectivo', 'Efectivo'), ('transferencia', 'Transferencia'),
        ('deposito', 'Depósito'), ('cheque', 'Cheque'), ('otro', 'Otro')])
    referencia = models.CharField(max_length=150, blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    registrado_por_nombre = models.CharField(max_length=200)
    registrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cobros'
        default_permissions = ('view', 'add')
        ordering = ['-registrado_en', '-pk']
        constraints = [models.CheckConstraint(condition=models.Q(importe__gt=0), name='cobro_positivo'),
            models.CheckConstraint(condition=models.Q(medio__in=['efectivo', 'transferencia', 'deposito', 'cheque', 'otro']), name='cobro_medio_valido')]

    @property
    def codigo(self):
        return f'COB-{self.pk:06d}'


class ComprobanteCobro(models.Model):
    cobro = models.OneToOneField(Cobro, primary_key=True, on_delete=models.PROTECT, related_name='archivo_comprobante')
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=50)
    tamano = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    contenido = models.BinaryField(editable=False)

    class Meta:
        db_table = 'comprobantes_cobros'
        default_permissions = ()
        constraints = [models.CheckConstraint(condition=models.Q(tamano__gt=0, tamano__lte=8 * 1024 * 1024), name='comprobante_cobro_tamano'),
            models.CheckConstraint(condition=models.Q(tipo__in=['image/jpeg', 'image/png', 'image/webp', 'application/pdf']), name='comprobante_cobro_tipo')]


class AplicacionCobro(models.Model):
    cobro = models.ForeignKey(Cobro, on_delete=models.PROTECT, related_name='aplicaciones')
    venta = models.ForeignKey('ventas.Venta', on_delete=models.PROTECT, related_name='aplicaciones_cobro')
    venta_codigo = models.CharField(max_length=30)
    importe = models.DecimalField(max_digits=18, decimal_places=2)
    saldo_anterior = models.DecimalField(max_digits=18, decimal_places=2)
    saldo_posterior = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table = 'aplicaciones_cobros'
        default_permissions = ()
        ordering = ['pk']
        constraints = [models.UniqueConstraint(fields=['cobro', 'venta'], name='cobro_venta_unica'),
            models.CheckConstraint(condition=models.Q(importe__gt=0, saldo_posterior__gte=0, saldo_anterior__gte=models.F('importe')), name='cobro_aplicacion_valida'),
            models.CheckConstraint(condition=models.Q(saldo_posterior=models.F('saldo_anterior') - models.F('importe')), name='cobro_saldos_exactos')]
