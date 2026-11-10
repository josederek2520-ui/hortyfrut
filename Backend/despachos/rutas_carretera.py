"""El chofer prepara su recorrido recibido y lo fija al iniciar la salida."""
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers

from almacenes.models import Almacen
from auditoria.servicios import nombre_responsable, registrar_actividad
from clientes.models import Sucursal
from compras.serializadores import SerializadorEstricto
from .models import Despacho, OperacionDespacho, PlanRutaDespacho
from .permisos import exigir_permiso, exigir_permiso_chofer
from .rutas_osrm import consultar_osrm
from .colores_ruta import colorear_puntos, colorear_tramos
from .servicios import ConflictoDespacho, comprobar_version, huella_datos, version_despacho


class SerializadorOperacionRuta(SerializadorEstricto):
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
    clave_operacion = serializers.UUIDField()


class SerializadorCalculoRuta(SerializadorOperacionRuta):
    orden_paradas = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1, max_length=1000, required=False)


class SerializadorAprobacionRuta(SerializadorOperacionRuta):
    plan = serializers.IntegerField(min_value=1)


def exigir_acceso_ruta(actor, identificador, *, como_chofer=False, editar=False, bloquear=False):
    actor = get_object_or_404(get_user_model(), pk=actor.pk) if actor and actor.is_authenticated else actor
    consulta = Despacho.objects.select_for_update() if bloquear else Despacho.objects.all()
    if como_chofer:
        exigir_permiso_chofer(actor, operar=editar)
        consulta = consulta.filter(chofer=actor).filter(Q(enviado_en__isnull=False) | Q(estado__in=['en_ruta', 'finalizado']))
    else:
        exigir_permiso(actor, 'editar' if editar else 'ver')
    return get_object_or_404(consulta, pk=identificador), actor


def puntos_despacho(despacho, *, bloquear=False, orden_paradas=None):
    paradas = list(despacho.paradas.order_by('orden', 'pk'))
    if orden_paradas is not None:
        por_id = {parada.pk: parada for parada in paradas}
        if len(orden_paradas) != len(por_id) or len(set(orden_paradas)) != len(orden_paradas) or set(orden_paradas) != set(por_id):
            raise serializers.ValidationError({'orden_paradas': 'Incluye todas las paradas del despacho una sola vez.'})
        paradas = [por_id[identificador] for identificador in orden_paradas]
    sucursales = Sucursal.objects.filter(pk__in=[parada.sucursal_id for parada in paradas]).order_by('pk')
    if bloquear:
        sucursales = sucursales.select_for_update()
    destinos = {sucursal.pk: sucursal for sucursal in sucursales}
    almacenes = Almacen.objects.select_for_update() if bloquear else Almacen.objects.all()
    almacen = almacenes.get(pk=despacho.almacen_id)
    puntos, faltantes = [], []
    origen = {'tipo': 'almacen', 'parada': None, 'sucursal': None, 'orden': 0,
              'nombre': despacho.almacen_nombre, 'cliente': '', 'latitud': None, 'longitud': None}
    for referencia, punto in [(almacen, origen)] + [(destinos[parada.sucursal_id], {
            'tipo': 'sucursal', 'parada': parada.pk, 'sucursal': parada.sucursal_id, 'orden': indice,
            'nombre': parada.sucursal_nombre, 'cliente': parada.cliente_nombre, 'latitud': None, 'longitud': None,
    }) for indice, parada in enumerate(paradas, 1)]:
        if referencia.latitud is None or referencia.longitud is None:
            faltantes.append(punto['nombre'])
        else:
            punto.update(latitud=str(referencia.latitud), longitud=str(referencia.longitud))
        puntos.append(punto)
    if puntos:
        puntos.append({**origen, 'tipo': 'retorno', 'orden': len(paradas) + 1})
    return puntos, faltantes


def exigir_borrador(despacho, *, como_chofer=False):
    if despacho.estado != 'borrador' or (despacho.enviado_en is None if como_chofer else despacho.enviado_en is not None):
        raise serializers.ValidationError({'ruta': 'Prepara el recorrido después de recibir el despacho y antes de iniciar el viaje.'})
    if despacho.planes_ruta.filter(fijada_en__isnull=False).exists():
        raise serializers.ValidationError({'ruta': 'Este viaje ya conserva un recorrido fijado.'})


