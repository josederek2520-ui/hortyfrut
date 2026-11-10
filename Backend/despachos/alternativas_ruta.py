"""Opciones reales por tramo; elegir crea una propuesta y conserva el plan anterior."""
from copy import deepcopy
from datetime import timedelta
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from auditoria.servicios import registrar_actividad, nombre_responsable
from .models import ConsultaAlternativasRuta, PlanRutaDespacho, OperacionDespacho
from .rutas_carretera import (SerializadorOperacionRuta, exigir_acceso_ruta, exigir_borrador,
    exigir_sin_calculo_activo, puntos_despacho, orden_plan, reintento, registrar_operacion)
from .servicios import ConflictoDespacho, comprobar_version, huella_datos
from .rutas_osrm import consultar_alternativas_osrm


class SerializadorConsultaAlternativas(SerializadorOperacionRuta):
    plan = serializers.IntegerField(min_value=1)
    tramo = serializers.IntegerField(min_value=1, max_value=1001)


class SerializadorEleccionAlternativa(SerializadorOperacionRuta):
    consulta = serializers.IntegerField(min_value=1)
    opcion = serializers.IntegerField(min_value=0, max_value=2)


def validar_contexto(actor, despacho, valores, *, bloquear=False):
    exigir_borrador(despacho, como_chofer=True)
    exigir_sin_calculo_activo(despacho)
    comprobar_version(despacho, valores['version'])
    plan = get_object_or_404(despacho.planes_ruta, pk=valores['plan'])
    puntos, faltantes = puntos_despacho(despacho, bloquear=bloquear, orden_paradas=orden_plan(plan))
    if (plan.pk != despacho.planes_ruta.first().pk or faltantes or huella_datos(puntos) != plan.huella_puntos):
        raise ConflictoDespacho('El recorrido cambió. Actualízalo antes de comparar caminos.')
    if (len(plan.tramos) != len(plan.puntos) - 1 or any(
            not tramo.get('geometria', {}).get('coordinates') for tramo in plan.tramos)):
        raise serializers.ValidationError({'ruta': 'Calcula nuevamente el recorrido para comparar sus tramos.'})
    if not 1 <= valores['tramo'] <= len(plan.tramos):
        raise serializers.ValidationError({'tramo': 'Selecciona un tramo de este recorrido.'})
    return plan


def presentar_consulta(consulta):
    return {'consulta': consulta.pk, 'plan': consulta.plan_id, 'tramo': consulta.tramo,
        'version_despacho': consulta.version_despacho, 'vence_en': consulta.vence_en,
        'trafico_en_vivo': False,
        'opciones': [{**opcion, 'opcion': indice} for indice, opcion in enumerate(consulta.opciones)]}


def comprobar_consulta(consulta, actor, plan, huella):
    if (consulta.responsable_id != actor.pk or consulta.plan_id != plan.pk or consulta.huella_solicitud != huella):
        raise ConflictoDespacho('Esta clave corresponde a otra consulta o cuenta.')
    if consulta.vence_en <= timezone.now():
        raise ConflictoDespacho('La comparación venció. Solicita nuevas opciones.')
    return consulta


def consultar_alternativas_ruta(actor, identificador, datos):
    formulario = SerializadorConsultaAlternativas(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=True, editar=True)
    plan = validar_contexto(actor, despacho, valores)
    huella = huella_datos([despacho.pk, valores['version'], valores['plan'], valores['tramo']])
    anterior = ConsultaAlternativasRuta.objects.filter(clave_operacion=valores['clave_operacion']).first()
    if anterior:
        return presentar_consulta(comprobar_consulta(anterior, actor, plan, huella))
    if OperacionDespacho.objects.filter(clave_operacion=valores['clave_operacion']).exists():
        raise ConflictoDespacho('Esta clave ya corresponde a otra operación.')
    tramo = deepcopy(plan.tramos[valores['tramo'] - 1])
    geometria = tramo['geometria']
    extremos = [geometria['coordinates'][0], geometria['coordinates'][-1]]
    puntos = [{'longitud': str(lon), 'latitud': str(lat)} for lon, lat in extremos]
    resultados = consultar_alternativas_osrm(puntos)
    opciones = [{'actual': True, 'distancia_m': str(tramo['distancia_m']), 'duracion_s': str(tramo['duracion_s']),
        'geometria': geometria, 'calles': tramo.get('calles', [])}]
    unicas = {huella_datos(geometria['coordinates'])}
    version_datos = plan.version_datos
    for resultado in resultados:
        if plan.version_datos and resultado['version_datos'] and plan.version_datos != resultado['version_datos']:
            raise ConflictoDespacho('Los datos de calles cambiaron. Calcula nuevamente todo el recorrido.')
        version_datos = resultado['version_datos'] or version_datos
        linea = resultado['tramos'][0].get('geometria')
        # No conectar con lineas inventadas si OSRM elige otra calzada o acceso.
        if not linea or [linea['coordinates'][0], linea['coordinates'][-1]] != extremos:
            continue
        clave = huella_datos(linea['coordinates'])
        if clave in unicas:
            continue
        unicas.add(clave)
        opciones.append({'actual': False, 'distancia_m': str(resultado['distancia_m']),
            'duracion_s': str(resultado['duracion_s']), 'geometria': linea, 'calles': resultado['calles']})
        if len(opciones) == 3:
            break
    try:
        with transaction.atomic():
            despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=True, editar=True, bloquear=True)
            plan = validar_contexto(actor, despacho, valores, bloquear=True)
            anterior = ConsultaAlternativasRuta.objects.filter(clave_operacion=valores['clave_operacion']).first()
            if anterior:
                return presentar_consulta(comprobar_consulta(anterior, actor, plan, huella))
            consulta = ConsultaAlternativasRuta.objects.create(plan=plan, responsable=actor,
                clave_operacion=valores['clave_operacion'], huella_solicitud=huella,
                version_despacho=valores['version'], tramo=valores['tramo'], opciones=opciones,
                version_datos=version_datos, vence_en=timezone.now() + timedelta(minutes=10))
            registrar_actividad('despachos', 'consultar_alternativas_ruta', actor=actor, objeto=despacho,
                objeto_nombre=despacho.codigo, cambios={'consulta': consulta.pk, 'plan': plan.pk,
                    'tramo': consulta.tramo, 'opciones': len(opciones), 'trafico_en_vivo': False})
            return presentar_consulta(consulta)
    except IntegrityError:
        anterior = ConsultaAlternativasRuta.objects.filter(clave_operacion=valores['clave_operacion']).first()
        if anterior:
            despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=True, editar=True)
            plan = validar_contexto(actor, despacho, valores)
            return presentar_consulta(comprobar_consulta(anterior, actor, plan, huella))
        raise


