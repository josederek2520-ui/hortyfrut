import hashlib
import json
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from catalogos.models import UnidadMedida
from productos.models import Producto
from .models import UnidadInventarioProducto, Lote, SecuenciaLote, MovimientoInventario, DetalleMovimientoInventario
from .permisos import exigir_permiso


class ConflictoInventario(APIException):
    status_code = 409
    default_code = 'inventario_modificado'
    default_detail = 'El registro cambió. Recarga sus datos antes de continuar.'


def version_lote(lote):
    return hashlib.sha256(f'{lote.pk}:{lote.actualizado_en.isoformat()}:{lote.estado}'.encode()).hexdigest()


def datos_unidad(producto, unidad, configuracion=None):
    base = unidad.pk == producto.unidad_medida_id
    activo = base or bool(configuracion and configuracion.activo)
    version = hashlib.sha256(json.dumps([producto.pk, producto.unidad_medida_id, unidad.pk, activo,
        configuracion.actualizado_en.isoformat() if configuracion else None]).encode()).hexdigest()
    return {'id': unidad.pk, 'nombre': unidad.nombre, 'abreviatura': unidad.abreviatura,
            'es_base': base, 'activo': activo, 'vigente': unidad.activo, 'version': version}


@transaction.atomic
def habilitar_unidad(actor, producto_id, datos):
    from .serializadores import SerializadorAltaUnidad
    exigir_permiso(actor, 'productos.view_producto')
    exigir_permiso(actor, 'inventario.gestionar_unidades_inventario')
    formulario = SerializadorAltaUnidad(data=datos)
    formulario.is_valid(raise_exception=True)
    producto = get_object_or_404(Producto.objects.select_for_update(), pk=producto_id)
    unidad = get_object_or_404(UnidadMedida.objects.select_for_update(), pk=formulario.validated_data['unidad'])
    if not producto.activo or not unidad.activo:
        raise ValidationError({'unidad': 'El producto y la unidad deben estar activos.'})
    if unidad.pk == producto.unidad_medida_id:
        return datos_unidad(producto, unidad), False
    configuracion, creada = UnidadInventarioProducto.objects.get_or_create(producto=producto, unidad=unidad)
    if not configuracion.activo:
        raise ConflictoInventario('Esta unidad ya está configurada. Actívala desde el listado.')
    if creada:
        registrar_actividad('unidades_inventario', 'habilitar_unidad', actor=actor, objeto=configuracion,
                            objeto_nombre=f'{producto.nombre} · {unidad.nombre}', cambios={'producto': producto.pk, 'unidad': unidad.pk, 'activo': {'antes': None, 'despues': True}})
    return datos_unidad(producto, unidad, configuracion), creada


@transaction.atomic
def cambiar_unidad(actor, producto_id, unidad_id, datos):
    from .serializadores import SerializadorEstadoUnidad
    exigir_permiso(actor, 'productos.view_producto')
    exigir_permiso(actor, 'inventario.gestionar_unidades_inventario')
    formulario = SerializadorEstadoUnidad(data=datos)
    formulario.is_valid(raise_exception=True)
    producto = get_object_or_404(Producto.objects.select_for_update(), pk=producto_id)
    unidad = get_object_or_404(UnidadMedida.objects.select_for_update(), pk=unidad_id)
    if unidad.pk == producto.unidad_medida_id:
        raise ValidationError({'unidad': 'La unidad base del producto siempre está habilitada.'})
    configuracion = get_object_or_404(UnidadInventarioProducto.objects.select_for_update(), producto=producto, unidad=unidad)
    if formulario.validated_data['version'] != datos_unidad(producto, unidad, configuracion)['version']:
        raise ConflictoInventario()
    activo = formulario.validated_data['activo']
    if activo and (not producto.activo or not unidad.activo):
        raise ValidationError({'unidad': 'El producto y la unidad deben estar activos.'})
    if configuracion.activo != activo:
        anterior = configuracion.activo
        configuracion.activo = activo
        configuracion.save(update_fields=['activo', 'actualizado_en'])
        registrar_actividad('unidades_inventario', 'habilitar_unidad' if activo else 'inhabilitar_unidad', actor=actor, objeto=configuracion,
                            objeto_nombre=f'{producto.nombre} · {unidad.nombre}', cambios={'activo': {'antes': anterior, 'despues': activo}})
    return datos_unidad(producto, unidad, configuracion)


