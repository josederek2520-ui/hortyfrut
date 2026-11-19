import hashlib
import json
from rest_framework.exceptions import ValidationError
from entregas.comprobantes import leer_comprobante

LIMITE_COMPROBANTE = 8 * 1024 * 1024
EXTENSIONES_COMPROBANTE = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf'}


def extraer_entrada(request):
    if not request.content_type.startswith('multipart/form-data'):
        return request.data, None
    if (set(request.data) - {'datos', 'comprobante'} or len(request.data.getlist('datos')) != 1
            or len(request.FILES.getlist('comprobante')) != 1
            or set(request.FILES) != {'comprobante'}):
        raise ValidationError({'comprobante': 'Envía los datos del cobro y un único comprobante.'})
    try:
        datos = json.loads(request.data['datos'])
    except (TypeError, ValueError):
        raise ValidationError({'datos': 'Los datos del cobro no son válidos.'})
    if not isinstance(datos, dict):
        raise ValidationError({'datos': 'Los datos del cobro no son válidos.'})
    return datos, request.FILES['comprobante']


def preparar_comprobante(archivo):
    if archivo is None:
        return None
    archivo.seek(0)
    contenido, extension, tipo = leer_comprobante(archivo)
    if not contenido or len(contenido) > LIMITE_COMPROBANTE:
        raise ValidationError({'comprobante': 'Adjunta una imagen o PDF de hasta 8 MB.'})
    nombre = str(archivo.name).replace('\\', '/').rsplit('/', 1)[-1]
    nombre = ''.join(letra for letra in nombre if ord(letra) >= 32).strip()[:150] or 'comprobante.' + extension
    return {'contenido': contenido, 'nombre': nombre, 'tipo': tipo, 'tamano': len(contenido),
        'sha256': hashlib.sha256(contenido).hexdigest()}


def metadatos_comprobante(comprobante):
    if comprobante is None:
        return None
    return {campo: comprobante[campo] for campo in ['nombre', 'tipo', 'tamano', 'sha256']}


def comprobar_medio_comprobante(datos, comprobante):
    if datos['medio'] == 'cheque':
        raise ValidationError({'medio': 'Cheque no está disponible para cobros nuevos.'})
    requiere = datos['medio'] in ('transferencia', 'deposito')
    if requiere and comprobante is None:
        raise ValidationError({'comprobante': 'Adjunta el comprobante de la transferencia o del depósito.'})
    if not requiere and comprobante is not None:
        raise ValidationError({'comprobante': 'El comprobante corresponde únicamente a transferencias y depósitos.'})