def elegir_alternativa_ruta(actor, identificador, datos):
    try:
        return _elegir_alternativa_ruta(actor, identificador, datos)
    except IntegrityError as error:
        if 'clave_operacion' in str(getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')):
            raise ConflictoDespacho('Esta clave ya se utilizó para otra operación.') from error
        raise


@transaction.atomic
def _elegir_alternativa_ruta(actor, identificador, datos):
    formulario = SerializadorEleccionAlternativa(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=True, editar=True, bloquear=True)
    anterior, huella = reintento(actor, despacho, valores, 'elegir_alternativa_ruta')
    if anterior:
        return despacho
    consulta = get_object_or_404(ConsultaAlternativasRuta, pk=valores['consulta'], plan__despacho=despacho, responsable=actor)
    plan = validar_contexto(actor, despacho, {**valores, 'plan': consulta.plan_id, 'tramo': consulta.tramo}, bloquear=True)
    if consulta.version_despacho != valores['version'] or consulta.vence_en <= timezone.now():
        raise ConflictoDespacho('La comparación venció o cambió el recorrido. Solicita nuevas opciones.')
    if ConsultaAlternativasRuta.objects.filter(clave_operacion=valores['clave_operacion']).exists():
        raise ConflictoDespacho('Esta clave ya corresponde a una consulta.')
    if valores['opcion'] >= len(consulta.opciones):
        raise serializers.ValidationError({'opcion': 'Selecciona un camino disponible.'})
    opcion = consulta.opciones[valores['opcion']]
    if not opcion['actual']:
        tramos = deepcopy(plan.tramos)
        tramo = tramos[consulta.tramo - 1]
        tramo.update({campo: deepcopy(opcion[campo]) for campo in ('geometria', 'distancia_m', 'duracion_s', 'calles')})
        tramo['alternativa'] = {'consulta': consulta.pk, 'opcion': valores['opcion'], 'plan_base': plan.pk}
        coordenadas = []
        for parte in tramos:
            linea = parte['geometria']['coordinates']
            if coordenadas and coordenadas[-1] != linea[0]:
                raise serializers.ValidationError({'ruta': 'Los accesos no coinciden. Calcula nuevamente el recorrido.'})
            coordenadas.extend(linea[1:] if coordenadas else linea)
        if len(coordenadas) > 100000:
            raise serializers.ValidationError({'ruta': 'El recorrido supera el tamaño permitido.'})
        distancia = sum((Decimal(parte['distancia_m']) for parte in tramos), Decimal('0'))
        duracion = sum((Decimal(parte['duracion_s']) for parte in tramos), Decimal('0'))
        if max(distancia, duracion) >= Decimal('1000000000000'):
            raise serializers.ValidationError({'ruta': 'Las métricas del recorrido superan el límite permitido.'})
        nuevo = PlanRutaDespacho.objects.create(despacho=despacho,
            numero=(despacho.planes_ruta.aggregate(ultimo=Max('numero'))['ultimo'] or 0) + 1,
            puntos=deepcopy(plan.puntos), huella_puntos=plan.huella_puntos,
            geometria={'type': 'LineString', 'coordinates': coordenadas}, tramos=tramos,
            distancia_m=distancia, duracion_s=duracion,
            version_datos=consulta.version_datos, responsable=actor, responsable_nombre=nombre_responsable(actor),
            clave_operacion=valores['clave_operacion'], huella_solicitud=huella)
    else:
        nuevo = plan
    registrar_operacion(actor, despacho, valores, 'elegir_alternativa_ruta', huella)
    registrar_actividad('despachos', 'elegir_alternativa_ruta', actor=actor, objeto=despacho,
        objeto_nombre=despacho.codigo, cambios={'consulta': consulta.pk, 'opcion': valores['opcion'],
            'plan_base': plan.pk, 'plan': nuevo.pk, 'tramo': consulta.tramo, 'trafico_en_vivo': False})
    return despacho
