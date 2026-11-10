from django.conf import settings
from django.db import models
from django.db.models import Q
from .modelos_seguimiento import SesionSeguimiento, PosicionSeguimiento, LotePosiciones  # noqa: F401


class Despacho(models.Model):
    almacen = models.ForeignKey('almacenes.Almacen', on_delete=models.PROTECT)
    almacen_nombre = models.CharField(max_length=150)
    vehiculo = models.ForeignKey('vehiculos.Vehiculo', on_delete=models.PROTECT, related_name='despachos')
    vehiculo_placa = models.CharField(max_length=20)
    chofer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='despachos_asignados')
    chofer_nombre = models.CharField(max_length=200)
    fecha_reparto = models.DateField()
    estado = models.CharField(max_length=12, choices=[('borrador', 'Borrador'), ('en_ruta', 'En ruta'), ('finalizado', 'Finalizado'), ('cancelado', 'Cancelado')], default='borrador')
    observaciones = models.CharField(max_length=1000, blank=True)
    cajillas_automaticas = models.BooleanField(null=True, default=None)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='despachos_creados')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    salida_en = models.DateTimeField(null=True, blank=True)
    retorno_en = models.DateTimeField(null=True, blank=True)
    enviado_en = models.DateTimeField(null=True, blank=True, editable=False)
    enviado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+', editable=False)
    enviado_por_nombre = models.CharField(max_length=200, blank=True, editable=False)
    clave_operacion = models.UUIDField(unique=True, editable=False)
    huella_creacion = models.CharField(max_length=64, editable=False)

    class Meta:
        db_table = 'despachos'
        ordering = ['-creado_en', '-pk']
        default_permissions = ('view', 'add', 'change')
        permissions = [('iniciar_despacho', 'Iniciar despachos'), ('registrar_recorrido', 'Registrar llegadas y descargas'),
                       ('finalizar_despacho', 'Finalizar despachos'), ('cancelar_despacho', 'Cancelar borradores de despacho'),
                       ('conducir_despacho', 'Ser asignado como chofer'), ('enviar_despacho', 'Enviar despachos al chofer'),
                       ('ver_despachos_propios', 'Consultar despachos propios como chofer'),
                       ('operar_despachos_propios', 'Operar despachos propios como chofer')]
        constraints = [
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'en_ruta', 'finalizado', 'cancelado']), name='despacho_estado_valido'),
            models.CheckConstraint(condition=Q(estado__in=['borrador', 'cancelado'], salida_en__isnull=True, retorno_en__isnull=True) |
                Q(estado='en_ruta', salida_en__isnull=False, retorno_en__isnull=True) |
                Q(estado='finalizado', salida_en__isnull=False, retorno_en__isnull=False), name='despacho_fechas_estado'),
            models.UniqueConstraint(fields=['vehiculo'], condition=Q(estado='en_ruta'), name='despacho_vehiculo_en_ruta_unico'),
            models.UniqueConstraint(fields=['chofer'], condition=Q(estado='en_ruta'), name='despacho_chofer_en_ruta_unico'),
        ]

    @property
    def codigo(self):
        return f'DES-{self.pk:06d}'


class ParadaDespacho(models.Model):
    despacho = models.ForeignKey(Despacho, on_delete=models.CASCADE, related_name='paradas')
    sucursal = models.ForeignKey('clientes.Sucursal', on_delete=models.PROTECT)
    cliente_nombre = models.CharField(max_length=150)
    sucursal_nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255)
    orden = models.PositiveIntegerField()
    llegada_en = models.DateTimeField(null=True, blank=True)
    descargada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'paradas_despacho'
        ordering = ['orden', 'pk']
        default_permissions = ()
        constraints = [models.UniqueConstraint(fields=['despacho', 'sucursal'], name='despacho_sucursal_unica'),
                       models.UniqueConstraint(fields=['despacho', 'orden'], name='despacho_orden_unico'),
                       models.CheckConstraint(condition=Q(orden__gte=1), name='despacho_orden_positivo'),
                       models.CheckConstraint(condition=Q(descargada_en__isnull=True) | Q(llegada_en__isnull=False), name='descarga_requiere_llegada')]


