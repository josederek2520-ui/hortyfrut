import hashlib
import json
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import diferencias, registrar_actividad
from catalogos.models import CategoriaProducto
from .models import Proveedor
from .permisos import exigir_permiso
from .serializadores import SerializadorEscrituraProveedor, SerializadorEstadoProveedor


class ConflictoProveedor(APIException):
    status_code = 409
    default_code = 'proveedor_modificado'
    default_detail = 'Este proveedor cambió. Recarga su versión actual antes de continuar.'


def version_proveedor(proveedor):
    datos = [proveedor.pk, proveedor.actualizado_en.isoformat(), proveedor.nombre, proveedor.categoria_id,
             proveedor.telefono, proveedor.direccion, proveedor.activo]
    return hashlib.sha256(json.dumps(datos).encode()).hexdigest()


def estado_proveedor(proveedor):
    categoria = {'id': proveedor.categoria_id, 'nombre': proveedor.categoria.nombre} if proveedor.categoria_id else None
    return {'nombre': proveedor.nombre, 'categoria': categoria, 'telefono': proveedor.telefono,
            'direccion': proveedor.direccion, 'activo': proveedor.activo}


def comprobar_version(proveedor, version):
    if version != version_proveedor(proveedor):
        raise ConflictoProveedor()


def guardar_proveedor(actor, datos, instancia=None):
    exigir_permiso(actor, 'change' if instancia else 'add')
    formulario = SerializadorEscrituraProveedor(instancia, data=datos, partial=instancia is not None)
    formulario.is_valid(raise_exception=True)
    datos = formulario.validated_data
    try:
        with transaction.atomic():
            proveedor = get_object_or_404(Proveedor.objects.select_for_update(), pk=instancia.pk) if instancia else Proveedor()
            if instancia:
                comprobar_version(proveedor, datos.get('version'))
            antes = estado_proveedor(proveedor) if instancia else {}
            if 'categoria' in datos:
                identificador = datos['categoria']
                categoria = CategoriaProducto.objects.select_for_update().filter(pk=identificador).first() if identificador else None
                if identificador and (categoria is None or (not categoria.activo and identificador != proveedor.categoria_id)):
                    raise ValidationError({'categoria': 'Selecciona una categoría activa y disponible.'})
                proveedor.categoria = categoria
            for campo in ('nombre', 'telefono', 'direccion'):
                if campo in datos:
                    setattr(proveedor, campo, datos[campo])
            despues = estado_proveedor(proveedor)
            if not instancia or antes != despues:
                proveedor.save()
                registrar_actividad('proveedores', 'editar' if instancia else 'crear', actor=actor, objeto=proveedor,
                                    objeto_nombre=proveedor.nombre, cambios=diferencias(antes, despues))
            return proveedor
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion == 'proveedor_nombre_unico_ci':
            raise ValidationError({'nombre': 'Ya existe un proveedor con este nombre, incluso si está inactivo.'}) from error
        raise


@transaction.atomic
def cambiar_estado_proveedor(actor, instancia, datos):
    exigir_permiso(actor, 'cambiar_estado')
    formulario = SerializadorEstadoProveedor(data=datos)
    formulario.is_valid(raise_exception=True)
    proveedor = get_object_or_404(Proveedor.objects.select_for_update(), pk=instancia.pk)
    comprobar_version(proveedor, formulario.validated_data['version'])
    activo = formulario.validated_data['activo']
    if proveedor.activo != activo:
        anterior = proveedor.activo
        proveedor.activo = activo
        proveedor.save(update_fields=['activo', 'actualizado_en'])
        registrar_actividad('proveedores', 'activar' if activo else 'desactivar', actor=actor, objeto=proveedor,
                            objeto_nombre=proveedor.nombre, cambios={'activo': {'antes': anterior, 'despues': activo}})
    return proveedor
