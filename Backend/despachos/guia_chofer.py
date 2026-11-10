"""Guía efímera desde GPS real; no modifica el plan fijado ni acciones del viaje."""
import math
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import Throttled, ValidationError
from auditoria.servicios import registrar_actividad
from compras.serializadores import SerializadorEstricto
from .models import ConsultaGuiaChofer, PlanRutaDespacho
from .modelos_seguimiento import SesionSeguimiento
from .seguimiento import contexto_seguimiento
from .serializadores_seguimiento import SerializadorPosicion
from .rutas_osrm import consultar_osrm, ErrorCalculoRuta
from .servicios import comprobar_version, huella_datos, ConflictoDespacho


class SerializadorConsultaGuia(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.RegexField(r'\A[0-9a-f]{64}\Z')
    sesion = serializers.UUIDField()
    plan = serializers.IntegerField(min_value=1)
    tramo = serializers.IntegerField(min_value=1, max_value=1001)
    posicion = SerializadorPosicion()


def distancia_puntos(origen, destino):
    lon1, lat1, lon2, lat2 = map(math.radians, [*origen, *destino])
    valor = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(max(0, valor))))


def contexto(actor, acceso, identificador, valores, *, exigir_lectura=True):
    actor, movil, despacho = contexto_seguimiento(actor, acceso, identificador)
    if despacho.estado != 'en_ruta':
        raise ConflictoDespacho('La guía solo está disponible durante el viaje.')
    comprobar_version(despacho, valores['version'])
    sesion = get_object_or_404(SesionSeguimiento.objects.select_for_update(), pk=valores['sesion'], despacho=despacho, sesion_movil=movil, usuario=actor)
    if sesion.cerrada_en or sesion.vence_en <= timezone.now():
        raise ConflictoDespacho('El seguimiento terminó. Vuelve a compartir tu ubicación para recibir guía.')
    plan = get_object_or_404(PlanRutaDespacho, pk=valores['plan'], despacho=despacho, fijada_en__isnull=False)
    pendientes = set(despacho.paradas.filter(descargada_en__isnull=True).values_list('pk', flat=True))
    destino = next((p for p in plan.puntos if p['tipo'] == 'sucursal' and p['parada'] in pendientes), None)
    if destino is None:
        destino = next((p for p in plan.puntos if p['tipo'] == 'retorno'), None)
    if destino is None or destino['orden'] != valores['tramo']:
        raise ConflictoDespacho('El siguiente destino cambió. Actualiza la guía.')
    if destino.get('latitud') is None or destino.get('longitud') is None:
        raise ValidationError({'ruta': 'El destino no tiene coordenadas confirmadas.'})
    posicion = valores['posicion']
    momento = timezone.now()
    if exigir_lectura and (abs((momento-posicion['capturada_en']).total_seconds()) > 30 or
            posicion['capturada_en'] < sesion.iniciada_en-timedelta(seconds=30)):
        raise ValidationError({'posicion': 'Utiliza una lectura GPS reciente de esta sesión, de hasta treinta segundos.'})
    # Se utiliza el acceso vial fijado; no se actualizan coordenadas del catálogo.
    tramo = next((t for t in plan.tramos if t['orden'] == destino['orden']), None)
    final = (tramo or {}).get('geometria', {}).get('coordinates', [])
    coordenadas = final[-1] if final else [float(destino['longitud']), float(destino['latitud'])]
    return actor, despacho, sesion, plan, coordenadas


def presentar(consulta):
    return {'consulta': str(consulta.pk), 'estado': consulta.estado, 'sesion': str(consulta.sesion_id),
        'plan': consulta.plan_id, 'tramo': consulta.tramo, 'version_despacho': consulta.version_despacho,
        'vence_en': consulta.vence_en, 'trafico_en_vivo': False,
        'origen': consulta.origen, 'geometria': consulta.geometria if consulta.estado == 'lista' else None,
        'distancia_m': str(consulta.distancia_m) if consulta.distancia_m is not None else None}


def comprobar_reintento(consulta, sesion, plan, firma):
    if consulta.sesion_id != sesion.pk or consulta.plan_id != plan.pk or consulta.huella != firma:
        raise ConflictoDespacho('La clave corresponde a otra solicitud, sesión o posición.')
    if consulta.vence_en <= timezone.now():
        raise ConflictoDespacho('La consulta de guía venció. Utiliza una lectura GPS nueva.')
    return presentar(consulta)


