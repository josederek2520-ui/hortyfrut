import hashlib
import io
import uuid
from pathlib import Path
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.db import transaction
from rest_framework.exceptions import ValidationError
from PIL import Image
from .servicios import bloquear, operacion_previa, registrar, ConflictoEntrega
from .serializadores import SerializadorAccion
from .servicios import formulario
from .permisos import es_oficina


def almacenamiento():
    return FileSystemStorage(location=getattr(settings, 'ENTREGAS_ARCHIVOS_DIR', settings.BASE_DIR / 'privado' / 'entregas'))


def leer_comprobante(archivo):
    if not archivo or archivo.size > 8 * 1024 * 1024:
        raise ValidationError({'comprobante': 'Adjunta una imagen o PDF de hasta 8 MB.'})
    contenido = archivo.read(8 * 1024 * 1024 + 1)
    if contenido.startswith(b'%PDF-') and b'%%EOF' in contenido[-2048:]:
        return contenido, 'pdf', 'application/pdf'
    try:
        with Image.open(io.BytesIO(contenido)) as imagen:
            formato = imagen.format
            if imagen.width * imagen.height > 30000000 or formato not in ('JPEG', 'PNG', 'WEBP'):
                raise ValueError
            imagen.verify()
    except (OSError, ValueError, Image.DecompressionBombError):
        raise ValidationError({'comprobante': 'El archivo debe ser una imagen JPG, PNG, WebP o un PDF válido.'})
    extension, tipo = {'JPEG': ('jpg', 'image/jpeg'), 'PNG': ('png', 'image/png'), 'WEBP': ('webp', 'image/webp')}[formato]
    return contenido, extension, tipo


def guardar_comprobante(actor, despacho, pedido, datos, archivo):
    datos = formulario(SerializadorAccion, datos)
    contenido, extension, tipo = leer_comprobante(archivo)
    datos['archivo_sha256'] = hashlib.sha256(contenido).hexdigest()
    nuevo = None
    almacen = almacenamiento()
    try:
        with transaction.atomic():
            actor, origen, entrega = bloquear(actor, despacho, pedido, 'change_entrega')
            firma, repetida = operacion_previa(actor, origen, entrega, 'comprobante', datos)
            if repetida:
                return entrega
            if not entrega or entrega.estado == 'confirmada' or (entrega.estado == 'revision' and not es_oficina(actor)):
                raise ConflictoEntrega('Guarda un borrador editable antes de adjuntar el comprobante.')
            nuevo = almacen.save(f'{uuid.uuid4().hex}.{extension}', ContentFile(contenido))
            anterior = entrega.comprobante
            entrega.comprobante, entrega.comprobante_tipo = nuevo, tipo
            entrega.save()
            registrar(actor, entrega, 'comprobante', datos, firma)
            if anterior:
                transaction.on_commit(lambda: almacen.delete(anterior), robust=True)
            return entrega
    except Exception:
        if nuevo:
            almacen.delete(nuevo)
        raise
