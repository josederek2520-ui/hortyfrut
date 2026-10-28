import hashlib
import json
from django.core.exceptions import ValidationError as ErrorValidacion
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from auditoria.servicios import registrar_actividad, diferencias
from catalogos.servicios import ConflictoCatalogo
from .models import Producto, PresentacionProducto


def estado_presentacion(presentacion):
    return {'producto': {'id': presentacion.producto_id, 'nombre': presentacion.producto.nombre},
            'nombre': presentacion.nombre, 'uso': presentacion.uso, 'columna_pedido': presentacion.columna_pedido, 'activo': presentacion.activo}


def obtener_version_presentacion(presentacion):
    valores = [presentacion.pk, presentacion.actualizado_en.isoformat(), presentacion.producto_id,
               presentacion.nombre, presentacion.uso, presentacion.columna_pedido, presentacion.activo]
    return hashlib.sha256(json.dumps(valores).encode()).hexdigest()


def comprobar_version_presentacion(presentacion, version):
    if version != obtener_version_presentacion(presentacion):
        raise ConflictoCatalogo()


def guardar_presentacion(actor, producto_id, datos, instancia=None):
    """Bloquear primero el producto para coordinar los cambios de estado."""
    desconocidos = set(datos) - {'nombre', 'uso', 'columna_pedido', 'version'}
    if desconocidos:
        raise ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
    try:
        with transaction.atomic():
            producto = get_object_or_404(Producto.objects.select_for_update(), pk=producto_id)
            if not instancia and not producto.activo:
                raise ValidationError({'detail': 'Activa el producto antes de agregar una presentación.'})
            presentacion = get_object_or_404(PresentacionProducto.objects.select_for_update(), pk=instancia.pk, producto=producto) if instancia else PresentacionProducto(producto=producto)
            if instancia:
                comprobar_version_presentacion(presentacion, datos.get('version'))
            presentacion.producto = producto
            antes = estado_presentacion(presentacion) if instancia else {}
            for campo in ('nombre', 'uso', 'columna_pedido'):
                if campo in datos:
                    setattr(presentacion, campo, datos[campo])
            if presentacion.uso == 'compra' and presentacion.columna_pedido != 'otra':
                raise ValidationError({'columna_pedido': 'Una presentación solo de compras no pertenece a la hoja de pedidos.'})
            try:
                presentacion.full_clean(validate_unique=False, validate_constraints=False)
            except ErrorValidacion as error:
                raise ValidationError(error.message_dict) from error
            despues = estado_presentacion(presentacion)
            if not instancia or antes != despues:
                presentacion.save()
                registrar_actividad('presentaciones', 'editar' if instancia else 'crear', actor=actor, objeto=presentacion,
                                    objeto_nombre=f'{producto.nombre} · {presentacion.nombre}',
                                    cambios=diferencias(antes, estado_presentacion(presentacion)))
            return presentacion
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion == 'presentacion_nombre_unico_producto':
            raise ValidationError({'nombre': 'Este producto ya tiene una presentación con ese nombre, incluso si está inactiva.'}) from error
        if restriccion == 'presentacion_columna_unica':
            raise ValidationError({'columna_pedido': 'Este producto ya tiene una presentación para esa columna, incluso si está inactiva.'}) from error
        raise


@transaction.atomic
def cambiar_estado_presentacion(actor, producto_id, instancia, activo, version):
    producto = get_object_or_404(Producto.objects.select_for_update(), pk=producto_id)
    presentacion = get_object_or_404(PresentacionProducto.objects.select_for_update(), pk=instancia.pk, producto=producto)
    comprobar_version_presentacion(presentacion, version)
    if activo and not producto.activo:
        raise ValidationError({'detail': 'Activa el producto antes de habilitar esta presentación.'})
    if presentacion.activo != activo:
        anterior = presentacion.activo
        presentacion.activo = activo
        presentacion.save(update_fields=['activo', 'actualizado_en'])
        registrar_actividad('presentaciones', 'activar' if activo else 'desactivar', actor=actor, objeto=presentacion,
                            objeto_nombre=f'{producto.nombre} · {presentacion.nombre}',
                            cambios={'activo': {'antes': anterior, 'despues': activo}, 'producto': {'id': producto.pk, 'nombre': producto.nombre}})
    return presentacion