@transaction.atomic
def cambiar_estado_lote(actor, instancia, datos):
    from .serializadores import SerializadorEstadoLote
    exigir_permiso(actor, 'inventario.view_lote')
    exigir_permiso(actor, 'inventario.cambiar_estado_lote')
    formulario = SerializadorEstadoLote(data=datos)
    formulario.is_valid(raise_exception=True)
    lote = get_object_or_404(Lote.objects.select_for_update(), pk=instancia.pk)
    if formulario.validated_data['version'] != version_lote(lote):
        raise ConflictoInventario()
    estado = formulario.validated_data['estado']
    if estado == 'disponible' and lote.calidad != 'apto':
        raise ValidationError({'estado': 'El producto aprovechable conserva su separación para producción y no se habilita para pedidos.'})
    if estado == 'disponible' and lote.fecha_vencimiento and lote.fecha_vencimiento < timezone.localdate():
        raise ValidationError({'estado': 'Un lote vencido no se puede habilitar como disponible.'})
    if lote.estado != estado:
        anterior = lote.estado
        lote.estado = estado
        lote.save(update_fields=['estado', 'actualizado_en'])
        registrar_actividad('lotes', 'bloquear_lote' if estado == 'bloqueado' else 'desbloquear_lote', actor=actor, objeto=lote,
                            objeto_nombre=lote.codigo, cambios={'estado': {'antes': anterior, 'despues': estado}})
    return lote


def _crear_lote_con_codigo(**datos):
    # Comparte la transacción de negocio y su auditoría; nunca confirma existencias.
    if not transaction.get_connection().in_atomic_block:
        raise ValidationError({'lote': 'Crea el lote dentro de una operación de inventario confirmada.'})
    fecha = datos['fecha_ingreso']
    SecuenciaLote.objects.get_or_create(fecha=fecha)
    secuencia = SecuenciaLote.objects.select_for_update().get(fecha=fecha)
    secuencia.ultimo += 1
    secuencia.save(update_fields=['ultimo'])
    codigo = f"L{fecha:%d%m%y}-{secuencia.ultimo:02d}"
    return Lote.objects.create(codigo_lote=codigo, **datos)


def _crear_ingreso_confirmado(actor, recepcion, lineas, clave_operacion):
    # Servicio central de negocio; solo se invoca dentro de la confirmación atómica.
    exigir_permiso(actor, 'recepciones.view_recepcion')
    exigir_permiso(actor, 'recepciones.confirmar_recepcion')
    if not transaction.get_connection().in_atomic_block or recepcion.estado != 'borrador':
        raise ValidationError({'estado': 'Confirma la recepción mediante su servicio de negocio.'})
    try:
        with transaction.atomic():
            movimiento = MovimientoInventario.objects.create(almacen=recepcion.almacen, almacen_nombre=recepcion.almacen.nombre,
                tipo='entrada_recepcion', naturaleza='entrada', fecha=recepcion.fecha_recepcion, referencia_tipo='recepcion',
                referencia_id=recepcion.pk, referencia_codigo=recepcion.codigo, clave_operacion=clave_operacion,
                responsable=actor, responsable_nombre=nombre_responsable(actor))
    except IntegrityError as error:
        raise ConflictoInventario('Ya existe un ingreso para esta recepción o clave de operación. Recarga sus datos.') from error
    for linea in lineas:
        lote = _crear_lote_con_codigo(producto=linea.producto, unidad=linea.unidad_inventario, almacen_origen=recepcion.almacen,
            producto_nombre=linea.producto_nombre, unidad_nombre=linea.unidad_nombre, unidad_abreviatura=linea.unidad_abreviatura,
            almacen_nombre=recepcion.almacen.nombre, fecha_ingreso=recepcion.fecha_recepcion, fecha_vencimiento=linea.fecha_vencimiento,
            peso_kg_ingreso=linea.peso_kg)
        DetalleMovimientoInventario.objects.create(movimiento=movimiento, lote=lote, producto=linea.producto,
                                                   unidad=linea.unidad_inventario, cantidad=linea.cantidad_inventario)
        linea.lote = lote
        linea.save(update_fields=['lote', 'peso_kg'])
        registrar_actividad('lotes', 'crear', actor=actor, objeto=lote, objeto_nombre=lote.codigo,
            cambios={'producto': lote.producto_nombre, 'unidad': lote.unidad_nombre, 'cantidad': str(linea.cantidad_inventario), 'recepcion': recepcion.codigo})
    registrar_actividad('movimientos_inventario', 'registrar_ingreso', actor=actor, objeto=movimiento, objeto_nombre=movimiento.codigo,
                        cambios={'recepcion': recepcion.codigo, 'almacen': recepcion.almacen.nombre, 'lotes': [linea.lote_id for linea in lineas]})
    return movimiento
