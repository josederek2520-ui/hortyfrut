import hashlib
import json
import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from clientes.models import Cliente, Sucursal
from pedidos.models import Pedido, DetallePedido
from productos.models import Producto
from catalogos.models import CategoriaProducto, UnidadMedida
from almacenes.models import Almacen
from cajillas.models import Cajilla
from inventario.models import Lote, MovimientoInventario, DetalleMovimientoInventario
from inventario.consultas import lotes_con_saldo, es_kilogramo
from inventario.servicios import _crear_lote_con_codigo
from compras.serializadores import SerializadorAccionCompra, SerializadorCancelacionCompra
from .models import Preparacion, LineaPreparacion, AsignacionPreparacion, AportePreparacion, CajillaPrevista
from .permisos import exigir_permiso
from .consultas import version_preparacion, avance_detalles
from .serializadores import SerializadorEscrituraPreparacion, leer_formulario


class ConflictoPreparacion(APIException):
    status_code = 409
    default_code = 'preparacion_modificada'
    default_detail = 'La preparación o sus datos de origen cambiaron. Recarga antes de continuar.'


def bloquear_contexto(cliente_id, fecha):
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=cliente_id)
    sucursales = {obj.pk: obj for obj in Sucursal.objects.select_for_update().filter(cliente=cliente).order_by('pk')}
    pedidos = {obj.pk: obj for obj in Pedido.objects.select_for_update().filter(sucursal_id__in=sucursales, fecha_requerida=fecha).order_by('pk')}
    return cliente, sucursales, pedidos


def datos_documento(preparacion):
    return {'cliente': preparacion.cliente_id, 'fecha_pedidos': preparacion.fecha_pedidos, 'almacen': preparacion.almacen_id,
        'observaciones': preparacion.observaciones,
        'lineas': [{'lote': fila.lote_id, 'cantidad_utilizada': fila.cantidad_utilizada, 'merma': fila.merma,
                    'aprovechable': fila.aprovechable, 'motivo_separacion': fila.motivo_separacion} for fila in preparacion.lineas.order_by('pk')],
        'asignaciones': [{'detalle_pedido': fila.detalle_pedido_id, 'cantidad': fila.cantidad,
            'aportes': [{'lote': aporte.linea.lote_id, 'cantidad': aporte.cantidad, 'peso_kg': aporte.peso_kg}
                for aporte in fila.aportes.all()]} for fila in preparacion.asignaciones.prefetch_related(
                    Prefetch('aportes', queryset=AportePreparacion.objects.select_related('linea').order_by('pk'))).order_by('pk')],
        'cajillas': [{'sucursal': fila.sucursal_id, 'cajilla': fila.cajilla_id, 'cantidad': fila.cantidad} for fila in preparacion.cajillas.order_by('pk')]}


