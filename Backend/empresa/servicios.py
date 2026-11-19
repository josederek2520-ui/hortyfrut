import base64
import hashlib
import warnings
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import APIException, ValidationError
from rest_framework import serializers
from auditoria.servicios import registrar_actividad, diferencias
from precios.consultas import huella
from ventas.serializadores import SerializadorEstricto
from .models import DatosEmpresa, OperacionEmpresa
from .permisos import autorizar

CAMPOS = ('razon_social', 'nit', 'direccion', 'telefono', 'ciudad', 'logo_base64')


class ConflictoEmpresa(APIException):
    status_code = 409
    default_detail = 'Los datos de la empresa cambiaron. Recarga antes de guardar.'


class EntradaEmpresa(SerializadorEstricto):
    clave_operacion = serializers.UUIDField()
    version = serializers.CharField(max_length=64)
    razon_social = serializers.CharField(max_length=150, allow_blank=True)
    nit = serializers.RegexField(r'^[0-9]*$', max_length=20, allow_blank=True)
    direccion = serializers.CharField(max_length=250, allow_blank=True)
    telefono = serializers.CharField(max_length=30, allow_blank=True)
    ciudad = serializers.CharField(max_length=100, allow_blank=True)
    logo_base64 = serializers.CharField(max_length=2800000, allow_blank=True)


def estado_empresa(empresa):
    return {campo: getattr(empresa, campo) for campo in CAMPOS}


def version_empresa(empresa):
    return huella([empresa.actualizado_en, estado_empresa(empresa)])


def representar_empresa(empresa):
    datos = estado_empresa(empresa)
    return {**datos, 'version': version_empresa(empresa),
        'completa': all(datos[campo].strip() for campo in ('razon_social', 'nit', 'direccion', 'telefono', 'ciudad'))}


def instantanea_empresa():
    empresa = DatosEmpresa.objects.filter(pk=1).first()
    if not empresa:
        return None
    datos = representar_empresa(empresa)
    if not datos['completa']:
        return None
    if not datos['logo_base64']:
        logo = Path(settings.BASE_DIR).parent / 'Frontend/public/images/marca/logo-hortyfru-claro-transparente.png'
        if logo.is_file():
            datos['logo_base64'] = 'data:image/png;base64,' + base64.b64encode(logo.read_bytes()).decode('ascii')
    return {campo: datos[campo] for campo in CAMPOS}


def normalizar_logo(valor):
    if not valor:
        return ''
    try:
        cabecera, contenido = valor.split(',', 1)
        if cabecera not in ('data:image/png;base64', 'data:image/jpeg;base64', 'data:image/webp;base64'):
            raise ValueError()
        contenido = base64.b64decode(contenido, validate=True)
        if len(contenido) > 1024 * 1024:
            raise ValueError()
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(contenido)) as origen:
                if origen.width * origen.height > 16000000 or origen.format not in ('PNG', 'JPEG', 'WEBP'):
                    raise ValueError()
                logo = ImageOps.exif_transpose(origen).convert('RGBA')
                logo.thumbnail((800, 400))
                salida = BytesIO()
                logo.save(salida, format='PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(salida.getvalue()).decode('ascii')
    except (ValueError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValidationError({'logo_base64': 'Elige una imagen PNG, JPG o WebP válida de hasta 1 MB.'}) from error


@transaction.atomic
def guardar_empresa(actor, entrada):
    actor = autorizar(actor, True)
    formulario = EntradaEmpresa(data=entrada)
    formulario.is_valid(raise_exception=True)
    datos = formulario.validated_data
    empresa = DatosEmpresa.objects.select_for_update().get(pk=1)
    actor = autorizar(actor, True)
    firma = huella(datos)
    anterior = OperacionEmpresa.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if anterior:
        if (anterior.huella, anterior.responsable_id) != (firma, actor.pk):
            raise ConflictoEmpresa('La clave de operación pertenece a otros datos o responsable.')
        return empresa
    if datos['version'] != version_empresa(empresa):
        raise ConflictoEmpresa()
    antes = estado_empresa(empresa)
    if datos['logo_base64'] != empresa.logo_base64:
        datos['logo_base64'] = normalizar_logo(datos['logo_base64'])
    for campo in CAMPOS:
        setattr(empresa, campo, datos[campo])
    despues = estado_empresa(empresa)
    if antes != despues:
        empresa.save()
        for estado in (antes, despues):
            estado['logo_base64'] = hashlib.sha256(estado['logo_base64'].encode()).hexdigest() if estado['logo_base64'] else ''
        registrar_actividad('empresa', 'guardar', actor=actor, objeto=empresa, objeto_nombre='Datos de HortyFru', cambios=diferencias(antes, despues))
    OperacionEmpresa.objects.create(clave_operacion=datos['clave_operacion'], huella=firma, responsable=actor)
    return empresa
