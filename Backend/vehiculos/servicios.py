import hashlib
import logging
import uuid
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import diferencias, registrar_actividad, nombre_responsable
from productos.imagenes import preparar_imagen
from .models import Vehiculo
from .permisos import exigir_permiso
from .serializadores import SerializadorEscrituraVehiculo, SerializadorEstadoVehiculo

bitacora = logging.getLogger(__name__)


def eliminar_imagen_sin_referencia(almacenamiento, nombre):
    if not Vehiculo.objects.filter(imagen=nombre).exists():
        try:
            almacenamiento.delete(nombre)
        except OSError:
            bitacora.exception('No se pudo retirar una imagen de vehículo sin referencias.')


class ConflictoVehiculo(APIException):
    status_code = 409
    default_detail = 'El vehículo cambió. Recarga sus datos antes de continuar.'


def version_vehiculo(vehiculo):
    return hashlib.sha256(f'{vehiculo.pk}:{vehiculo.actualizado_en.isoformat()}'.encode()).hexdigest()


def comprobar_version(vehiculo, version):
    if version != version_vehiculo(vehiculo):
        raise ConflictoVehiculo()


def estado_vehiculo(vehiculo):
    return {campo: str(getattr(vehiculo, campo)) if campo == 'capacidad_kg' else getattr(vehiculo, campo) for campo in ('placa', 'tipo', 'marca', 'capacidad_kg', 'activo')}


def guardar_vehiculo(actor, datos, instancia=None):
    exigir_permiso(actor, 'change' if instancia else 'add')
    archivo_nuevo = None
    try:
        with transaction.atomic():
            vehiculo = get_object_or_404(Vehiculo.objects.select_for_update(), pk=instancia.pk) if instancia else Vehiculo(responsable=actor, responsable_nombre=nombre_responsable(actor))
            formulario = SerializadorEscrituraVehiculo(vehiculo if instancia else None, data=datos, partial=instancia is not None)
            formulario.is_valid(raise_exception=True)
            valores = formulario.validated_data
            if instancia:
                comprobar_version(vehiculo, valores['version'])
            antes = estado_vehiculo(vehiculo) if instancia else {}
            for campo in ('placa', 'tipo', 'marca', 'capacidad_kg'):
                if campo in valores:
                    setattr(vehiculo, campo, valores[campo])
            if Vehiculo.objects.filter(placa=vehiculo.placa).exclude(pk=vehiculo.pk).exists():
                raise ValidationError({'placa': 'Esta placa ya está registrada, incluso si el vehículo está inactivo.'})
            anterior = vehiculo.imagen.name
            if valores.get('imagen'):
                archivo = preparar_imagen(valores['imagen'])
                vehiculo.imagen.save(f'{uuid.uuid4().hex}.webp', archivo, save=False)
                archivo_nuevo = (vehiculo.imagen.storage, vehiculo.imagen.name)
            elif valores.get('quitar_imagen'):
                vehiculo.imagen = ''
            vehiculo.save()
            cambios = diferencias(antes, estado_vehiculo(vehiculo))
            if anterior != vehiculo.imagen.name:
                cambios['imagen'] = {'antes': bool(anterior), 'despues': bool(vehiculo.imagen)}
                if anterior:
                    almacenamiento = vehiculo.imagen.storage
                    transaction.on_commit(lambda: eliminar_imagen_sin_referencia(almacenamiento, anterior))
            registrar_actividad('vehiculos', 'editar' if instancia else 'crear', actor=actor, objeto=vehiculo, objeto_nombre=vehiculo.placa, cambios=cambios)
            return vehiculo
    except Exception as error:
        if archivo_nuevo:
            eliminar_imagen_sin_referencia(*archivo_nuevo)
        if isinstance(error, IntegrityError) and Vehiculo.objects.filter(placa=str(datos.get('placa', '')).strip().upper()).exists():
            raise ValidationError({'placa': 'Esta placa ya está registrada.'}) from error
        raise


@transaction.atomic
def cambiar_estado_vehiculo(actor, instancia, datos):
    exigir_permiso(actor, 'cambiar_estado')
    formulario = SerializadorEstadoVehiculo(data=datos)
    formulario.is_valid(raise_exception=True)
    vehiculo = get_object_or_404(Vehiculo.objects.select_for_update(), pk=instancia.pk)
    comprobar_version(vehiculo, formulario.validated_data['version'])
    activo = formulario.validated_data['activo']
    if not activo and vehiculo.despachos.filter(estado='en_ruta').exists():
        raise ValidationError({'activo': 'Este vehículo tiene un despacho en ruta. Finaliza el viaje antes de desactivarlo.'})
    if vehiculo.activo != activo:
        anterior = vehiculo.activo
        vehiculo.activo = activo
        vehiculo.save(update_fields=['activo', 'actualizado_en'])
        registrar_actividad('vehiculos', 'activar' if activo else 'desactivar', actor=actor, objeto=vehiculo, objeto_nombre=vehiculo.placa, cambios={'activo': {'antes': anterior, 'despues': activo}})
    return vehiculo