class CargaDespacho(models.Model):
    despacho = models.ForeignKey(Despacho, on_delete=models.CASCADE, related_name='cargas')
    parada = models.ForeignKey(ParadaDespacho, on_delete=models.CASCADE, related_name='cargas')
    asignacion = models.ForeignKey('preparaciones.AsignacionPreparacion', on_delete=models.PROTECT, related_name='cargas_despacho')
    activa = models.BooleanField(default=True)
    contenido = models.JSONField()
    descargada_en = models.DateTimeField(null=True, blank=True, editable=False)
    responsable_descarga = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+', editable=False)
    responsable_descarga_nombre = models.CharField(max_length=200, blank=True, editable=False)

    class Meta:
        db_table = 'cargas_despacho'
        default_permissions = ()
        ordering = ['pk']
        constraints = [models.UniqueConstraint(fields=['asignacion'], condition=Q(activa=True), name='despacho_asignacion_activa_unica'),
                       models.CheckConstraint(condition=Q(descargada_en__isnull=False) | Q(responsable_descarga__isnull=True, responsable_descarga_nombre=''), name='carga_descarga_responsable_valido')]


class CajillaDespacho(models.Model):
    despacho = models.ForeignKey(Despacho, on_delete=models.CASCADE, related_name='cajillas')
    parada = models.ForeignKey(ParadaDespacho, on_delete=models.CASCADE, related_name='cajillas')
    cajilla = models.ForeignKey('cajillas.Cajilla', on_delete=models.PROTECT)
    color = models.CharField(max_length=60)
    cantidad = models.PositiveIntegerField()

    class Meta:
        db_table = 'cajillas_despacho'
        default_permissions = ()
        ordering = ['pk']
        constraints = [models.UniqueConstraint(fields=['parada', 'cajilla'], name='despacho_cajilla_destino_unico'),
                       models.CheckConstraint(condition=Q(cantidad__gte=1, cantidad__lte=2147483647), name='despacho_cajilla_cantidad_valida')]


class OperacionDespacho(models.Model):
    despacho = models.ForeignKey(Despacho, on_delete=models.PROTECT, related_name='operaciones')
    clave_operacion = models.UUIDField(unique=True)
    accion = models.CharField(max_length=30)
    huella = models.CharField(max_length=64)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'operaciones_despacho'
        ordering = ['creado_en', 'pk']
        default_permissions = ()