def _construir_documento(datos, cliente, sucursales, pedidos, confirmar=False):
    detalles = {obj.pk: obj for obj in DetallePedido.objects.select_for_update().filter(pedido_id__in=pedidos).order_by('pk')}
    lotes_base = list(Lote.objects.filter(pk__in={fila['lote'] for fila in datos['lineas']}).values('id', 'producto_id', 'unidad_id'))
    productos = {obj.pk: obj for obj in Producto.objects.select_for_update().filter(pk__in={fila['producto_id'] for fila in lotes_base}).order_by('pk')}
    categorias = {obj.pk: obj for obj in CategoriaProducto.objects.select_for_update().filter(pk__in={obj.categoria_id for obj in productos.values()}).order_by('pk')}
    unidades = {obj.pk: obj for obj in UnidadMedida.objects.select_for_update().filter(pk__in={fila['unidad_id'] for fila in lotes_base}).order_by('pk')}
    almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=datos['almacen'])
    if not cliente.activo or not almacen.activo:
        raise ValidationError({'almacen': 'El cliente y el almacén deben estar activos.'})
    lotes = {obj.pk: obj for obj in Lote.objects.select_for_update().filter(pk__in={fila['id'] for fila in lotes_base}).order_by('pk')}
    saldos = {obj.pk: obj.saldo for obj in lotes_con_saldo(almacen.pk).filter(pk__in=lotes)} if confirmar else {}
    productos_pedidos = {obj.producto_id for obj in detalles.values() if pedidos[obj.pedido_id].estado != 'cancelado'}
    lineas, asignaciones, aportes, planes = {}, [], [], []
    cantidades_asignadas = {}
    for indice, fila in enumerate(datos['lineas']):
        lote = lotes.get(fila['lote'])
        if not lote or lote.producto_id not in productos_pedidos:
            raise ValidationError({f'lineas_{indice}_lote': 'Selecciona un lote de un producto solicitado por este cliente y fecha.'})
        if lote.pk in lineas:
            raise ValidationError({f'lineas_{indice}_lote': 'El lote ya está incluido. Agrupa su uso en una sola línea.'})
        producto, unidad = productos[lote.producto_id], unidades[lote.unidad_id]
        if confirmar:
            if lote.calidad != 'apto' or lote.estado != 'disponible' or not producto.activo or not categorias[producto.categoria_id].activo or not unidad.activo:
                raise ValidationError({f'lineas_{indice}_lote': 'El lote, producto, categoría y unidad deben estar disponibles para pedidos.'})
            if lote.fecha_vencimiento and lote.fecha_vencimiento < max(timezone.localdate(), datos['fecha_pedidos']):
                raise ValidationError({f'lineas_{indice}_lote': 'El lote vence antes de la fecha prevista para el pedido o ya está vencido.'})
            if lote.fecha_ingreso > timezone.localdate() or fila['cantidad_utilizada'] <= 0 or fila['cantidad_utilizada'] > saldos.get(lote.pk, Decimal('0')):
                raise ValidationError({f'lineas_{indice}_cantidad_utilizada': f'Registra una cantidad positiva que no supere el saldo de {saldos.get(lote.pk, 0)} {lote.unidad_abreviatura} en este almacén.'})
        if (fila['merma'] or fila['aprovechable']) and not fila['motivo_separacion'].strip():
            raise ValidationError({f'lineas_{indice}_motivo_separacion': 'Describe el motivo de la separación de calidad.'})
        lineas[lote.pk] = LineaPreparacion(lote=lote, producto=producto, unidad=unidad, producto_nombre=lote.producto_nombre,
            unidad_nombre=lote.unidad_nombre, unidad_abreviatura=lote.unidad_abreviatura, cantidad_utilizada=fila['cantidad_utilizada'],
            merma=fila['merma'], aprovechable=fila['aprovechable'], motivo_separacion=fila['motivo_separacion'])
        cantidades_asignadas[lote.pk] = Decimal('0')
    avances = avance_detalles(detalles) if confirmar else {}
    usados, sucursales_asignadas = set(), set()
    for indice, fila in enumerate(datos['asignaciones']):
        detalle = detalles.get(fila['detalle_pedido'])
        if not detalle or pedidos[detalle.pedido_id].estado == 'cancelado':
            raise ValidationError({f'asignaciones_{indice}_detalle_pedido': 'La línea del pedido cambió, fue retirada o no corresponde al cliente y fecha. Quita esta asignación y revisa los pendientes.'})
        if detalle.pk in usados:
            raise ValidationError({f'asignaciones_{indice}_detalle_pedido': 'Esta cantidad del pedido ya tiene una asignación. Agrega los aportes de sus lotes dentro de esa asignación.'})
        usados.add(detalle.pk)
        pedido = pedidos[detalle.pedido_id]
        sucursal = sucursales[pedido.sucursal_id]
        if confirmar and fila['cantidad'] > 0:
            if pedido.estado != 'pendiente' or not sucursal.activo:
                raise ValidationError({f'asignaciones_{indice}_detalle_pedido': 'El pedido y su sucursal ya no están disponibles para preparar.'})
            pendiente = max(0, detalle.cantidad - avances.get(detalle.pk, 0))
            if fila['cantidad'] > pendiente:
                raise ValidationError({f'asignaciones_{indice}_cantidad': f'Esta línea tiene {pendiente} pendientes. La asignación no puede superar lo solicitado.'})
            sucursales_asignadas.add(sucursal.pk)
        asignacion = AsignacionPreparacion(pedido=pedido, detalle_pedido=detalle, sucursal=sucursal, sucursal_nombre=pedido.sucursal_nombre,
            producto_id=detalle.producto_id, producto_nombre=detalle.producto_nombre, presentacion_nombre=detalle.presentacion_nombre,
            columna=detalle.columna, cantidad_solicitada=detalle.cantidad, cantidad=fila['cantidad'])
        asignaciones.append(asignacion)
        fuentes, tiene_aportes = set(), False
        for posicion, dato in enumerate(fila['aportes']):
            linea = lineas.get(dato['lote'])
            prefijo = f'asignaciones_{indice}_aportes_{posicion}'
            if not linea or linea.producto_id != detalle.producto_id or linea.lote_id in fuentes:
                raise ValidationError({f'{prefijo}_lote': 'Selecciona una vez cada lote del producto de este pedido.'})
            fuentes.add(linea.lote_id)
            peso = dato['peso_kg']
            if es_kilogramo(linea.unidad) and dato['cantidad'] > 0:
                if peso is not None and peso != dato['cantidad']:
                    raise ValidationError({f'{prefijo}_peso_kg': 'Cuando el lote está en kg, cantidad y peso real deben coincidir.'})
                peso = dato['cantidad']
            if confirmar and (dato['cantidad'] <= 0 or peso is None):
                raise ValidationError({f'{prefijo}_cantidad' if dato['cantidad'] <= 0 else f'{prefijo}_peso_kg': 'Registra cantidades y pesos reales positivos en los aportes utilizados.'})
            aportes.append(AportePreparacion(linea=linea, asignacion=asignacion, cantidad=dato['cantidad'], peso_kg=peso))
            cantidades_asignadas[linea.lote_id] += dato['cantidad']
            tiene_aportes = tiene_aportes or dato['cantidad'] > 0
        if confirmar and ((fila['cantidad'] > 0 and not tiene_aportes) or (fila['cantidad'] == 0 and tiene_aportes)):
            raise ValidationError({f'asignaciones_{indice}_cantidad': 'Las cantidades CANT/UNI preparadas deben tener sus aportes reales medidos. Los aportes no completan automáticamente las cantidades solicitadas.'})
    if confirmar:
        if not lineas:
            raise ValidationError({'lineas': 'Agrega al menos un lote con cantidad utilizada antes de confirmar.'})
        for indice, linea in enumerate(lineas.values()):
            total = cantidades_asignadas[linea.lote_id] + linea.merma + linea.aprovechable
            if linea.cantidad_utilizada != total:
                raise ValidationError({f'lineas_{indice}_cantidad_utilizada': f'La cantidad utilizada debe coincidir con lo asignado más merma y aprovechable: {total} {linea.unidad_abreviatura}.'})
    colores = {obj.pk: obj for obj in Cajilla.objects.filter(pk__in={fila['cajilla'] for fila in datos['cajillas']})}
    claves = set()
    for indice, fila in enumerate(datos['cajillas']):
        sucursal, cajilla = sucursales.get(fila['sucursal']), colores.get(fila['cajilla'])
        clave = (fila['sucursal'], fila['cajilla'])
        if not sucursal or not cajilla or clave in claves or not any(pedido.sucursal_id == sucursal.pk and pedido.estado != 'cancelado' for pedido in pedidos.values()):
            raise ValidationError({f'cajillas_{indice}_cajilla': 'Revisa la sucursal del cliente y el color. Agrupa las cajillas del mismo color y destino.'})
        if confirmar and sucursal.pk not in sucursales_asignadas:
            raise ValidationError({f'cajillas_{indice}_sucursal': 'Esta sucursal no tiene cantidades preparadas en esta preparación.'})
        claves.add(clave)
        planes.append(CajillaPrevista(sucursal=sucursal, sucursal_nombre=sucursal.nombre, cajilla=cajilla, color=cajilla.color, cantidad=fila['cantidad']))
    return almacen, list(lineas.values()), asignaciones, aportes, planes


