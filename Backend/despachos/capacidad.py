"""Comprobación de peso medido, reutilizable antes de publicar o iniciar."""
from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ErrorDetail, ValidationError


def decimal_positivo(valor):
    if valor is None or isinstance(valor, bool):
        return None
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        return None
    return numero if numero.is_finite() and numero > 0 else None


def comprobar_capacidad(capacidad_kg, cargas):
    """No deducir kilos de CANT/UNI ni considerar un peso ausente como cero."""
    capacidad = decimal_positivo(capacidad_kg)
    resultado = {
        'estado': 'sin_carga',
        'capacidad_kg': str(capacidad) if capacidad is not None else None,
        'peso_kg': None,
        'margen_kg': None,
    }
    cargas = list(cargas)
    if not cargas:
        return resultado
    peso = Decimal('0')
    for carga in cargas:
        aportes = carga.get('aportes') or []
        pesos = [decimal_positivo(aporte.get('peso_kg')) for aporte in aportes]
        declarado = decimal_positivo(carga.get('peso_kg'))
        if not pesos or any(valor is None for valor in pesos):
            resultado['estado'] = 'peso_incompleto'
            return resultado
        medido = sum(pesos, Decimal('0'))
        if declarado != medido:
            resultado['estado'] = 'peso_incompleto'
            return resultado
        peso += medido
    resultado['peso_kg'] = str(peso)
    if capacidad is None:
        resultado['estado'] = 'sin_capacidad'
        return resultado
    resultado['margen_kg'] = str(capacidad - peso)
    resultado['estado'] = 'apta' if peso <= capacidad else 'excedida'
    return resultado


def validar_capacidad_viaje(vehiculo, cargas):
    resultado = comprobar_capacidad(vehiculo.capacidad_kg, cargas)
    mensajes = {
        'sin_carga': 'Selecciona al menos una carga preparada antes de iniciar.',
        'sin_capacidad': 'Capacidad sin verificar. Registra la capacidad del vehículo en toneladas antes de iniciar el viaje.',
        'peso_incompleto': 'Capacidad sin verificar. Revisa el peso real de todos los productos preparados antes de iniciar el viaje.',
        'excedida': 'La carga supera la capacidad del vehículo. Reduce la carga o elige otro vehículo antes de iniciar el viaje.',
    }
    if resultado['estado'] != 'apta':
        raise ValidationError({'capacidad': ErrorDetail(mensajes[resultado['estado']], code=resultado['estado'])})
    return resultado
