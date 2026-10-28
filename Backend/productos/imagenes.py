import logging
import warnings
from io import BytesIO
from django.core.files.base import ContentFile
from PIL import Image as Imagen, ImageOps as OperacionesImagen, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

bitacora = logging.getLogger(__name__)
TAMANO_MAXIMO = 5 * 1024 * 1024
PIXELES_MAXIMOS = 20_000_000


def preparar_imagen(archivo):
    """Decodifica y vuelve a generar la imagen, sin confiar en extensión o MIME."""
    if not archivo or archivo.size > TAMANO_MAXIMO:
        raise ValidationError({'imagen': 'Selecciona una imagen de hasta 5 MB.'})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Imagen.DecompressionBombWarning)
            archivo.seek(0)
            with Imagen.open(archivo) as original:
                if original.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ValidationError({'imagen': 'Solo se admiten imágenes JPG, PNG o WebP.'})
                if original.width * original.height > PIXELES_MAXIMOS:
                    raise ValidationError({'imagen': 'La imagen supera los 20 megapíxeles. Reduce sus dimensiones.'})
                original.load()
                ajustada = OperacionesImagen.exif_transpose(original)
                ajustada.thumbnail((1600, 1600), Imagen.Resampling.LANCZOS)
                # Una imagen nueva conserva únicamente píxeles; excluye EXIF, ICC y texto.
                modo = 'RGBA' if 'A' in ajustada.getbands() or 'transparency' in original.info else 'RGB'
                convertida = ajustada.convert(modo)
                limpia = Imagen.new(modo, convertida.size)
                limpia.paste(convertida)
                salida = BytesIO()
                limpia.save(salida, format='WEBP', quality=85, method=4)
                return ContentFile(salida.getvalue(), name='producto.webp')
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Imagen.DecompressionBombError, Imagen.DecompressionBombWarning) as error:
        raise ValidationError({'imagen': 'No pudimos leer esta imagen. Selecciona un archivo JPG, PNG o WebP válido.'}) from error


def eliminar_archivo_huerfano(almacenamiento, nombre):
    from .models import Producto
    if nombre and not Producto.objects.filter(imagen=nombre).exists():
        try:
            almacenamiento.delete(nombre)
        except OSError:
            bitacora.exception('No se pudo retirar una imagen de producto sin referencias.')