def _guardar_documento(preparacion, documento):
    almacen, lineas, asignaciones, aportes, planes = documento
    preparacion.almacen, preparacion.almacen_nombre = almacen, almacen.nombre
    preparacion.asignaciones.all().delete()
    preparacion.lineas.all().delete()
    preparacion.cajillas.all().delete()
    for objetos in (lineas, asignaciones, planes):
        for objeto in objetos:
            objeto.preparacion = preparacion
        if objetos:
            objetos[0].__class__.objects.bulk_create(objetos)
    for aporte in aportes:
        aporte.linea_id, aporte.asignacion_id = aporte.linea.pk, aporte.asignacion.pk
    AportePreparacion.objects.bulk_create(aportes)


def guardar_preparacion(actor, datos, instancia=None):
    codigo = 'change_preparacion' if instancia else 'add_preparacion'
    exigir_permiso(actor, codigo)
    datos = leer_formulario(SerializadorEscrituraPreparacion(instancia, data=datos))
    huella = hashlib.sha256(json.dumps({campo: valor for campo, valor in datos.items() if campo not in ('version', 'clave_operacion')}, default=str, sort_keys=True).encode()).hexdigest()
    try:
        with transaction.atomic():
            usuario = get_object_or_404(get_user_model(), pk=actor.pk)
            exigir_permiso(usuario, codigo)
            cliente, sucursales, pedidos = bloquear_contexto(datos['cliente'], datos['fecha_pedidos'])
            if not instancia:
                anterior = Preparacion.objects.filter(clave_operacion=datos['clave_operacion']).first()
                if anterior:
                    if anterior.responsable_id != actor.pk or anterior.huella_creacion != huella:
                        raise ConflictoPreparacion('Esta clave de creación ya fue utilizada con otros datos.')
                    return anterior, False
            preparacion = get_object_or_404(Preparacion.objects.select_for_update(), pk=instancia.pk) if instancia else Preparacion()
            if instancia and (preparacion.estado != 'borrador' or datos['version'] != version_preparacion(preparacion)):
                raise ConflictoPreparacion('Solo se pueden editar borradores con su versión actual.')
            documento = _construir_documento(datos, cliente, sucursales, pedidos)
            preparacion.cliente, preparacion.cliente_nombre, preparacion.fecha_pedidos = cliente, cliente.razon_social, datos['fecha_pedidos']
            preparacion.almacen, preparacion.almacen_nombre = documento[0], documento[0].nombre
            preparacion.observaciones = datos['observaciones']
            if not instancia:
                preparacion.responsable, preparacion.responsable_nombre = usuario, nombre_responsable(usuario)
                preparacion.clave_operacion, preparacion.huella_creacion = datos['clave_operacion'], huella
            preparacion.save()
            _guardar_documento(preparacion, documento)
            registrar_actividad('preparaciones', 'editar' if instancia else 'crear', actor=usuario, objeto=preparacion, objeto_nombre=preparacion.codigo,
                cambios={'cliente': cliente.razon_social, 'fecha_pedidos': str(preparacion.fecha_pedidos), 'documento': datos_documento(preparacion)})
            return preparacion, not bool(instancia)
    except IntegrityError as error:
        anterior = Preparacion.objects.filter(clave_operacion=datos.get('clave_operacion')).first() if not instancia else None
        if anterior:
            if anterior.responsable_id == actor.pk and anterior.huella_creacion == huella:
                return anterior, False
            raise ConflictoPreparacion('Esta clave de creación ya fue utilizada con otros datos.') from error
        raise


