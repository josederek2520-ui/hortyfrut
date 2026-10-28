import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from collections.abc import Mapping
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, diferencias, nombre_responsable
from catalogos.models import CategoriaProducto, UnidadMedida
from productos.models import Producto, PresentacionProducto
from proveedores.models import Proveedor
from .consultas import necesidades_fecha
from .models import Compra, DetalleCompra, ReferenciaPedidoCompra
from .permisos import exigir_permiso
from .serializadores import SerializadorEscrituraCompra, SerializadorAccionCompra, SerializadorCancelacionCompra

MAXIMO_IMPORTE = Decimal('999999999999.99')


class ConflictoCompra(APIException):
    status_code = 409
    default_code = 'compra_modificada'
    default_detail = 'La compra cambió. Recarga sus datos antes de continuar.'


def version_compra(compra):
    return hashlib.sha256(f'{compra.pk}:{compra.actualizado_en.isoformat()}'.encode()).hexdigest()


def leer_formulario(formulario):
    if formulario.is_valid():
        return formulario.validated_data
    errores = dict(formulario.errors)
    detalles = errores.get('detalles')
    filas = None
    if isinstance(detalles, list) and all(isinstance(fila, Mapping) for fila in detalles):
        filas = list(enumerate(detalles))
    elif isinstance(detalles, Mapping) and all(str(indice).isdigit() and isinstance(fila, Mapping) for indice, fila in detalles.items()):
        filas = list(detalles.items())
    if filas is not None:
        errores.pop('detalles')
        for indice, campos in filas:
            for campo, mensajes in campos.items():
                errores[f'detalle_{indice}_{campo}'] = mensajes
    raise ValidationError(errores)


def comprobar_version(compra, version):
    if version != version_compra(compra):
        raise ConflictoCompra()


def estado_compra(compra):
    return {'fecha_pedidos': compra.fecha_pedidos.isoformat(), 'fecha_compra': compra.fecha_compra.isoformat(),
            'estado': compra.estado, 'observaciones': compra.observaciones, 'total': format(compra.total, '.2f'),
            'detalles': [{'id': linea.pk, 'producto': linea.producto_id, 'presentacion': linea.presentacion_id,
                          'proveedor': linea.proveedor_id, 'unidad_medida': linea.unidad_medida_id,
                          'producto_nombre': linea.producto_nombre, 'presentacion_nombre': linea.presentacion_nombre,
                          'proveedor_nombre': linea.proveedor_nombre, 'unidad_nombre': linea.unidad_nombre,
                          'cantidad': format(linea.cantidad, '.3f'), 'precio_unitario': format(linea.precio_unitario, '.2f'),
                          'subtotal': format(linea.subtotal, '.2f')} for linea in compra.detalles.order_by('pk')],
            'pedidos_referencia': list(compra.pedidos_referencia.order_by('pedido_id').values('pedido_id', 'codigo', 'cliente_nombre', 'sucursal_nombre', 'detalles'))}


def huella_creacion(datos):
    contenido = {campo: valor for campo, valor in datos.items() if campo not in ('version', 'clave_operacion')}
    return hashlib.sha256(json.dumps(contenido, sort_keys=True, default=str).encode()).hexdigest()


def validar_fecha_compra(fecha):
    if fecha > timezone.localdate():
        raise ValidationError({'fecha_compra': 'La fecha de compra debe ser hoy o una fecha anterior.'})


