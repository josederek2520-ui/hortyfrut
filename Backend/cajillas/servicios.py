import hashlib
import json
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from almacenes.models import Almacen
from clientes.models import Cliente, Sucursal
from auditoria.servicios import registrar_actividad, nombre_responsable
from .models import Cajilla, MovimientoCajilla
from .permisos import exigir_permiso
from .consultas import version_cajilla, saldo_almacen, pendiente_sucursal
from .serializadores import SerializadorAltaCajilla, SerializadorAltaMovimiento


class ConflictoCajillas(APIException):
    status_code = 409
    default_code = 'cajillas_modificadas'
    default_detail = 'Los saldos cambiaron o la clave ya fue utilizada. Recarga los datos antes de continuar.'


def huella_datos(datos):
    return hashlib.sha256(json.dumps({campo: valor for campo, valor in datos.items() if campo not in ('version', 'clave_operacion')}, sort_keys=True, default=str).encode()).hexdigest()


def cargar_datos(serializador):
    serializador.is_valid(raise_exception=True)
    return serializador.validated_data


def comprobar_reintento(instancia, actor, huella, campo):
    if instancia.responsable_id != actor.pk or getattr(instancia, campo) != huella:
        raise ConflictoCajillas('Esta clave de operación ya se utilizó con otros datos o con otra cuenta.')
    return instancia


def crear_cajilla(actor, datos):
    exigir_permiso(actor, 'add_cajilla')
    datos = cargar_datos(SerializadorAltaCajilla(data=datos))
    huella = huella_datos(datos)
    try:
        with transaction.atomic():
            usuario = get_object_or_404(get_user_model().objects.select_for_update(no_key=True), pk=actor.pk)
            exigir_permiso(usuario, 'add_cajilla')
            if datos['cantidad_inicial']:
                exigir_permiso(usuario, 'registrar_ingreso')
            anterior = Cajilla.objects.filter(clave_operacion=datos['clave_operacion']).first()
            if anterior:
                return comprobar_reintento(anterior, actor, huella, 'huella_creacion'), False
            almacen = None
            if datos['cantidad_inicial']:
                almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=datos['almacen'])
                if not almacen.activo:
                    raise ValidationError({'almacen': 'Selecciona un almacén activo.'})
            cajilla = Cajilla.objects.create(color=datos['color'], responsable=usuario, responsable_nombre=nombre_responsable(usuario),
                clave_operacion=datos['clave_operacion'], huella_creacion=huella)
            registrar_actividad('cajillas', 'crear', actor=usuario, objeto=cajilla, objeto_nombre=cajilla.color,
                cambios={'color': cajilla.color, 'cantidad_inicial': datos['cantidad_inicial'], 'almacen': almacen.pk if almacen else None})
            if almacen:
                movimiento = MovimientoCajilla.objects.create(cajilla=cajilla, color=cajilla.color, tipo='inicial', cantidad=datos['cantidad_inicial'],
                    almacen=almacen, almacen_nombre=almacen.nombre, responsable=usuario, responsable_nombre=nombre_responsable(usuario),
                    clave_operacion=datos['clave_operacion'], huella_operacion=huella)
                auditar_movimiento(usuario, movimiento)
            return cajilla, True
    except IntegrityError as error:
        anterior = Cajilla.objects.filter(clave_operacion=datos['clave_operacion']).first()
        if anterior:
            return comprobar_reintento(anterior, actor, huella, 'huella_creacion'), False
        if getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '') == 'cajilla_color_unico_ci':
            raise ValidationError({'color': 'Este color ya está registrado. Abre su ficha para registrar un ingreso.'}) from error
        if MovimientoCajilla.objects.filter(clave_operacion=datos['clave_operacion']).exists():
            raise ConflictoCajillas('Esta clave de operación ya está registrada en otro movimiento de cajillas.') from error
        raise


def auditar_movimiento(actor, movimiento):
    registrar_actividad('cajillas', f'registrar_{movimiento.tipo}', actor=actor, objeto=movimiento, objeto_nombre=movimiento.codigo,
        cambios={'color': movimiento.color, 'cantidad': movimiento.cantidad, 'almacen': movimiento.almacen_nombre,
                 'sucursal': movimiento.sucursal_nombre, 'cliente': movimiento.cliente_nombre, 'observaciones': movimiento.observaciones})


@transaction.atomic
def registrar_movimiento(actor, cajilla_id, datos):
    exigir_permiso(actor)
    datos = cargar_datos(SerializadorAltaMovimiento(data=datos))
    codigo_permiso = f'registrar_{datos["tipo"]}'
    exigir_permiso(actor, codigo_permiso)
    usuario = get_object_or_404(get_user_model(), pk=actor.pk)
    exigir_permiso(usuario, codigo_permiso)
    huella = huella_datos({**datos, 'cajilla': int(cajilla_id)})
    anterior = MovimientoCajilla.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if anterior:
        return comprobar_reintento(anterior, usuario, huella, 'huella_operacion'), False
    # Compartir el orden Cliente -> Sucursal con Pedidos y Preparaciones.
    sucursal, cliente = None, None
    if datos['sucursal']:
        referencia = get_object_or_404(Sucursal, pk=datos['sucursal'])
        cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=referencia.cliente_id)
        sucursal = get_object_or_404(Sucursal.objects.select_for_update(), pk=referencia.pk, cliente=cliente)
    cajilla = get_object_or_404(Cajilla.objects.select_for_update(), pk=cajilla_id)
    anterior = MovimientoCajilla.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if anterior:
        return comprobar_reintento(anterior, usuario, huella, 'huella_operacion'), False
    if version_cajilla(cajilla) != datos['version']:
        raise ConflictoCajillas()
    almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=datos['almacen'])
    if not almacen.activo:
        raise ValidationError({'almacen': 'Selecciona un almacén activo.'})
    if datos['tipo'] == 'salida' and (not cliente.activo or not sucursal.activo):
        raise ValidationError({'sucursal': 'Para una salida, selecciona un cliente y una sucursal activos.'})
    if datos['tipo'] == 'salida':
        disponible = saldo_almacen(cajilla.pk, almacen.pk)
        if datos['cantidad'] > disponible:
            raise ValidationError({'cantidad': f'En este almacén hay {disponible} cajillas de este color. La salida no puede superar ese saldo.'})
    elif datos['tipo'] == 'devolucion':
        pendiente = pendiente_sucursal(cajilla.pk, sucursal.pk)
        if datos['cantidad'] > pendiente:
            raise ValidationError({'cantidad': f'Esta sucursal tiene {pendiente} cajillas pendientes de este color. La devolución no puede superar ese saldo.'})
    try:
        with transaction.atomic():
            movimiento = MovimientoCajilla.objects.create(cajilla=cajilla, color=cajilla.color, tipo=datos['tipo'], cantidad=datos['cantidad'],
                almacen=almacen, almacen_nombre=almacen.nombre, sucursal=sucursal,
                sucursal_nombre=sucursal.nombre if sucursal else '', cliente_nombre=cliente.razon_social if cliente else '',
                observaciones=datos['observaciones'], responsable=usuario, responsable_nombre=nombre_responsable(usuario),
                clave_operacion=datos['clave_operacion'], huella_operacion=huella)
    except IntegrityError:
        anterior = MovimientoCajilla.objects.filter(clave_operacion=datos['clave_operacion']).first()
        if anterior:
            return comprobar_reintento(anterior, usuario, huella, 'huella_operacion'), False
        raise
    auditar_movimiento(usuario, movimiento)
    return movimiento, True