def _crear_movimiento_confirmado(actor, preparacion, tipo, naturaleza, clave):
    exigir_permiso(actor, 'confirmar_preparacion')
    if not transaction.get_connection().in_atomic_block or preparacion.estado != 'borrador':
        raise ValidationError({'estado': 'El inventario se modifica desde la confirmación de la preparación.'})
    try:
        with transaction.atomic():
            return MovimientoInventario.objects.create(almacen=preparacion.almacen, almacen_nombre=preparacion.almacen_nombre, tipo=tipo,
                naturaleza=naturaleza, fecha=timezone.localdate(), referencia_tipo='preparacion', referencia_id=preparacion.pk,
                referencia_codigo=preparacion.codigo, clave_operacion=clave, responsable=actor, responsable_nombre=nombre_responsable(actor))
    except IntegrityError as error:
        raise ConflictoPreparacion('Ya existe una operación de inventario para esta preparación o clave.') from error


@transaction.atomic
def confirmar_preparacion(actor, instancia, datos):
    exigir_permiso(actor, 'confirmar_preparacion')
    datos = leer_formulario(SerializadorAccionCompra(data=datos))
    usuario = get_object_or_404(get_user_model(), pk=actor.pk)
    exigir_permiso(usuario, 'confirmar_preparacion')
    cliente, sucursales, pedidos = bloquear_contexto(instancia.cliente_id, instancia.fecha_pedidos)
    preparacion = get_object_or_404(Preparacion.objects.select_for_update(), pk=instancia.pk)
    if preparacion.estado == 'confirmada' and preparacion.clave_confirmacion == datos['clave_operacion'] and preparacion.confirmado_por_id == actor.pk:
        return preparacion
    if preparacion.estado != 'borrador' or version_preparacion(preparacion) != datos['version']:
        raise ConflictoPreparacion('Confirma únicamente un borrador con su versión actual.')
    documento = _construir_documento(datos_documento(preparacion), cliente, sucursales, pedidos, confirmar=True)
    _guardar_documento(preparacion, documento)
    salida = _crear_movimiento_confirmado(usuario, preparacion, 'salida_preparacion', 'salida', datos['clave_operacion'])
    entrada = _crear_movimiento_confirmado(usuario, preparacion, 'entrada_aprovechable', 'entrada', uuid.uuid5(datos['clave_operacion'], 'aprovechable')) if any(linea.aprovechable > 0 for linea in documento[1]) else None
    fecha_lotes = timezone.localdate()
    for linea in documento[1]:
        DetalleMovimientoInventario.objects.create(movimiento=salida, lote=linea.lote, producto=linea.producto, unidad=linea.unidad, cantidad=linea.cantidad_utilizada)
        if linea.aprovechable:
            lote = _crear_lote_con_codigo(producto=linea.producto, unidad=linea.unidad, almacen_origen=preparacion.almacen,
                producto_nombre=linea.producto_nombre, unidad_nombre=linea.unidad_nombre, unidad_abreviatura=linea.unidad_abreviatura,
                almacen_nombre=preparacion.almacen_nombre, fecha_ingreso=fecha_lotes, fecha_vencimiento=linea.lote.fecha_vencimiento,
                peso_kg_ingreso=linea.aprovechable if es_kilogramo(linea.unidad) else None, estado='bloqueado', calidad='aprovechable', lote_origen=linea.lote)
            DetalleMovimientoInventario.objects.create(movimiento=entrada, lote=lote, producto=linea.producto, unidad=linea.unidad, cantidad=linea.aprovechable)
            linea.lote_aprovechable = lote
            linea.save(update_fields=['lote_aprovechable'])
            registrar_actividad('lotes', 'separar_aprovechable', actor=usuario, objeto=lote, objeto_nombre=lote.codigo,
                cambios={'origen': linea.lote.codigo, 'preparacion': preparacion.codigo, 'cantidad': str(linea.aprovechable), 'motivo': linea.motivo_separacion})
    preparacion.estado, preparacion.movimiento_salida, preparacion.movimiento_aprovechable = 'confirmada', salida, entrada
    preparacion.confirmado_por, preparacion.confirmado_en, preparacion.clave_confirmacion = usuario, timezone.now(), datos['clave_operacion']
    try:
        with transaction.atomic():
            preparacion.save()
    except IntegrityError as error:
        raise ConflictoPreparacion('Esta clave de confirmación ya se utilizó.') from error
    afectados = {fila.pedido_id for fila in documento[2] if fila.cantidad > 0}
    for identificador in sorted(afectados):
        pedido = pedidos[identificador]
        detalles = list(pedido.detalles.all())
        avances = avance_detalles([fila.pk for fila in detalles])
        completo = bool(detalles) and all(avances.get(fila.pk, 0) == fila.cantidad for fila in detalles)
        pedido.estado = 'preparado' if completo else 'pendiente'
        pedido.save(update_fields=['estado', 'actualizado_en'])
        registrar_actividad('pedidos', 'preparar' if completo else 'preparar_parcial', actor=usuario, objeto=pedido, objeto_nombre=pedido.codigo,
            cambios={'preparacion': preparacion.codigo, 'estado': pedido.estado, 'cantidades_preparadas': avances})
    for movimiento in [salida, *([entrada] if entrada else [])]:
        registrar_actividad('movimientos_inventario', 'registrar_preparacion', actor=usuario, objeto=movimiento, objeto_nombre=movimiento.codigo,
            cambios={'preparacion': preparacion.codigo, 'tipo': movimiento.tipo, 'almacen': preparacion.almacen_nombre})
    registrar_actividad('preparaciones', 'confirmar', actor=usuario, objeto=preparacion, objeto_nombre=preparacion.codigo,
        cambios={'estado': {'antes': 'borrador', 'despues': 'confirmada'}, 'salida': salida.codigo, 'aprovechable': entrada.codigo if entrada else None, 'pedidos': sorted(afectados)})
    return preparacion


