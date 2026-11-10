"""Solicitud persistida y adopción transaccional del cálculo fuera de HTTP."""
from dataclasses import asdict
from datetime import timedelta
from decimal import Decimal
from time import perf_counter

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers

from auditoria.servicios import nombre_responsable, registrar_actividad
from ..models import CalculoOptimizacion, Despacho, PlanRutaDespacho
from ..rutas_carretera import (SerializadorCalculoRuta, SerializadorOperacionRuta, exigir_acceso_ruta,
    exigir_borrador, exigir_puntos, puntos_despacho, registrar_operacion, orden_plan, reintento)
from ..rutas_osrm import consultar_matriz_osrm, consultar_osrm
from ..servicios import ConflictoDespacho, comprobar_version, huella_datos, version_despacho


class SerializadorSolicitudOptimizacion(SerializadorCalculoRuta):
    semilla = serializers.IntegerField(min_value=0, max_value=4294967295, default=42)


class SerializadorCancelarOptimizacion(SerializadorOperacionRuta):
    calculo = serializers.IntegerField(min_value=1)


def estado_efectivo(calculo, despacho):
    if calculo.estado not in ('pendiente', 'calculando'):
        return calculo.estado
    if calculo.vence_en <= timezone.now():
        return 'error'
    if despacho.estado != 'borrador' or not despacho.enviado_en or calculo.version_despacho != version_despacho(despacho):
        return 'obsoleta'
    try:
        puntos, faltantes = puntos_despacho(despacho, orden_paradas=[punto['parada'] for punto in calculo.puntos if punto['tipo'] == 'sucursal'])
    except serializers.ValidationError:
        return 'obsoleta'
    return 'obsoleta' if faltantes or huella_datos(puntos) != calculo.huella_puntos else calculo.estado


def comprobar_calculo_activo(despacho):
    if not settings.OPTIMIZACION_HABILITADA:
        return
    calculo = despacho.calculos_optimizacion.filter(estado__in=['pendiente', 'calculando']).first()
    if calculo and estado_efectivo(calculo, despacho) in ('pendiente', 'calculando'):
        raise serializers.ValidationError({'ruta': 'Espera el resultado o cancela el cálculo antes de cambiar el recorrido.'})


def serializar_calculo(despacho, plan=None):
    if not settings.OPTIMIZACION_HABILITADA:
        return None
    calculo = despacho.calculos_optimizacion.first()
    if not calculo or (calculo.estado == 'lista' and calculo.plan_id != getattr(plan, 'pk', None)):
        return None
    estado = estado_efectivo(calculo, despacho)
    return {'id': calculo.pk, 'estado': estado, 'plan': calculo.plan_id,
            'error': calculo.error if estado == 'error' and calculo.error else
                     'El cálculo venció. Puedes solicitarlo de nuevo.' if estado == 'error' else '',
            'creado_en': calculo.creado_en, 'vence_en': calculo.vence_en}


def resumen_resultado(calculo):
    campos = ('algoritmo', 'objetivo', 'semilla', 'costo_s', 'costo_inicial_s', 'mejora_s',
              'mejora_porcentaje', 'duracion_inicial_s', 'tiempo_calculo_s', 'metodo_elegido')
    return {clave: calculo.resultado[clave] for clave in campos if clave in calculo.resultado}


def cerrar_calculo(calculo, estado, actor=None, error=''):
    calculo.estado, calculo.error, calculo.terminado_en = estado, error, timezone.now()
    calculo.save(update_fields=['estado', 'error', 'terminado_en'])
    registrar_actividad('despachos', 'optimizacion_' + estado, actor=actor, objeto=calculo.despacho,
        objeto_nombre=calculo.despacho.codigo, cambios={'calculo': calculo.pk, 'estado': estado, 'error': error})