def exigir_sin_calculo_activo(despacho):
    from .optimizacion.servicios import comprobar_calculo_activo
    comprobar_calculo_activo(despacho)


def orden_plan(plan):
    return [punto['parada'] for punto in plan.puntos if punto['tipo'] == 'sucursal']


def aplicar_orden(despacho, orden):
    paradas = list(despacho.paradas.select_for_update().order_by('pk'))
    actuales = {parada.pk: parada.orden for parada in paradas}
    if all(actuales.get(identificador) == indice for indice, identificador in enumerate(orden, 1)):
        return
    # Dos fases para mantener única la posición de cada parada sin recrear sus IDs.
    desplazamiento = max(actuales.values(), default=0) + len(paradas)
    for indice, parada in enumerate(paradas, 1):
        parada.orden = desplazamiento + indice
    despacho.paradas.model.objects.bulk_update(paradas, ['orden'])
    posiciones = {identificador: indice for indice, identificador in enumerate(orden, 1)}
    for parada in paradas:
        parada.orden = posiciones[parada.pk]
    despacho.paradas.model.objects.bulk_update(paradas, ['orden'])


def exigir_puntos(puntos, faltantes):
    if faltantes:
        raise serializers.ValidationError({'coordenadas': [f'Completa las coordenadas del acceso real: {nombre}.' for nombre in faltantes]})
    if len(puntos) < 3:
        raise serializers.ValidationError({'ruta': 'Selecciona al menos una sucursal para calcular el recorrido.'})


def reintento(actor, despacho, valores, accion):
    referencia = [despacho.pk, accion, str(valores['version']), valores.get('plan')]
    if 'orden_paradas' in valores:
        referencia.append(valores['orden_paradas'])
    if 'consulta' in valores:
        referencia.extend([valores['consulta'], valores['opcion']])
    huella = huella_datos(referencia)
    operacion = OperacionDespacho.objects.filter(clave_operacion=valores['clave_operacion']).first()
    if operacion and (operacion.despacho_id != despacho.pk or operacion.responsable_id != actor.pk
                      or operacion.accion != accion or operacion.huella != huella):
        raise ConflictoDespacho('Esta clave ya se utilizó para otra operación o cuenta.')
    return operacion, huella


def registrar_operacion(actor, despacho, valores, accion, huella):
    OperacionDespacho.objects.create(despacho=despacho, accion=accion, clave_operacion=valores['clave_operacion'],
                                    huella=huella, responsable=actor, responsable_nombre=nombre_responsable(actor))
    despacho.actualizado_en = timezone.now()
    despacho.save(update_fields=['actualizado_en'])


def calcular_ruta(actor, identificador, datos, *, como_chofer=False):
    try:
        return _calcular_ruta(actor, identificador, datos, como_chofer=como_chofer)
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if 'clave_operacion' in restriccion:
            raise ConflictoDespacho('Esta clave ya se utilizó para otra operación.') from error
        raise