@transaction.atomic
def cancelar_preparacion(actor, instancia, datos):
    exigir_permiso(actor, 'cancelar_preparacion')
    datos = leer_formulario(SerializadorCancelacionCompra(data=datos))
    exigir_permiso(get_object_or_404(get_user_model(), pk=actor.pk), 'cancelar_preparacion')
    bloquear_contexto(instancia.cliente_id, instancia.fecha_pedidos)
    preparacion = get_object_or_404(Preparacion.objects.select_for_update(), pk=instancia.pk)
    if preparacion.estado == 'cancelada' and preparacion.clave_cancelacion == datos['clave_operacion'] and preparacion.cancelado_por_id == actor.pk and preparacion.motivo_cancelacion == datos['motivo']:
        return preparacion
    if preparacion.estado != 'borrador' or version_preparacion(preparacion) != datos['version']:
        raise ConflictoPreparacion('Solo se cancelan borradores con su versión actual. Las preparaciones confirmadas conservan sus movimientos.')
    preparacion.estado, preparacion.cancelado_por, preparacion.cancelado_en = 'cancelada', actor, timezone.now()
    preparacion.clave_cancelacion, preparacion.motivo_cancelacion = datos['clave_operacion'], datos['motivo']
    try:
        with transaction.atomic():
            preparacion.save()
    except IntegrityError as error:
        raise ConflictoPreparacion('Esta clave de cancelación ya se utilizó.') from error
    registrar_actividad('preparaciones', 'cancelar', actor=actor, objeto=preparacion, objeto_nombre=preparacion.codigo, cambios={'motivo': datos['motivo']})
    return preparacion
