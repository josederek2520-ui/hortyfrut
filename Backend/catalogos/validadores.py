import re
from django.core.exceptions import ValidationError


def normalizar_nombre(valor):
    nombre = re.sub(r'\s+', ' ', valor).strip()
    if not nombre:
        raise ValidationError('Ingresa un nombre.')
    if len(nombre) > 100:
        raise ValidationError('El nombre debe tener como máximo 100 caracteres.')
    return nombre


def normalizar_abreviatura(valor):
    abreviatura = valor.strip()
    if not abreviatura or re.search(r'\s', abreviatura):
        raise ValidationError('La abreviatura es obligatoria y no debe contener espacios.')
    if len(abreviatura) > 10:
        raise ValidationError('La abreviatura debe tener como máximo 10 caracteres.')
    return abreviatura