class PlanRutaDespacho(models.Model):
    despacho = models.ForeignKey(Despacho, on_delete=models.PROTECT, related_name='planes_ruta')
    numero = models.PositiveIntegerField()
    puntos = models.JSONField()
    geometria = models.JSONField()
    tramos = models.JSONField()
    distancia_m = models.DecimalField(max_digits=14, decimal_places=2)
    duracion_s = models.DecimalField(max_digits=14, decimal_places=2)
    huella_puntos = models.CharField(max_length=64)
    clave_operacion = models.UUIDField(unique=True)
    huella_solicitud = models.CharField(max_length=64)
    proveedor = models.CharField(max_length=30, default='OSRM')
    version_datos = models.CharField(max_length=100, blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    aprobada_en = models.DateTimeField(null=True, blank=True)
    aprobada_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    aprobada_por_nombre = models.CharField(max_length=200, blank=True)
    fijada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'planes_ruta_despacho'
        default_permissions = ()
        ordering = ['-numero']
        constraints = [
            models.UniqueConstraint(fields=['despacho', 'numero'], name='ruta_despacho_numero_unico'),
            models.UniqueConstraint(fields=['despacho'], condition=Q(fijada_en__isnull=False), name='ruta_despacho_fijada_unica'),
            models.CheckConstraint(condition=Q(numero__gte=1, distancia_m__gte=0, duracion_s__gte=0), name='ruta_despacho_metricas_validas'),
            models.CheckConstraint(condition=Q(fijada_en__isnull=True) | Q(aprobada_en__isnull=False), name='ruta_fijada_requiere_aprobacion'),
        ]


class ConsultaAlternativasRuta(models.Model):
    plan = models.ForeignKey(PlanRutaDespacho, on_delete=models.PROTECT, related_name='consultas_alternativas')
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    clave_operacion = models.UUIDField(unique=True)
    huella_solicitud = models.CharField(max_length=64)
    version_despacho = models.CharField(max_length=64)
    tramo = models.PositiveIntegerField()
    opciones = models.JSONField(default=list)
    version_datos = models.CharField(max_length=100, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    vence_en = models.DateTimeField()

    class Meta:
        db_table = 'consultas_alternativas_ruta'
        default_permissions = ()
        constraints = [models.CheckConstraint(condition=Q(tramo__gte=1), name='alternativa_tramo_positivo')]


class ConsultaGuiaChofer(models.Model):
    clave_operacion = models.UUIDField(primary_key=True, editable=False)
    sesion = models.ForeignKey('despachos.SesionSeguimiento', on_delete=models.PROTECT, related_name='consultas_guia')
    plan = models.ForeignKey(PlanRutaDespacho, on_delete=models.PROTECT, related_name='consultas_guia')
    version_despacho = models.CharField(max_length=64)
    tramo = models.PositiveIntegerField()
    huella = models.CharField(max_length=64)
    estado = models.CharField(max_length=10, default='pendiente', choices=[('pendiente', 'Pendiente'), ('lista', 'Lista'), ('error', 'Sin guía')])
    origen = models.JSONField()
    geometria = models.JSONField(default=dict)
    distancia_m = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)
    vence_en = models.DateTimeField()

    class Meta:
        db_table = 'consultas_guia_chofer'
        default_permissions = ()
        indexes = [models.Index(fields=['sesion', '-creado_en'], name='guia_sesion_fecha')]
        constraints = [models.CheckConstraint(condition=Q(tramo__gte=1), name='guia_tramo_positivo'),
            models.CheckConstraint(condition=Q(estado='pendiente', resuelto_en__isnull=True) |
                Q(estado__in=['lista', 'error'], resuelto_en__isnull=False), name='guia_estado_coherente')]


class CalculoOptimizacion(models.Model):
    despacho = models.ForeignKey(Despacho, on_delete=models.PROTECT, related_name='calculos_optimizacion')
    estado = models.CharField(max_length=12, default='pendiente', choices=[
        ('pendiente', 'Pendiente'), ('calculando', 'Calculando'), ('lista', 'Lista'),
        ('error', 'Error'), ('obsoleta', 'Obsoleta'), ('cancelada', 'Cancelada')])
    clave_operacion = models.UUIDField(unique=True)
    huella_solicitud = models.CharField(max_length=64)
    version_despacho = models.CharField(max_length=64)
    huella_puntos = models.CharField(max_length=64)
    puntos = models.JSONField()
    semilla = models.PositiveBigIntegerField(default=42)
    parametros = models.JSONField(default=dict)
    matriz = models.JSONField(default=dict)
    resultado = models.JSONField(default=dict)
    plan = models.OneToOneField(PlanRutaDespacho, on_delete=models.PROTECT, null=True, blank=True, related_name='calculo_optimizacion')
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    responsable_nombre = models.CharField(max_length=200)
    creado_en = models.DateTimeField(auto_now_add=True)
    iniciado_en = models.DateTimeField(null=True, blank=True)
    terminado_en = models.DateTimeField(null=True, blank=True)
    vence_en = models.DateTimeField()
    error = models.CharField(max_length=250, blank=True)

    class Meta:
        db_table = 'calculos_optimizacion'
        default_permissions = ()
        ordering = ['-pk']
        constraints = [
            models.UniqueConstraint(fields=['despacho'], condition=Q(estado__in=['pendiente', 'calculando']), name='optimizacion_activa_por_despacho'),
            models.CheckConstraint(condition=Q(semilla__lte=4294967295), name='optimizacion_semilla_valida'),
            models.CheckConstraint(condition=Q(estado__in=['pendiente', 'calculando', 'lista', 'error', 'obsoleta', 'cancelada']), name='optimizacion_estado_valido'),
        ]
