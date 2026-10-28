import hashlib
import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, diferencias, nombre_responsable
from almacenes.models import Almacen
from catalogos.models import CategoriaProducto, UnidadMedida
from compras.models import Compra, DetalleCompra
from compras.serializadores import SerializadorAccionCompra, SerializadorCancelacionCompra
from compras.servicios import leer_formulario
from productos.models import Producto
from inventario.models import UnidadInventarioProducto
from inventario.consultas import es_kilogramo
from inventario.servicios import _crear_ingreso_confirmado
from .models import Recepcion, DetalleRecepcion
from .permisos import exigir_permiso
from .serializadores import SerializadorEscrituraRecepcion
from .consultas import avance_compra


class ConflictoRecepcion(APIException):
    status_code = 409
    default_code = 'recepcion_modificada'
    default_detail = 'La recepción cambió. Recarga sus datos antes de continuar.'


def version_recepcion(recepcion):
    return hashlib.sha256(f'{recepcion.pk}:{recepcion.actualizado_en.isoformat()}'.encode()).hexdigest()


def estado_recepcion(recepcion):
    return {'compra': recepcion.compra_id, 'almacen': recepcion.almacen_id, 'fecha_recepcion': recepcion.fecha_recepcion.isoformat(),
            'estado': recepcion.estado, 'observaciones': recepcion.observaciones,
            'detalles': list(recepcion.detalles.order_by('pk').values('id', 'detalle_compra_id', 'producto_id', 'unidad_inventario_id',
                'producto_nombre', 'unidad_nombre', 'unidad_abreviatura', 'medida_compra_nombre', 'cantidad_compra', 'cantidad_inventario', 'peso_kg', 'fecha_vencimiento'))}


def bloquear_compra(identificador):
    if identificador is None:
        return None
    compra = get_object_or_404(Compra.objects.select_for_update(), pk=identificador)
    if compra.estado != 'registrada':
        raise ConflictoRecepcion('La compra debe estar registrada y no cancelada para recibir productos.')
    return compra


def validar_fecha(fecha, compra):
    if fecha > timezone.localdate():
        raise ValidationError({'fecha_recepcion': 'La recepción debe ser hoy o una fecha anterior.'})
    if compra and fecha < compra.fecha_compra:
        raise ValidationError({'fecha_recepcion': 'La recepción no puede ser anterior a la fecha de compra.'})


def comprobar_version(recepcion, version):
    if version != version_recepcion(recepcion):
        raise ConflictoRecepcion()


