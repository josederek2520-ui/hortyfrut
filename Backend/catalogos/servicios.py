import hashlib
import json
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, diferencias


class ConflictoCatalogo(APIException):
    status_code = 409
    default_code = 'catalogo_modificado'
    default_detail = 'Este registro cambió. Recarga su versión actual antes de continuar.'


def estado_catalogo(registro):
    campos = ('nombre', 'abreviatura', 'activo') if hasattr(registro, 'abreviatura') else ('nombre', 'activo')
    return {campo: getattr(registro, campo) for campo in campos}


def version_catalogo(registro):
    datos = [registro.pk, registro.actualizado_en.isoformat(), estado_catalogo(registro)]
    return hashlib.sha256(json.dumps(datos, sort_keys=True).encode()).hexdigest()


def comprobar_version(registro, version):
    if version != version_catalogo(registro):
        raise ConflictoCatalogo()


def guardar_catalogo(modelo, actor, datos, instancia=None):
    try:
        with transaction.atomic():
            registro = get_object_or_404(modelo.objects.select_for_update(), pk=instancia.pk) if instancia else modelo()
            if instancia:
                comprobar_version(registro, datos['version'])
            antes = estado_catalogo(registro) if instancia else {}
            if instancia and hasattr(registro, 'abreviatura') and 'abreviatura' in datos and registro.abreviatura != datos['abreviatura']:
                from inventario.models import Lote
                from recepciones.models import DetalleRecepcion
                if Lote.objects.filter(unidad=registro).exists() or DetalleRecepcion.objects.filter(unidad_inventario=registro).exclude(recepcion__estado='cancelada').exists():
                    raise ValidationError({'abreviatura': 'Esta unidad ya se usa en recepciones o lotes. Crea otra unidad para cambiar su significado.'})
            for campo in ('nombre', 'abreviatura'):
                if campo in datos:
                    setattr(registro, campo, datos[campo])
            despues = estado_catalogo(registro)
            if not instancia or antes != despues:
                registro.save()
                registrar_actividad(modelo._meta.db_table, 'editar' if instancia else 'crear', actor=actor, objeto=registro,
                                    objeto_nombre=registro.nombre, cambios=diferencias(antes, despues))
            return registro
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion == 'unidad_abreviatura_unica':
            raise ValidationError({'abreviatura': 'Ya existe una unidad con esta abreviatura.'}) from error
        if restriccion in ('unidad_nombre_unico_ci', 'categoria_nombre_unico_ci'):
            raise ValidationError({'nombre': 'Ya existe un registro con este nombre.'}) from error
        raise


@transaction.atomic
def cambiar_estado_catalogo(modelo, actor, instancia, activo, version):
    registro = get_object_or_404(modelo.objects.select_for_update(), pk=instancia.pk)
    comprobar_version(registro, version)
    if registro.activo != activo:
        anterior = registro.activo
        registro.activo = activo
        registro.save()
        registrar_actividad(modelo._meta.db_table, 'activar' if activo else 'desactivar', actor=actor, objeto=registro,
                            objeto_nombre=registro.nombre, cambios={'activo': {'antes': anterior, 'despues': activo}})
    return registro