def _calcular_ruta(actor, identificador, datos, *, como_chofer=False):
    formulario = SerializadorCalculoRuta(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=como_chofer, editar=True)
    anterior, huella = reintento(actor, despacho, valores, 'calcular_ruta')
    if anterior:
        return despacho
    exigir_borrador(despacho, como_chofer=como_chofer)
    exigir_sin_calculo_activo(despacho)
    comprobar_version(despacho, valores['version'])
    puntos, faltantes = puntos_despacho(despacho, orden_paradas=valores.get('orden_paradas'))
    exigir_puntos(puntos, faltantes)
    huella_puntos = huella_datos(puntos)
    # La llamada externa no mantiene bloqueos de despacho, inventario ni catálogos.
    resultado = consultar_osrm(puntos)
    with transaction.atomic():
        despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=como_chofer, editar=True, bloquear=True)
        anterior, huella = reintento(actor, despacho, valores, 'calcular_ruta')
        if anterior:
            return despacho
        exigir_borrador(despacho, como_chofer=como_chofer)
        exigir_sin_calculo_activo(despacho)
        comprobar_version(despacho, valores['version'])
        actuales, faltantes = puntos_despacho(despacho, bloquear=True, orden_paradas=valores.get('orden_paradas'))
        if faltantes or huella_datos(actuales) != huella_puntos:
            raise ConflictoDespacho('Las ubicaciones cambiaron durante el cálculo. Revisa el despacho y calcula nuevamente.')
        numero = (despacho.planes_ruta.aggregate(ultimo=Max('numero'))['ultimo'] or 0) + 1
        plan = PlanRutaDespacho.objects.create(despacho=despacho, numero=numero, puntos=puntos,
            huella_puntos=huella_puntos, clave_operacion=valores['clave_operacion'], huella_solicitud=huella,
            responsable=actor, responsable_nombre=nombre_responsable(actor), **resultado)
        registrar_operacion(actor, despacho, valores, 'calcular_ruta', huella)
        registrar_actividad('despachos', 'calcular_ruta', actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
            cambios={'plan': plan.pk, 'numero': plan.numero, 'puntos': len(puntos),
                     'distancia_m': str(plan.distancia_m), 'duracion_s': str(plan.duracion_s),
                     'orden_paradas': orden_plan(plan), 'como_chofer': como_chofer, 'trafico_en_vivo': False})
    return despacho


def aprobar_ruta(actor, identificador, datos, *, como_chofer=False):
    try:
        return _aprobar_ruta(actor, identificador, datos, como_chofer=como_chofer)
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if 'clave_operacion' in restriccion:
            raise ConflictoDespacho('Esta clave ya se utilizó para otra operación.') from error
        raise


@transaction.atomic
def _aprobar_ruta(actor, identificador, datos, *, como_chofer=False):
    formulario = SerializadorAprobacionRuta(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=como_chofer, editar=True, bloquear=True)
    anterior, huella = reintento(actor, despacho, valores, 'aprobar_ruta')
    if anterior:
        return despacho
    exigir_borrador(despacho, como_chofer=como_chofer)
    exigir_sin_calculo_activo(despacho)
    comprobar_version(despacho, valores['version'])
    plan = get_object_or_404(despacho.planes_ruta, pk=valores['plan'])
    ultimo = despacho.planes_ruta.first()
    puntos, faltantes = puntos_despacho(despacho, bloquear=True, orden_paradas=orden_plan(plan))
    if not ultimo or plan.pk != ultimo.pk or faltantes or plan.huella_puntos != huella_datos(puntos):
        raise ConflictoDespacho('El recorrido está desactualizado. Calcula y revisa la ruta vigente antes de aprobarla.')
    orden_anterior = list(despacho.paradas.order_by('orden').values_list('pk', flat=True))
    aplicar_orden(despacho, orden_plan(plan))
    if plan.aprobada_en is None:
        plan.aprobada_en, plan.aprobada_por, plan.aprobada_por_nombre = timezone.now(), actor, nombre_responsable(actor)
        plan.save(update_fields=['aprobada_en', 'aprobada_por', 'aprobada_por_nombre'])
    registrar_operacion(actor, despacho, valores, 'aprobar_ruta', huella)
    registrar_actividad('despachos', 'aprobar_ruta', actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
                       cambios={'plan': plan.pk, 'numero': plan.numero, 'como_chofer': como_chofer,
                                'orden_anterior': orden_anterior, 'orden_paradas': orden_plan(plan)})
    return despacho


def fijar_ruta_vigente(actor, despacho, *, exigir_aprobada=False):
    """La salida fija el recorrido; conserva los planes históricos ya fijados."""
    exigir_sin_calculo_activo(despacho)
    if despacho.planes_ruta.filter(fijada_en__isnull=False).exists():
        return
    plan = despacho.planes_ruta.first()
    if not plan:
        return
    puntos, faltantes = puntos_despacho(despacho, bloquear=True)
    if not plan.aprobada_en or faltantes or huella_datos(puntos) != plan.huella_puntos:
        if exigir_aprobada:
            raise serializers.ValidationError({'ruta': 'Revisa y confirma el recorrido vigente antes de iniciar.'})
        return
    plan.fijada_en = timezone.now()
    plan.save(update_fields=['fijada_en'])
    registrar_actividad('despachos', 'fijar_ruta', actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
                       cambios={'plan': plan.pk, 'numero': plan.numero})