def preparar_lineas(datos, compra, fecha, anteriores, confirmar=False):
    detalles_compra = {linea.pk: linea for linea in DetalleCompra.objects.select_for_update().filter(compra=compra).order_by('pk')} if compra else {}
    productos = {obj.pk: obj for obj in Producto.objects.select_for_update().filter(pk__in={linea['producto'] for linea in datos}).order_by('pk')}
    categorias = {obj.pk: obj for obj in CategoriaProducto.objects.select_for_update().filter(pk__in={obj.categoria_id for obj in productos.values()}).order_by('pk')}
    unidades = {obj.pk: obj for obj in UnidadMedida.objects.select_for_update().filter(pk__in={linea['unidad_inventario'] for linea in datos}).order_by('pk')}
    habilitadas = set(UnidadInventarioProducto.objects.select_for_update().filter(producto_id__in=productos, activo=True).values_list('producto_id', 'unidad_id'))
    recibidos = avance_compra(compra.pk) if confirmar and compra else {}
    resultado, ids, fuentes = [], set(), set()
    for indice, valores in enumerate(datos):
        def error(campo, mensaje):
            raise ValidationError({f'detalle_{indice}_{campo}': mensaje})
        identificador = valores.get('id')
        anterior = anteriores.get(identificador) if identificador else None
        if identificador and (not anterior or identificador in ids):
            error('producto', 'La línea no pertenece a esta recepción o está repetida.')
        if identificador:
            ids.add(identificador)
        if anterior and anterior.lote_id:
            raise ConflictoRecepcion('Esta línea ya tiene un lote de inventario. Recarga la recepción.')
        fuente = detalles_compra.get(valores['detalle_compra'])
        if compra:
            if not fuente or fuente.producto_id != valores['producto']:
                error('detalle_compra', 'Selecciona una línea de la compra y su producto correspondiente.')
            if fuente.pk in fuentes:
                error('detalle_compra', 'Esta línea de compra ya está incluida en la recepción.')
            fuentes.add(fuente.pk)
        elif valores['detalle_compra'] is not None or valores['cantidad_compra'] != 0:
            error('cantidad_compra', 'Un ingreso directo no puede contabilizar cantidades de una compra.')
        producto = productos.get(valores['producto'])
        unidad = unidades.get(valores['unidad_inventario'])
        if not producto or not unidad:
            error('producto', 'Revisa el producto y la unidad seleccionada.')
        igual = anterior and all(valores[campo] == getattr(anterior, f'{campo}_id' if campo in ('producto', 'detalle_compra', 'unidad_inventario') else campo) for campo in ('producto', 'detalle_compra', 'unidad_inventario', 'cantidad_compra', 'cantidad_inventario', 'peso_kg', 'fecha_vencimiento'))
        if confirmar or not igual:
            if not producto.activo or not categorias[producto.categoria_id].activo or not unidad.activo:
                error('producto', 'El producto, su categoría y la unidad deben estar activos.')
            if unidad.pk != producto.unidad_medida_id and (producto.pk, unidad.pk) not in habilitadas:
                error('unidad_inventario', 'Habilita esta unidad de inventario en la ficha del producto antes de recibirla.')
        vencimiento = valores['fecha_vencimiento']
        if vencimiento and vencimiento < fecha:
            error('fecha_vencimiento', 'El vencimiento no puede ser anterior al ingreso.')
        if confirmar:
            if valores['cantidad_inventario'] <= 0:
                error('cantidad_inventario', 'Registra una cantidad física mayor que cero.')
            if compra:
                pendiente = fuente.cantidad - recibidos.get(fuente.pk, Decimal('0'))
                if valores['cantidad_compra'] <= 0 or valores['cantidad_compra'] > pendiente:
                    error('cantidad_compra', f'La cantidad recibida debe ser positiva y no superar el pendiente de {pendiente} {fuente.presentacion_nombre or fuente.unidad_nombre}.')
                if fuente.presentacion_id is None and fuente.unidad_medida_id == unidad.pk and valores['cantidad_compra'] != valores['cantidad_inventario']:
                    error('cantidad_inventario', 'Compra e inventario usan la misma unidad: ambas cantidades recibidas deben coincidir.')
            if anterior and anterior.unidad_abreviatura != unidad.abreviatura:
                error('unidad_inventario', 'La unidad cambió. Revisa la medición y guarda de nuevo el borrador.')
        peso = valores['peso_kg']
        if es_kilogramo(unidad) and valores['cantidad_inventario'] > 0:
            if peso is not None and peso != valores['cantidad_inventario']:
                error('peso_kg', 'Si el inventario se registra en kg, el peso real debe coincidir con la cantidad ingresada.')
            peso = valores['cantidad_inventario']
        linea = anterior or DetalleRecepcion()
        conserva_producto = anterior and anterior.producto_id == producto.pk
        conserva_unidad = anterior and anterior.unidad_inventario_id == unidad.pk
        linea.producto, linea.unidad_inventario, linea.detalle_compra = producto, unidad, fuente
        if not conserva_producto:
            linea.producto_nombre = producto.nombre
        if not conserva_unidad:
            linea.unidad_nombre, linea.unidad_abreviatura = unidad.nombre, unidad.abreviatura
        linea.medida_compra_nombre = fuente.presentacion_nombre or fuente.unidad_nombre if fuente else ''
        linea.cantidad_compra, linea.cantidad_inventario, linea.peso_kg = valores['cantidad_compra'], valores['cantidad_inventario'], peso
        linea.fecha_vencimiento = vencimiento
        resultado.append(linea)
    return resultado