def consultar_guia(actor, acceso, identificador, datos):
    formulario = SerializadorConsultaGuia(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    firma = huella_datos(valores)
    with transaction.atomic():
        actor, despacho, sesion, plan, destino = contexto(actor, acceso, identificador, valores, exigir_lectura=False)
        anterior = ConsultaGuiaChofer.objects.filter(pk=valores['clave_operacion']).first()
        if anterior:
            comprobar_reintento(anterior, sesion, plan, firma)
            if anterior.estado == 'pendiente' and (timezone.now()-anterior.creado_en).total_seconds() > 25:
                anterior.estado, anterior.resuelto_en = 'error', timezone.now()
                anterior.save(update_fields=['estado', 'resuelto_en'])
                registrar_actividad('despachos', 'consultar_guia_chofer', actor=actor, objeto=despacho,
                    objeto_nombre=despacho.codigo, cambios={'consulta': str(anterior.pk), 'resultado': 'vencida'})
            return comprobar_reintento(anterior, sesion, plan, firma)
        contexto(actor, acceso, identificador, valores)
        ultima = ConsultaGuiaChofer.objects.filter(sesion=sesion).order_by('-creado_en').first()
        if ultima:
            espera = 15 - (timezone.now()-ultima.creado_en).total_seconds()
            if espera > 0:
                raise Throttled(wait=math.ceil(espera), detail='Espera antes de volver a consultar la guía.')
        posicion = valores['posicion']
        origen = {'id': str(posicion['id']), 'longitud': str(posicion['longitud']), 'latitud': str(posicion['latitud']),
            'precision_m': str(posicion['precision_m']), 'capturada_en': posicion['capturada_en'].isoformat()}
        consulta = ConsultaGuiaChofer.objects.create(clave_operacion=valores['clave_operacion'], sesion=sesion, plan=plan,
            version_despacho=valores['version'], tramo=valores['tramo'], huella=firma, origen=origen, vence_en=timezone.now()+timedelta(seconds=90))
        registrar_actividad('despachos', 'solicitar_guia_chofer', actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
            cambios={'consulta': str(consulta.pk), 'plan': plan.pk, 'tramo': consulta.tramo})
    puntos = [{'longitud': origen['longitud'], 'latitud': origen['latitud']}, {'longitud': str(destino[0]), 'latitud': str(destino[1])}]
    try:
        resultado = consultar_osrm(puntos)
        geometria = resultado['tramos'][0].get('geometria') or resultado['geometria']
        coordenadas = geometria['coordinates']
        tramo_fijado = next((t for t in plan.tramos if t['orden'] == valores['tramo']), {})
        margen_destino = 5 if tramo_fijado.get('geometria', {}).get('coordinates') else settings.OSRM_RADIO_ACCESO_M
        if (distancia_puntos([float(origen['longitud']), float(origen['latitud'])], coordenadas[0]) > min(100, float(posicion['precision_m'])+20) or
                distancia_puntos(destino, coordenadas[-1]) > margen_destino):
            raise ValidationError({'ruta': 'El acceso vial no coincide con la ubicación o el destino confirmado.'})
    except (ErrorCalculoRuta, ValidationError):
        resultado = None
    with transaction.atomic():
        actor, despacho, sesion, plan, destino = contexto(actor, acceso, identificador, valores)
        consulta = ConsultaGuiaChofer.objects.select_for_update().get(pk=consulta.pk)
        if consulta.estado != 'pendiente':
            return presentar(consulta)
        if consulta.vence_en <= timezone.now():
            raise ConflictoDespacho('El cálculo de guía venció.')
        consulta.estado = 'lista' if resultado else 'error'
        consulta.resuelto_en = timezone.now()
        if resultado:
            consulta.geometria, consulta.distancia_m = geometria, resultado['distancia_m']
        consulta.save(update_fields=['estado', 'resuelto_en', 'geometria', 'distancia_m'])
        registrar_actividad('despachos', 'consultar_guia_chofer', actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
            cambios={'consulta': str(consulta.pk), 'plan': plan.pk, 'tramo': consulta.tramo, 'resultado': consulta.estado})
        return presentar(consulta)