def preparar_detalles(datos, anteriores, registro=False):
    identificadores = sorted({linea['producto'] for linea in datos})
    productos = {obj.pk: obj for obj in Producto.objects.select_for_update().filter(pk__in=identificadores).order_by('pk')}
    categorias = {obj.pk: obj for obj in CategoriaProducto.objects.select_for_update().filter(pk__in={obj.categoria_id for obj in productos.values()}).order_by('pk')}
    unidades_ids = {obj.unidad_medida_id for obj in productos.values()} | {obj.unidad_medida_id for obj in anteriores.values()}
    unidades = {obj.pk: obj for obj in UnidadMedida.objects.select_for_update().filter(pk__in=unidades_ids).order_by('pk')}
    presentaciones = {obj.pk: obj for obj in PresentacionProducto.objects.select_for_update().filter(pk__in={linea['presentacion'] for linea in datos if linea['presentacion']}).order_by('pk')}
    proveedores = {obj.pk: obj for obj in Proveedor.objects.select_for_update().filter(pk__in={linea['proveedor'] for linea in datos if linea['proveedor']}).order_by('pk')}
    resultado, vistos, ids_vistos = [], set(), set()
    for indice, datos_linea in enumerate(datos):
        def error(campo, mensaje):
            raise ValidationError({f'detalle_{indice}_{campo}': mensaje})
        identificador = datos_linea.get('id')
        anterior = anteriores.get(identificador) if identificador else None
        if identificador and (anterior is None or identificador in ids_vistos):
            error('producto', 'El detalle no pertenece a esta compra o está repetido.')
        if identificador:
            ids_vistos.add(identificador)
        producto = productos.get(datos_linea['producto'])
        if not producto:
            error('producto', 'El producto seleccionado no está disponible.')
        presentacion = presentaciones.get(datos_linea['presentacion'])
        proveedor = proveedores.get(datos_linea['proveedor'])
        unidad = unidades[anterior.unidad_medida_id if anterior and anterior.producto_id == producto.pk else producto.unidad_medida_id]
        igual = anterior and all(datos_linea[campo] == getattr(anterior, campo if campo in ('cantidad', 'precio_unitario') else f'{campo}_id') for campo in ('producto', 'presentacion', 'proveedor', 'cantidad', 'precio_unitario'))
        if registro or not igual:
            if not producto.activo or not categorias[producto.categoria_id].activo or not unidad.activo:
                error('producto', 'Selecciona un producto activo con sus catálogos disponibles.')
            if datos_linea['presentacion'] and (not presentacion or presentacion.producto_id != producto.pk or not presentacion.activo or presentacion.uso not in ('compra', 'ambos')):
                error('presentacion', 'Selecciona una presentación de este producto habilitada para compras.')
            if datos_linea['proveedor'] and (not proveedor or not proveedor.activo):
                error('proveedor', 'Selecciona un proveedor activo y disponible.')
        if registro:
            if not proveedor:
                error('proveedor', 'Selecciona el proveedor antes de registrar la compra.')
            for campo in ('cantidad', 'precio_unitario'):
                if datos_linea[campo] <= 0:
                    error(campo, 'Ingresa un valor mayor que cero antes de registrar la compra.')
        clave = (producto.pk, datos_linea['presentacion'], datos_linea['proveedor'])
        if proveedor and clave in vistos:
            error('proveedor', 'Esta combinación de producto, presentación y proveedor ya existe en la compra.')
        vistos.add(clave)
        subtotal = (datos_linea['cantidad'] * datos_linea['precio_unitario']).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if subtotal > MAXIMO_IMPORTE:
            error('precio_unitario', 'El importe de esta línea supera el máximo permitido.')
        linea = anterior or DetalleCompra()
        conserva_producto = anterior and anterior.producto_id == producto.pk
        conserva_presentacion = anterior and anterior.presentacion_id == datos_linea['presentacion']
        conserva_proveedor = anterior and anterior.proveedor_id == datos_linea['proveedor']
        linea.producto = producto
        linea.presentacion = presentacion
        linea.proveedor = proveedor
        linea.unidad_medida = unidad
        if not conserva_producto:
            linea.producto_nombre, linea.unidad_nombre = producto.nombre, unidad.nombre
        if not conserva_presentacion:
            linea.presentacion_nombre = presentacion.nombre if presentacion else ''
        if not conserva_proveedor:
            linea.proveedor_nombre = proveedor.nombre if proveedor else ''
        linea.cantidad, linea.precio_unitario, linea.subtotal = datos_linea['cantidad'], datos_linea['precio_unitario'], subtotal
        resultado.append(linea)
    total = sum((linea.subtotal for linea in resultado), Decimal('0.00'))
    if total > MAXIMO_IMPORTE:
        raise ValidationError({'detalles': 'El total de la compra supera el máximo permitido.'})
    return resultado, total