def solicitar_optimizacion(actor, identificador, datos):
    if not settings.OPTIMIZACION_HABILITADA:
        raise serializers.ValidationError({'ruta': 'La optimización todavía no está habilitada.'})
    formulario = SerializadorSolicitudOptimizacion(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    try:
        with transaction.atomic():
            despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=True, editar=True, bloquear=True)
            huella = huella_datos([despacho.pk, str(valores['version']), valores.get('orden_paradas'), valores['semilla']])
            anterior = CalculoOptimizacion.objects.filter(clave_operacion=valores['clave_operacion']).first()
            if anterior:
                if anterior.despacho_id != despacho.pk or anterior.responsable_id != actor.pk or anterior.huella_solicitud != huella:
                    raise ConflictoDespacho('Esta clave ya se utilizó para otro cálculo o cuenta.')
                return despacho
            comprobar_version(despacho, valores['version'])
            exigir_borrador(despacho, como_chofer=True)
            puntos, faltantes = puntos_despacho(despacho, bloquear=True, orden_paradas=valores.get('orden_paradas'))
            exigir_puntos(puntos, faltantes)
            for anterior in despacho.calculos_optimizacion.select_for_update().filter(estado__in=['pendiente', 'calculando']):
                estado = estado_efectivo(anterior, despacho)
                if estado in ('pendiente', 'calculando'):
                    raise ConflictoDespacho('Ya hay un cálculo en curso para este despacho.')
                cerrar_calculo(anterior, estado, actor)
            from .genetico import ParametrosGenetico
            parametros = asdict(ParametrosGenetico())
            registrar_operacion(actor, despacho, valores, 'optimizar_ruta', huella)
            calculo = CalculoOptimizacion.objects.create(despacho=despacho,
                clave_operacion=valores['clave_operacion'], huella_solicitud=huella,
                version_despacho=version_despacho(despacho), huella_puntos=huella_datos(puntos), puntos=puntos,
                semilla=valores['semilla'], parametros=parametros, responsable=actor,
                responsable_nombre=nombre_responsable(actor), vence_en=timezone.now() + timedelta(minutes=5))
            registrar_actividad('despachos', 'solicitar_optimizacion', actor=actor, objeto=despacho,
                objeto_nombre=despacho.codigo, cambios={'calculo': calculo.pk, 'semilla': calculo.semilla,
                    'paradas': len(puntos) - 2, 'parametros': parametros, 'trafico_en_vivo': False})
            transaction.on_commit(lambda: publicar_calculo(calculo.pk))
        return despacho
    except IntegrityError as error:
        raise ConflictoDespacho('Ya existe una operación con esta clave o un cálculo activo. Actualiza el despacho.') from error


def publicar_calculo(identificador):
    try:
        from ..tareas_optimizacion import ejecutar_optimizacion
        ejecutar_optimizacion.apply_async(args=[identificador], retry=False)
    except Exception:
        # La solicitud ya está persistida. La consulta devuelve un error explícito y
        # una solicitud nueva puede reintentarse sin adoptar un resultado desconocido.
        finalizar_error(identificador, 'No se pudo iniciar el cálculo. Revisa el servicio de optimización e inténtalo de nuevo.')


def finalizar_error(identificador, mensaje, estado='error'):
    referencia = CalculoOptimizacion.objects.get(pk=identificador)
    with transaction.atomic():
        despacho = Despacho.objects.select_for_update().get(pk=referencia.despacho_id)
        calculo = CalculoOptimizacion.objects.select_for_update().get(pk=identificador)
        if calculo.estado not in ('pendiente', 'calculando'):
            return
        calculo.despacho = despacho
        cerrar_calculo(calculo, estado, error=mensaje)


