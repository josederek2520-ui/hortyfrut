import hashlib
import json
from functools import partial
from django.core.exceptions import ValidationError as ErrorValidacion
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from auditoria.servicios import registrar_actividad, diferencias
from catalogos.models import CategoriaProducto, UnidadMedida
from catalogos.validadores import normalizar_nombre
from catalogos.servicios import ConflictoCatalogo
from .models import Producto
from .imagenes import preparar_imagen, eliminar_archivo_huerfano


def estado_producto(producto):
    return {'nombre': producto.nombre, 'categoria': {'id': producto.categoria_id, 'nombre': producto.categoria.nombre},
            'unidad_medida': {'id': producto.unidad_medida_id, 'nombre': producto.unidad_medida.nombre},
            'activo': producto.activo, 'imagen': producto.imagen.name or ''}


def version_producto(producto):
    # Las etiquetas de las relaciones pueden cambiar de forma independiente.
    datos = [producto.pk, producto.actualizado_en.isoformat(), producto.nombre,
             producto.categoria_id, producto.unidad_medida_id, producto.activo, producto.imagen.name or '']
    return hashlib.sha256(json.dumps(datos).encode()).hexdigest()


def comprobar_version(producto, version):
    if version != version_producto(producto):
        raise ConflictoCatalogo()


def guardar_producto(actor, datos, instancia=None):
    if datos.get('imagen') and datos.get('quitar_imagen'):
        raise ValidationError({'imagen': 'Selecciona una imagen o quítala; realiza una sola acción.'})
    imagen_preparada = preparar_imagen(datos['imagen']) if datos.get('imagen') else None
    archivo_nuevo = None
    almacenamiento = Producto._meta.get_field('imagen').storage
    try:
        with transaction.atomic():
            producto = get_object_or_404(Producto.objects.select_for_update(), pk=instancia.pk) if instancia else Producto()
            if instancia:
                comprobar_version(producto, datos.get('version'))
            antes = estado_producto(producto) if instancia else {}
            archivo_anterior = producto.imagen.name
            for campo, modelo in [('categoria', CategoriaProducto), ('unidad_medida', UnidadMedida)]:
                identificador = datos.get(campo, getattr(producto, f'{campo}_id'))
                relacionado = modelo.objects.select_for_update().filter(pk=identificador).first()
                if relacionado is None or (not relacionado.activo and (not instancia or identificador != getattr(producto, f'{campo}_id'))):
                    raise ValidationError({campo: 'Selecciona un registro activo y disponible.'})
                setattr(producto, campo, relacionado)
            if 'nombre' in datos:
                try:
                    producto.nombre = normalizar_nombre(datos['nombre'])
                except ErrorValidacion as error:
                    raise ValidationError({'nombre': error.messages}) from error
            if imagen_preparada:
                producto.imagen.save('producto.webp', imagen_preparada, save=False)
                archivo_nuevo = producto.imagen.name
            elif datos.get('quitar_imagen'):
                producto.imagen = ''
            despues = estado_producto(producto)
            if not instancia or antes != despues:
                producto.save()
                registrar_actividad('productos', 'editar' if instancia else 'crear', actor=actor, objeto=producto,
                                    objeto_nombre=producto.nombre, cambios=diferencias(antes, despues))
                if archivo_anterior and archivo_anterior != producto.imagen.name:
                    transaction.on_commit(partial(eliminar_archivo_huerfano, almacenamiento, archivo_anterior), robust=True)
            return producto
    except IntegrityError as error:
        if archivo_nuevo:
            eliminar_archivo_huerfano(almacenamiento, archivo_nuevo)
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion == 'producto_nombre_unico_ci':
            raise ValidationError({'nombre': 'Ya existe un producto con este nombre.'}) from error
        raise
    except Exception:
        if archivo_nuevo:
            eliminar_archivo_huerfano(almacenamiento, archivo_nuevo)
        raise


@transaction.atomic
def cambiar_estado_producto(actor, instancia, activo, version):
    producto = get_object_or_404(Producto.objects.select_for_update(), pk=instancia.pk)
    comprobar_version(producto, version)
    if producto.activo != activo:
        if activo:
            for campo, modelo in [('categoria', CategoriaProducto), ('unidad_medida', UnidadMedida)]:
                relacionado = modelo.objects.select_for_update().get(pk=getattr(producto, f'{campo}_id'))
                if not relacionado.activo:
                    etiqueta = 'La categoría' if campo == 'categoria' else 'La unidad de medida'
                    raise ValidationError({campo: f'{etiqueta} del producto está inactiva. Actívala o elige otra antes de activar el producto.'})
        anterior = producto.activo
        producto.activo = activo
        producto.save(update_fields=['activo', 'actualizado_en'])
        registrar_actividad('productos', 'activar' if activo else 'desactivar', actor=actor, objeto=producto,
                            objeto_nombre=producto.nombre, cambios={'activo': {'antes': anterior, 'despues': activo}})
    return producto
