import hashlib
import json
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import diferencias, registrar_actividad
from .models import Almacen
from .permisos import exigir_permiso
from .serializadores import SerializadorEscrituraAlmacen, SerializadorEstadoAlmacen


class ConflictoAlmacen(APIException):
    status_code = 409
    default_code = 'almacen_modificado'
    default_detail = 'Este almacén cambió. Recarga sus datos antes de continuar.'


def estado_almacen(almacen):
    return {'nombre': almacen.nombre, 'direccion': almacen.direccion, 'activo': almacen.activo,
            **{campo: format(getattr(almacen, campo), '.7f') if getattr(almacen, campo) is not None else None for campo in ('latitud', 'longitud')}}


def version_almacen(almacen):
    datos = [almacen.pk, almacen.actualizado_en.isoformat(), estado_almacen(almacen)]
    return hashlib.sha256(json.dumps(datos, sort_keys=True).encode()).hexdigest()


def comprobar_version(almacen, version):
    if version != version_almacen(almacen):
        raise ConflictoAlmacen()


def guardar_almacen(actor, datos, instancia=None):
    exigir_permiso(actor, 'change' if instancia else 'add')
    try:
        with transaction.atomic():
            almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=instancia.pk) if instancia else Almacen()
            # Validar contra el registro bloqueado para resolver correctamente un PATCH
            # parcial de coordenadas y rechazar versiones desactualizadas.
            formulario = SerializadorEscrituraAlmacen(almacen if instancia else None, data=datos, partial=instancia is not None)
            formulario.is_valid(raise_exception=True)
            valores = formulario.validated_data
            if instancia:
                comprobar_version(almacen, valores.get('version'))
            antes = estado_almacen(almacen) if instancia else {}
            for campo in ('nombre', 'direccion', 'latitud', 'longitud'):
                if campo in valores:
                    setattr(almacen, campo, valores[campo])
            despues = estado_almacen(almacen)
            if not instancia or antes != despues:
                almacen.save()
                registrar_actividad('almacenes', 'editar' if instancia else 'crear', actor=actor, objeto=almacen,
                                    objeto_nombre=almacen.nombre, cambios=diferencias(antes, despues))
            return almacen
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion == 'almacen_nombre_unico_ci':
            raise ValidationError({'nombre': 'Ya existe un almacén con este nombre, incluso si está inactivo.'}) from error
        raise


@transaction.atomic
def cambiar_estado_almacen(actor, instancia, datos):
    exigir_permiso(actor, 'cambiar_estado')
    formulario = SerializadorEstadoAlmacen(data=datos)
    formulario.is_valid(raise_exception=True)
    almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=instancia.pk)
    comprobar_version(almacen, formulario.validated_data['version'])
    activo = formulario.validated_data['activo']
    if almacen.activo != activo:
        anterior = almacen.activo
        almacen.activo = activo
        almacen.save(update_fields=['activo', 'actualizado_en'])
        registrar_actividad('almacenes', 'activar' if activo else 'desactivar', actor=actor, objeto=almacen,
                            objeto_nombre=almacen.nombre, cambios={'activo': {'antes': anterior, 'despues': activo}})
    return almacen