def actualizar_referencias(compra, productos):
    # Son referencias informativas: no reservan ni modifican pedidos y no asignan
    # equivalencias entre lo solicitado y lo comprado.
    pedidos = {}
    for linea in necesidades_fecha(compra.fecha_pedidos).filter(producto_id__in=productos).select_related('pedido').order_by('pedido_id', 'pk'):
        if linea.pedido_id not in pedidos:
            pedidos[linea.pedido_id] = {'pedido_id': linea.pedido_id, 'codigo': linea.pedido.codigo,
                                      'cliente_nombre': linea.pedido.cliente_nombre, 'sucursal_nombre': linea.pedido.sucursal_nombre, 'detalles': []}
        pedidos[linea.pedido_id]['detalles'].append({'detalle_pedido': linea.pk, 'producto': linea.producto_id,
                                                   'producto_nombre': linea.producto_nombre, 'presentacion_nombre': linea.presentacion_nombre,
                                                   'columna': linea.columna, 'cantidad': linea.cantidad})
    compra.pedidos_referencia.all().delete()
    ReferenciaPedidoCompra.objects.bulk_create([ReferenciaPedidoCompra(compra=compra, **datos) for datos in pedidos.values()])


def comprobar_reintento(compra, actor, huella):
    if compra.responsable_id != actor.pk or compra.huella_creacion != huella:
        raise ConflictoCompra('Esta clave de creación ya se utilizó con otros datos.')
    return compra, False


def guardar_compra(actor, datos, instancia=None):
    exigir_permiso(actor, 'change_compra' if instancia else 'add_compra')
    datos = leer_formulario(SerializadorEscrituraCompra(instancia, data=datos))
    validar_fecha_compra(datos['fecha_compra'])
    huella = huella_creacion(datos)
    try:
        with transaction.atomic():
            # Serializa reintentos del mismo actor sin reservar pedidos.
            usuario = get_object_or_404(get_user_model().objects.select_for_update(no_key=True), pk=actor.pk)
            exigir_permiso(usuario, 'change_compra' if instancia else 'add_compra')
            if not instancia:
                existente = Compra.objects.filter(clave_operacion=datos['clave_operacion']).first()
                if existente:
                    return comprobar_reintento(existente, actor, huella)
            compra = get_object_or_404(Compra.objects.select_for_update(), pk=instancia.pk) if instancia else Compra()
            if instancia:
                comprobar_version(compra, datos['version'])
                if compra.estado != Compra.Estado.BORRADOR:
                    raise ConflictoCompra('Solo se pueden editar compras en borrador.')
            antes = estado_compra(compra) if instancia else {}
            anteriores = {linea.pk: linea for linea in compra.detalles.select_for_update()} if instancia else {}
            lineas, total = preparar_detalles(datos['detalles'], anteriores)
            compra.fecha_pedidos, compra.fecha_compra = datos['fecha_pedidos'], datos['fecha_compra']
            compra.observaciones, compra.total = datos['observaciones'], total
            if not instancia:
                compra.responsable, compra.responsable_nombre = usuario, nombre_responsable(usuario)
                compra.clave_operacion, compra.huella_creacion = datos['clave_operacion'], huella
                compra.save()
            conservados = []
            for linea in lineas:
                linea.compra = compra
                linea.save()
                conservados.append(linea.pk)
            compra.detalles.exclude(pk__in=conservados).delete()
            actualizar_referencias(compra, {linea.producto_id for linea in lineas})
            despues = estado_compra(compra)
            if not instancia or antes != despues:
                compra.save()
                registrar_actividad('compras', 'editar' if instancia else 'crear', actor=actor, objeto=compra,
                                    objeto_nombre=compra.codigo, cambios=diferencias(antes, despues))
            return compra, not bool(instancia)
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if not instancia and restriccion == 'compras_clave_operacion_key':
            existente = Compra.objects.filter(clave_operacion=datos['clave_operacion']).first()
            if existente:
                return comprobar_reintento(existente, actor, huella)
        raise