def guardar_recepcion(actor, datos, instancia=None):
    exigir_permiso(actor, 'change_recepcion' if instancia else 'add_recepcion')
    datos = leer_formulario(SerializadorEscrituraRecepcion(instancia, data=datos))
    huella = hashlib.sha256(json.dumps({campo: valor for campo, valor in datos.items() if campo not in ('clave_operacion', 'version')}, sort_keys=True, default=str).encode()).hexdigest()
    try:
        with transaction.atomic():
            usuario = get_object_or_404(get_user_model().objects.select_for_update(no_key=True), pk=actor.pk)
            exigir_permiso(usuario, 'change_recepcion' if instancia else 'add_recepcion')
            if not instancia:
                existente = Recepcion.objects.filter(clave_operacion=datos['clave_operacion']).first()
                if existente:
                    if existente.responsable_id != actor.pk or existente.huella_creacion != huella:
                        raise ConflictoRecepcion('Esta clave de creación ya se utilizó con otros datos.')
                    return existente, False
            compra = bloquear_compra(datos['compra'])
            recepcion = get_object_or_404(Recepcion.objects.select_for_update(), pk=instancia.pk) if instancia else Recepcion()
            if instancia:
                comprobar_version(recepcion, datos['version'])
                if recepcion.estado != 'borrador':
                    raise ConflictoRecepcion('Solo se pueden editar recepciones en borrador.')
            validar_fecha(datos['fecha_recepcion'], compra)
            antes = estado_recepcion(recepcion) if instancia else {}
            anteriores = {linea.pk: linea for linea in recepcion.detalles.select_for_update()} if instancia else {}
            lineas = preparar_lineas(datos['detalles'], compra, datos['fecha_recepcion'], anteriores)
            almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=datos['almacen'])
            if not almacen.activo:
                raise ValidationError({'almacen': 'Selecciona un almacén activo.'})
            recepcion.compra, recepcion.almacen, recepcion.almacen_nombre = compra, almacen, almacen.nombre
            recepcion.fecha_recepcion, recepcion.observaciones = datos['fecha_recepcion'], datos['observaciones']
            if not instancia:
                recepcion.responsable, recepcion.responsable_nombre = actor, nombre_responsable(actor)
                recepcion.clave_operacion, recepcion.huella_creacion = datos['clave_operacion'], huella
                recepcion.save()
            conservados = []
            for linea in lineas:
                linea.recepcion = recepcion
                linea.save()
                conservados.append(linea.pk)
            recepcion.detalles.exclude(pk__in=conservados).delete()
            despues = estado_recepcion(recepcion)
            if not instancia or antes != despues:
                recepcion.save()
                registrar_actividad('recepciones', 'editar' if instancia else 'crear', actor=actor, objeto=recepcion, objeto_nombre=recepcion.codigo,
                                    cambios=diferencias(antes, despues))
            return recepcion, not bool(instancia)
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if not instancia and restriccion == 'recepciones_clave_operacion_key':
            existente = Recepcion.objects.filter(clave_operacion=datos['clave_operacion']).first()
            if existente and existente.responsable_id == actor.pk and existente.huella_creacion == huella:
                return existente, False
            raise ConflictoRecepcion('Esta clave de creación ya se utilizó con otros datos.') from error
        raise


def guardar_accion(recepcion):
    try:
        with transaction.atomic():
            recepcion.save()
    except IntegrityError as error:
        if getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '') in ('recepciones_clave_confirmacion_key', 'recepciones_clave_cancelacion_key'):
            raise ConflictoRecepcion('Esta clave de operación ya se utilizó en otra recepción.') from error
        raise


