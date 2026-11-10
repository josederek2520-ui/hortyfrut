from datetime import datetime
from decimal import Decimal
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from inventario.consultas import es_kilogramo
from .consultas import representar_aporte


def validar_identificadores(lineas, permitidos, completo=False):
    identificadores = [fila['aporte'] for fila in lineas]
    if len(identificadores) != len(set(identificadores)) or not set(identificadores) <= set(permitidos):
        raise ValidationError({'lineas': 'Hay aportes repetidos o ajenos a esta devolución.'})
    if completo and not identificadores:
        raise ValidationError({'lineas': 'Agrega al menos un aporte con la cantidad que realmente regresó.'})


def validar_fecha(fecha, entrega, completo=False):
    minima = timezone.localtime(datetime.fromisoformat(entrega.origen['descargada_en'])).date()
    if fecha is None and completo:
        raise ValidationError({'fecha_recepcion': 'Selecciona la fecha del retorno físico.'})
    if fecha is not None and not minima <= fecha <= timezone.localdate():
        raise ValidationError({'fecha_recepcion': 'La fecha debe estar entre la descarga de la sucursal y hoy.'})


def normalizar_recepcion(lineas, aportes, completo=False):
    validar_identificadores(lineas, aportes, completo)
    errores, resultado = {}, []
    for entrada in lineas:
        fila = dict(entrada)
        aporte = aportes[fila['aporte']]
        cantidad, peso = fila['cantidad_recibida'], fila['peso_kg_recibido']
        if es_kilogramo(aporte.lote.unidad):
            if peso is not None and peso != cantidad:
                errores[f"{aporte.pk}_peso_kg_recibido"] = 'En un lote en kg la cantidad y el peso deben ser la misma medición.'
            fila['peso_kg_recibido'] = peso = cantidad
        for campo, valor in [('cantidad_recibida', cantidad), ('peso_kg_recibido', peso)]:
            if valor is not None and valor <= 0 or completo and valor is None:
                errores[f'{aporte.pk}_{campo}'] = 'Registra una medición positiva de lo que realmente regresó.'
        referencia = representar_aporte(aporte)
        if cantidad is not None and cantidad > Decimal(referencia['maximo_cantidad']):
            errores[f'{aporte.pk}_cantidad_recibida'] = f"El máximo que queda por registrar de este aporte es {referencia['maximo_cantidad']} {referencia['unidad_abreviatura']}."
        if peso is not None and peso > Decimal(referencia['maximo_peso']):
            errores[f'{aporte.pk}_peso_kg_recibido'] = f"El peso máximo que queda por registrar de este aporte es {referencia['maximo_peso']} kg."
        resultado.append(fila)
    if errores:
        raise ValidationError(errores)
    return resultado


def normalizar_revision(lineas, existentes, completo=False):
    validar_identificadores(lineas, existentes, completo)
    if set(fila['aporte'] for fila in lineas) != set(existentes):
        raise ValidationError({'lineas': 'Incluye todos los aportes recibidos, también los de otras páginas.'})
    errores, resultado = {}, []
    for entrada in lineas:
        fila = dict(entrada)
        recibida = existentes[fila['aporte']]
        if es_kilogramo(recibida.aporte.lote.unidad):
            for campo in ['aprovechable', 'merma']:
                cantidad, peso = fila[f'cantidad_{campo}'], fila[f'peso_kg_{campo}']
                if peso is not None and peso != cantidad:
                    errores[f"{recibida.aporte_id}_peso_kg_{campo}"] = 'En kg se conserva una sola medición por cada parte.'
                fila[f'peso_kg_{campo}'] = cantidad
        for prefijo, total in [('cantidad_', recibida.cantidad_recibida), ('peso_kg_', recibida.peso_kg_recibido)]:
            aprovechable, merma = fila[prefijo + 'aprovechable'], fila[prefijo + 'merma']
            if completo and (aprovechable is None or merma is None):
                errores[f'{recibida.aporte_id}_{prefijo}aprovechable'] = 'Completa aprovechable y merma; indica cero cuando corresponda.'
            if aprovechable is not None and merma is not None and aprovechable + merma != total:
                errores[f'{recibida.aporte_id}_{prefijo}merma'] = 'Aprovechable y merma deben sumar exactamente lo recibido.'
            if any(valor is not None and valor > total for valor in [aprovechable, merma]):
                errores[f'{recibida.aporte_id}_{prefijo}merma'] = 'Ninguna parte puede superar lo recibido.'
        for parte in ['aprovechable', 'merma']:
            cantidad, peso = fila['cantidad_' + parte], fila['peso_kg_' + parte]
            if cantidad is not None and peso is not None and ((cantidad == 0) != (peso == 0)):
                errores[f'{recibida.aporte_id}_peso_kg_{parte}'] = 'La cantidad y el peso de esta parte deben ser ambos cero o ambos positivos, sin convertir unidades.'
        vencimiento = recibida.lote_retenido.fecha_vencimiento
        if vencimiento and vencimiento < timezone.localdate() and (fila['cantidad_aprovechable'] or fila['peso_kg_aprovechable']):
            errores[f'{recibida.aporte_id}_cantidad_aprovechable'] = 'El producto vencido se clasifica únicamente como merma.'
        resultado.append(fila)
    if errores:
        raise ValidationError(errores)
    return resultado