def datos_lineas(compra):
    return [{'id': linea.pk, 'producto': linea.producto_id, 'presentacion': linea.presentacion_id, 'proveedor': linea.proveedor_id,
             'cantidad': linea.cantidad, 'precio_unitario': linea.precio_unitario} for linea in compra.detalles.order_by('pk')]


def guardar_accion(compra):
    try:
        with transaction.atomic():
            compra.save()
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if restriccion in ('compras_clave_registro_key', 'compras_clave_cancelacion_key'):
            raise ConflictoCompra('Esta clave de operación ya se utilizó en otra compra.') from error
        raise


@transaction.atomic
def registrar_compra(actor, instancia, datos):
    exigir_permiso(actor, 'registrar_compra')
    datos = leer_formulario(SerializadorAccionCompra(data=datos))
    compra = get_object_or_404(Compra.objects.select_for_update(), pk=instancia.pk)
    if compra.estado == Compra.Estado.REGISTRADA and compra.clave_registro == datos['clave_operacion'] and compra.registrado_por_id == actor.pk:
        return compra
    comprobar_version(compra, datos['version'])
    if compra.estado != Compra.Estado.BORRADOR:
        raise ConflictoCompra('Solo se pueden registrar compras en borrador.')
    validar_fecha_compra(compra.fecha_compra)
    if not compra.detalles.exists():
        raise ValidationError({'detalles': 'Agrega al menos un producto antes de registrar la compra.'})
    anteriores = {linea.pk: linea for linea in compra.detalles.select_for_update()}
    lineas, total = preparar_detalles(datos_lineas(compra), anteriores, registro=True)
    if total <= 0:
        raise ValidationError({'detalles': 'El total de la compra debe ser mayor que cero.'})
    if Compra.objects.filter(clave_registro=datos['clave_operacion']).exclude(pk=compra.pk).exists():
        raise ConflictoCompra('Esta clave de registro ya se utilizó en otra compra.')
    compra.estado, compra.total = Compra.Estado.REGISTRADA, total
    compra.registrado_por, compra.registrado_en = actor, timezone.now()
    compra.clave_registro = datos['clave_operacion']
    for linea in lineas:
        linea.save(update_fields=['subtotal'])
    guardar_accion(compra)
    registrar_actividad('compras', 'registrar', actor=actor, objeto=compra, objeto_nombre=compra.codigo,
                        cambios={'estado': {'antes': 'borrador', 'despues': 'registrada'}, 'total': format(total, '.2f')})
    return compra


@transaction.atomic
def cancelar_compra(actor, instancia, datos):
    exigir_permiso(actor, 'cancelar_compra')
    datos = leer_formulario(SerializadorCancelacionCompra(data=datos))
    compra = get_object_or_404(Compra.objects.select_for_update(), pk=instancia.pk)
    if compra.estado == Compra.Estado.CANCELADA and compra.clave_cancelacion == datos['clave_operacion'] and compra.cancelado_por_id == actor.pk and compra.motivo_cancelacion == datos['motivo']:
        return compra
    comprobar_version(compra, datos['version'])
    if compra.estado == Compra.Estado.CANCELADA:
        raise ConflictoCompra('Esta compra ya fue cancelada.')
    if compra.recepciones.exclude(estado='cancelada').exists():
        raise ConflictoCompra('Esta compra tiene recepciones activas. Cancela primero sus borradores; los ingresos confirmados conservan su compra de origen.')
    if Compra.objects.filter(clave_cancelacion=datos['clave_operacion']).exclude(pk=compra.pk).exists():
        raise ConflictoCompra('Esta clave de cancelación ya se utilizó en otra compra.')
    anterior = compra.estado
    compra.estado = Compra.Estado.CANCELADA
    compra.cancelado_por, compra.cancelado_en = actor, timezone.now()
    compra.motivo_cancelacion, compra.clave_cancelacion = datos['motivo'], datos['clave_operacion']
    guardar_accion(compra)
    registrar_actividad('compras', 'cancelar', actor=actor, objeto=compra, objeto_nombre=compra.codigo,
                        cambios={'estado': {'antes': anterior, 'despues': 'cancelada'}, 'motivo': datos['motivo']})
    return compra
