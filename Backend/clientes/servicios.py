import hashlib
import json
from django.core.exceptions import ValidationError as ErrorValidacion
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError, PermissionDenied
from auditoria.servicios import registrar_actividad, diferencias
from .models import Cliente, Sucursal

CAMPOS_CLIENTE = ('razon_social', 'nit', 'telefono', 'email')
CAMPOS_SUCURSAL = ('nombre', 'direccion', 'telefono', 'referencia', 'latitud', 'longitud', 'encargado_pedidos_id')


class ConflictoComercial(APIException):
    status_code = 409
    default_code = 'registro_modificado'
    default_detail = 'Este registro cambió. Recarga la versión actual antes de continuar.'


def campos_registro(modelo):
    return CAMPOS_CLIENTE if modelo is Cliente else CAMPOS_SUCURSAL


def nombre_registro(registro):
    return registro.razon_social if isinstance(registro, Cliente) else registro.nombre


def estado_registro(registro):
    datos = {campo: getattr(registro, campo) for campo in (*campos_registro(type(registro)), 'activo')}
    if isinstance(registro, Sucursal):
        for campo in ('latitud', 'longitud'):
            datos[campo] = format(datos[campo], '.7f') if datos[campo] is not None else None
    return datos


def obtener_version(registro):
    datos = [registro.pk, registro.actualizado_en.isoformat(), estado_registro(registro)]
    if isinstance(registro, Sucursal):
        datos.append(registro.cliente_id)
    return hashlib.sha256(json.dumps(datos, sort_keys=True).encode()).hexdigest()


def comprobar_version(registro, version):
    if version != obtener_version(registro):
        raise ConflictoComercial()


def guardar_registro(modelo, actor, datos, instancia=None, cliente_id=None):
    desconocidos = set(datos) - {*campos_registro(modelo), 'version'}
    if desconocidos:
        raise ValidationError({campo: 'Este campo no se puede modificar.' for campo in desconocidos})
    try:
        with transaction.atomic():
            cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=cliente_id) if modelo is Sucursal else None
            if cliente and not instancia and not cliente.activo:
                raise ValidationError({'detail': 'Activa el cliente antes de agregar una sucursal.'})
            consulta = modelo.objects.select_for_update()
            if cliente:
                consulta = consulta.filter(cliente=cliente)
            registro = get_object_or_404(consulta, pk=instancia.pk) if instancia else modelo()
            if instancia:
                comprobar_version(registro, datos.get('version'))
            if cliente:
                registro.cliente = cliente
            antes = estado_registro(registro) if instancia else {}
            for campo in campos_registro(modelo):
                if campo in datos:
                    if campo == 'encargado_pedidos_id':
                        if not actor.has_perm('clientes.asignar_encargado'):
                            raise PermissionDenied('No tienes permiso para asignar encargados.')
                        if datos[campo] is not None:
                            from django.contrib.auth import get_user_model
                            encargado = get_object_or_404(get_user_model().objects.select_for_update(), pk=datos[campo], is_active=True)
                            if not encargado.has_perm('pedidos.view_pedido') or not encargado.has_perm('pedidos.add_pedido'):
                                raise ValidationError({'encargado_pedidos_id': 'El encargado necesita los permisos Ver pedidos y Crear pedidos.'})
                    setattr(registro, campo, datos[campo])
            try:
                registro.full_clean(validate_unique=False, validate_constraints=False)
            except ErrorValidacion as error:
                raise ValidationError(error.message_dict) from error
            despues = estado_registro(registro)
            if not instancia or antes != despues:
                registro.save()
                cambios = diferencias(antes, despues)
                if cliente:
                    cambios['cliente'] = {'id': cliente.pk, 'razon_social': cliente.razon_social}
                registrar_actividad(modelo._meta.db_table, 'editar' if instancia else 'crear', actor=actor, objeto=registro,
                                    objeto_nombre=nombre_registro(registro), cambios=cambios)
            return registro
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion == 'cliente_nit_unico':
            raise ValidationError({'nit': 'Ya existe un cliente con este NIT, incluso si está inactivo.'}) from error
        if restriccion == 'sucursal_nombre_unico_cliente':
            raise ValidationError({'nombre': 'Este cliente ya tiene una sucursal con ese nombre, incluso si está inactiva.'}) from error
        raise


@transaction.atomic
def cambiar_estado(modelo, actor, instancia, activo, version, cliente_id=None):
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=cliente_id) if modelo is Sucursal else None
    consulta = modelo.objects.select_for_update()
    if cliente:
        consulta = consulta.filter(cliente=cliente)
    registro = get_object_or_404(consulta, pk=instancia.pk)
    comprobar_version(registro, version)
    if activo and cliente and not cliente.activo:
        raise ValidationError({'detail': 'Activa el cliente antes de habilitar esta sucursal.'})
    if registro.activo != activo:
        anterior = registro.activo
        registro.activo = activo
        registro.save(update_fields=['activo', 'actualizado_en'])
        cambios = {'activo': {'antes': anterior, 'despues': activo}}
        if cliente:
            cambios['cliente'] = {'id': cliente.pk, 'razon_social': cliente.razon_social}
        registrar_actividad(modelo._meta.db_table, 'activar' if activo else 'desactivar', actor=actor, objeto=registro,
                            objeto_nombre=nombre_registro(registro), cambios=cambios)
    return registro