@transaction.atomic
def confirmar_recepcion(actor, instancia, datos):
    exigir_permiso(actor, 'confirmar_recepcion')
    datos = leer_formulario(SerializadorAccionCompra(data=datos))
    compra = bloquear_compra(instancia.compra_id)
    recepcion = get_object_or_404(Recepcion.objects.select_for_update(), pk=instancia.pk)
    if recepcion.estado == 'confirmada' and recepcion.clave_confirmacion == datos['clave_operacion'] and recepcion.confirmado_por_id == actor.pk:
        return recepcion
    comprobar_version(recepcion, datos['version'])
    if recepcion.estado != 'borrador':
        raise ConflictoRecepcion('Solo se pueden confirmar recepciones en borrador.')
    validar_fecha(recepcion.fecha_recepcion, compra)
    anteriores = {linea.pk: linea for linea in recepcion.detalles.select_for_update()}
    if not anteriores:
        raise ValidationError({'detalles': 'Agrega al menos un producto antes de confirmar.'})
    datos_lineas = [{'id': linea.pk, 'detalle_compra': linea.detalle_compra_id, 'producto': linea.producto_id, 'unidad_inventario': linea.unidad_inventario_id,
                     'cantidad_compra': linea.cantidad_compra, 'cantidad_inventario': linea.cantidad_inventario, 'peso_kg': linea.peso_kg, 'fecha_vencimiento': linea.fecha_vencimiento} for linea in anteriores.values()]
    lineas = preparar_lineas(datos_lineas, compra, recepcion.fecha_recepcion, anteriores, confirmar=True)
    almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=recepcion.almacen_id)
    if not almacen.activo:
        raise ValidationError({'almacen': 'El almacén está inactivo. Revisa el borrador antes de confirmar.'})
    recepcion.almacen = almacen
    movimiento = _crear_ingreso_confirmado(actor, recepcion, lineas, datos['clave_operacion'])
    recepcion.estado, recepcion.movimiento = 'confirmada', movimiento
    recepcion.confirmado_por, recepcion.confirmado_en, recepcion.clave_confirmacion = actor, timezone.now(), datos['clave_operacion']
    guardar_accion(recepcion)
    registrar_actividad('recepciones', 'confirmar', actor=actor, objeto=recepcion, objeto_nombre=recepcion.codigo,
                        cambios={'estado': {'antes': 'borrador', 'despues': 'confirmada'}, 'movimiento': movimiento.codigo, 'lotes': [linea.lote.codigo for linea in lineas]})
    return recepcion


@transaction.atomic
def cancelar_recepcion(actor, instancia, datos):
    exigir_permiso(actor, 'cancelar_recepcion')
    datos = leer_formulario(SerializadorCancelacionCompra(data=datos))
    if instancia.compra_id:
        get_object_or_404(Compra.objects.select_for_update(), pk=instancia.compra_id)
    recepcion = get_object_or_404(Recepcion.objects.select_for_update(), pk=instancia.pk)
    if recepcion.estado == 'cancelada' and recepcion.clave_cancelacion == datos['clave_operacion'] and recepcion.cancelado_por_id == actor.pk and recepcion.motivo_cancelacion == datos['motivo']:
        return recepcion
    comprobar_version(recepcion, datos['version'])
    if recepcion.estado != 'borrador':
        raise ConflictoRecepcion('Solo se cancelan borradores. Un ingreso confirmado conserva sus lotes y movimientos.')
    recepcion.estado, recepcion.cancelado_por, recepcion.cancelado_en = 'cancelada', actor, timezone.now()
    recepcion.clave_cancelacion, recepcion.motivo_cancelacion = datos['clave_operacion'], datos['motivo']
    guardar_accion(recepcion)
    registrar_actividad('recepciones', 'cancelar', actor=actor, objeto=recepcion, objeto_nombre=recepcion.codigo,
                        cambios={'estado': {'antes': 'borrador', 'despues': 'cancelada'}, 'motivo': datos['motivo']})
    return recepcion