def serializar_plan(plan):
    puntos = colorear_puntos(plan.puntos)
    calculo = getattr(plan, 'calculo_optimizacion', None) if settings.OPTIMIZACION_HABILITADA else None
    from .optimizacion.servicios import resumen_resultado
    return {'id': plan.pk, 'numero': plan.numero, 'puntos': puntos, 'geometria': plan.geometria,
            'tramos': colorear_tramos(plan.tramos, puntos), 'distancia_m': str(plan.distancia_m), 'duracion_s': str(plan.duracion_s),
            'proveedor': plan.proveedor, 'version_datos': plan.version_datos, 'creado_en': plan.creado_en,
            'responsable_nombre': plan.responsable_nombre, 'aprobada_en': plan.aprobada_en,
            'aprobada_por_nombre': plan.aprobada_por_nombre, 'fijada_en': plan.fijada_en, 'trafico_en_vivo': False,
            'optimizacion': resumen_resultado(calculo) if calculo else None}


def consultar_ruta(actor, identificador, *, como_chofer=False):
    despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=como_chofer)
    fijado = despacho.planes_ruta.filter(fijada_en__isnull=False).first()
    preparando = despacho.estado == 'borrador' and fijado is None
    puede_preparar = preparando and como_chofer and despacho.enviado_en is not None and actor.has_perm('despachos.operar_despachos_propios')
    if preparando:
        puntos, faltantes = puntos_despacho(despacho)
        plan = despacho.planes_ruta.first()
        vigente = False
        if plan:
            try:
                propuestos, faltantes_plan = puntos_despacho(despacho, orden_paradas=orden_plan(plan))
                vigente = not faltantes_plan and huella_datos(propuestos) == plan.huella_puntos
                if vigente:
                    puntos = propuestos
            except serializers.ValidationError:
                pass
        estado = ('faltan_ubicaciones' if faltantes else 'sin_calcular') if plan is None else (
            'obsoleta' if not vigente else
            'lista' if plan.aprobada_en else 'pendiente_aprobacion')
    else:
        plan = fijado
        # Los viajes anteriores no tienen ubicaciones históricas verificadas: no se inventan.
        puntos, faltantes = (plan.puntos, []) if plan else ([], [])
        estado = 'lista' if plan else 'sin_calcular'
    from .optimizacion.servicios import serializar_calculo
    calculo = serializar_calculo(despacho, plan)
    activo = bool(calculo and calculo['estado'] in ('pendiente', 'calculando'))
    puede_optimizar = settings.OPTIMIZACION_HABILITADA and puede_preparar and not faltantes and len(puntos) >= 3 and not activo
    actual = Despacho.objects.only('actualizado_en', 'estado').get(pk=despacho.pk)
    if version_despacho(actual) != version_despacho(despacho):
        raise ConflictoDespacho('El recorrido cambió durante la consulta. Actualiza sus datos.')
    # El estado del recorrido conserva el contrato anterior; el trabajo asíncrono
    # se informa en optimizacion.estado para que los clientes previos sigan leyendo.
    return {'despacho': despacho.pk, 'version_despacho': version_despacho(despacho), 'estado': estado,
            'plan': serializar_plan(plan) if plan else None, 'puntos': colorear_puntos(puntos), 'faltantes': faltantes,
            'preparando': preparando,
            'puede_ordenar': puede_preparar and len(puntos) >= 3 and not activo,
            'puede_calcular': puede_preparar and not faltantes and len(puntos) >= 3 and not activo,
            'puede_aprobar': puede_preparar and estado == 'pendiente_aprobacion' and not activo,
            'puede_optimizar': puede_optimizar, 'optimizacion': calculo,
            'trafico_en_vivo': False}
