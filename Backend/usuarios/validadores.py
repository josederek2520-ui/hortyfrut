from django.core.exceptions import ValidationError
from django.core.validators import validate_email


def normalizar_correo(correo):
    if not isinstance(correo, str) or not correo.strip():
        raise ValidationError('El correo electrónico es obligatorio.')
    normalizado = correo.strip().lower()
    if len(normalizado) > 254:
        raise ValidationError('El correo electrónico debe tener como máximo 254 caracteres.')
    validate_email(normalizado)
    return normalizado
