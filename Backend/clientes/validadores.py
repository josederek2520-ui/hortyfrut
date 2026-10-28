import re
from django.core.exceptions import ValidationError


def normalizar_texto(valor):
    return re.sub(r'\s+', ' ', valor or '').strip()


def validar_digitos(valor):
    if valor and re.fullmatch(r'[0-9]+', valor) is None:
        raise ValidationError('Usa solo números del 0 al 9, sin espacios ni signos.')