def procesar_calculo(identificador):
    referencia = CalculoOptimizacion.objects.get(pk=identificador)
    with transaction.atomic():
        despacho = Despacho.objects.select_for_update().get(pk=referencia.despacho_id)
        calculo = CalculoOptimizacion.objects.select_for_update().get(pk=identificador)
        if calculo.estado != 'pendiente':
            return
        estado = estado_efectivo(calculo, despacho)
        if estado != 'pendiente':
            cerrar_calculo(calculo, estado)
            return
        # Revalidar también cuando el trabajo se ejecuta fuera de HTTP.
        exigir_acceso_ruta(calculo.responsable, despacho.pk, como_chofer=True, editar=True)
        calculo.estado, calculo.iniciado_en = 'calculando', timezone.now()
        calculo.save(update_fields=['estado', 'iniciado_en'])
        registrar_actividad('despachos', 'iniciar_optimizacion', actor=calculo.responsable, objeto=despacho,
            objeto_nombre=despacho.codigo, cambios={'calculo': calculo.pk})
    # Ninguna consulta a OSRM ni generación del genético mantiene bloqueos de negocio.
    matriz = consultar_matriz_osrm(calculo.puntos[:-1])
    from .genetico import optimizar_recorrido, ParametrosGenetico
    inicio = perf_counter()
    resultado = optimizar_recorrido(matriz['duraciones_s'], semilla=calculo.semilla,
        parametros=ParametrosGenetico(**calculo.parametros))
    resultado['tiempo_calculo_s'] = f'{perf_counter() - inicio:.6f}'
    propuestos = [calculo.puntos[0], *[{**calculo.puntos[indice], 'orden': orden}
        for orden, indice in enumerate(resultado['orden'], 1)], calculo.puntos[-1]]
    original = consultar_osrm(calculo.puntos)
    trazado = original if propuestos == calculo.puntos else consultar_osrm(propuestos)
    if (matriz['version_datos'] and (original['version_datos'] != matriz['version_datos']
            or trazado['version_datos'] != matriz['version_datos'])):
        raise ConflictoDespacho('Los datos de OSRM cambiaron durante el cálculo. Solicita uno nuevo.')
    if trazado['duracion_s'] >= original['duracion_s']:
        propuestos, trazado = calculo.puntos, original
        resultado['metodo_elegido'] = 'orden_actual'
    else:
        resultado['metodo_elegido'] = 'genetico'
    mejora = original['duracion_s'] - trazado['duracion_s']
    resultado.update(mejora_s=str(mejora), duracion_inicial_s=str(original['duracion_s']),
        mejora_porcentaje=str((mejora * 100 / original['duracion_s']).quantize(Decimal('0.1'))) if original['duracion_s'] else '0')
    with transaction.atomic():
        despacho, actor = exigir_acceso_ruta(calculo.responsable, referencia.despacho_id, como_chofer=True, editar=True, bloquear=True)
        calculo = CalculoOptimizacion.objects.select_for_update().get(pk=identificador)
        if calculo.estado != 'calculando':
            return
        if (despacho.estado != 'borrador' or not despacho.enviado_en
                or calculo.version_despacho != version_despacho(despacho)):
            cerrar_calculo(calculo, 'obsoleta', actor)
            return
        exigir_borrador(despacho, como_chofer=True)
        actuales, faltantes = puntos_despacho(despacho, bloquear=True,
            orden_paradas=[punto['parada'] for punto in calculo.puntos if punto['tipo'] == 'sucursal'])
        if (faltantes or calculo.vence_en <= timezone.now() or calculo.version_despacho != version_despacho(despacho)
                or huella_datos(actuales) != calculo.huella_puntos):
            cerrar_calculo(calculo, 'obsoleta', actor)
            return
        numero = (despacho.planes_ruta.aggregate(ultimo=Max('numero'))['ultimo'] or 0) + 1
        calculo.plan = PlanRutaDespacho.objects.create(despacho=despacho, numero=numero, puntos=propuestos,
            huella_puntos=huella_datos(propuestos), clave_operacion=calculo.clave_operacion,
            huella_solicitud=calculo.huella_solicitud, responsable=actor,
            responsable_nombre=nombre_responsable(actor), **trazado)
        calculo.matriz, calculo.resultado, calculo.estado, calculo.terminado_en = matriz, resultado, 'lista', timezone.now()
        calculo.save(update_fields=['plan', 'matriz', 'resultado', 'estado', 'terminado_en'])
        despacho.actualizado_en = timezone.now()
        despacho.save(update_fields=['actualizado_en'])
        registrar_actividad('despachos', 'completar_optimizacion', actor=actor, objeto=despacho,
            objeto_nombre=despacho.codigo, cambios={'calculo': calculo.pk, 'plan': calculo.plan_id,
                'orden_paradas': orden_plan(calculo.plan), **resumen_resultado(calculo), 'trafico_en_vivo': False})


def cancelar_optimizacion(actor, identificador, datos):
    formulario = SerializadorCancelarOptimizacion(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    with transaction.atomic():
        despacho, actor = exigir_acceso_ruta(actor, identificador, como_chofer=True, editar=True, bloquear=True)
        anterior, huella = reintento(actor, despacho, {**valores, 'plan': valores['calculo']}, 'cancelar_optimizacion')
        if anterior:
            return despacho
        comprobar_version(despacho, valores['version'])
        calculo = get_object_or_404(CalculoOptimizacion.objects.select_for_update(), pk=valores['calculo'], despacho=despacho)
        if calculo.estado not in ('pendiente', 'calculando'):
            raise ConflictoDespacho('Este cálculo ya terminó. Actualiza el recorrido.')
        cerrar_calculo(calculo, 'cancelada', actor)
        registrar_operacion(actor, despacho, valores, 'cancelar_optimizacion', huella)
        return despacho
