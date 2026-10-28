import hashlib
import json
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, diferencias, nombre_responsable
from clientes.models import Cliente, Sucursal
from productos.models import Producto, PresentacionProducto
from catalogos.models import CategoriaProducto, UnidadMedida
from .models import Pedido, DetallePedido
from .permisos import comprobar_escritura


class ConflictoPedido(APIException):
    status_code = 409
    default_detail = 'El pedido cambió. Recarga la versión actual antes de continuar.'
    default_code = 'pedido_modificado'


def estado_pedido(pedido):
    return {'estado': pedido.estado, 'fecha_requerida': pedido.fecha_requerida.isoformat(),
            'observaciones': pedido.observaciones, 'sucursal_id': pedido.sucursal_id,
            'detalles': list(pedido.detalles.order_by('producto_id', 'columna').values('producto_id', 'presentacion_id', 'columna', 'cantidad'))}


def obtener_version(pedido):
    return hashlib.sha256(f'{pedido.pk}:{pedido.actualizado_en.isoformat()}'.encode()).hexdigest()


def bloquear_destino(sucursal_id):
    cliente_id = get_object_or_404(Sucursal.objects.only('cliente_id'), pk=sucursal_id).cliente_id
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=cliente_id)
    sucursal = get_object_or_404(Sucursal.objects.select_for_update(), pk=sucursal_id, cliente=cliente)
    return cliente, sucursal


def validar_lineas(lineas, pedido=None):
    anteriores = {(linea.producto_id, linea.columna): linea for linea in pedido.detalles.all()} if pedido else {}
    identificadores = sorted({linea['producto'] for linea in lineas})
    productos = {producto.pk: producto for producto in Producto.objects.select_for_update().filter(pk__in=identificadores).order_by('pk')}
    categorias = {categoria.pk: categoria for categoria in CategoriaProducto.objects.select_for_update().filter(pk__in={p.categoria_id for p in productos.values()}).order_by('pk')}
    unidades = {unidad.pk: unidad for unidad in UnidadMedida.objects.select_for_update().filter(pk__in={p.unidad_medida_id for p in productos.values()}).order_by('pk')}
    presentaciones = {presentacion.pk: presentacion for presentacion in PresentacionProducto.objects.select_for_update().filter(producto_id__in=identificadores).order_by('pk')}
    resultado = []
    for linea in lineas:
        clave = (linea['producto'], linea['columna'])
        anterior = anteriores.get(clave)
        if anterior and anterior.presentacion_id == linea['presentacion'] and anterior.cantidad == linea['cantidad']:
            resultado.append((linea, anterior, None, None))
            continue
        producto = productos.get(linea['producto'])
        presentacion = presentaciones.get(linea['presentacion'])
        if not producto or not producto.activo or not categorias[producto.categoria_id].activo or not unidades[producto.unidad_medida_id].activo:
            raise ValidationError({f'cantidad_{clave[0]}_{clave[1]}': 'El producto o sus catálogos ya no están disponibles. Quita esta cantidad o actualiza la hoja.'})
        if not presentacion or not presentacion.activo or presentacion.producto_id != producto.pk or presentacion.uso not in ('pedido', 'ambos') or presentacion.columna_pedido != linea['columna']:
            raise ValidationError({f'cantidad_{clave[0]}_{clave[1]}': f'{producto.nombre}: revisa la presentación de {linea["columna"]} en Productos.'})
        resultado.append((linea, anterior, producto, (presentacion, categorias[producto.categoria_id])))
    return resultado


def huella_solicitud(datos):
    contenido = {campo: valor for campo, valor in datos.items() if campo not in ('clave_operacion', 'version')}
    contenido.setdefault('observaciones', '')
    contenido['detalles'] = sorted(contenido['detalles'], key=lambda linea: (linea['producto'], linea['columna']))
    return hashlib.sha256(json.dumps(contenido, sort_keys=True, default=str).encode()).hexdigest()


def comprobar_reintento(pedido, actor, huella):
    comprobar_escritura(actor, pedido.sucursal, 'add_pedido')
    if pedido.creado_por_id != actor.pk or pedido.huella_creacion != huella:
        raise ConflictoPedido('Esta clave de creación ya se utilizó. Abre un pedido nuevo antes de continuar.')
    registrar_actividad('pedidos', 'confirmar_registro', actor=actor, objeto=pedido, objeto_nombre=pedido.codigo,
                        descripcion='Reintento confirmado sin crear otro pedido')
    return pedido, False


def guardar_pedido(actor, datos, instancia=None):
    # Validar también al invocar desde un proceso sin HTTP.
    from .serializadores import SerializadorEscrituraPedido
    formulario = SerializadorEscrituraPedido(instancia, data=datos)
    formulario.is_valid(raise_exception=True)
    datos = formulario.validated_data
    huella = huella_solicitud(datos)
    try:
        with transaction.atomic():
            cliente, sucursal = bloquear_destino(instancia.sucursal_id if instancia else datos['sucursal'])
            comprobar_escritura(actor, sucursal, 'change_pedido' if instancia else 'add_pedido')
            if not instancia:
                existente = Pedido.objects.filter(clave_operacion=datos['clave_operacion']).select_related('sucursal').first()
                if existente:
                    return comprobar_reintento(existente, actor, huella)
            pedido = get_object_or_404(Pedido.objects.select_for_update(), pk=instancia.pk) if instancia else None
            if pedido:
                if datos['version'] != obtener_version(pedido):
                    raise ConflictoPedido()
                if pedido.estado != Pedido.Estado.PENDIENTE:
                    raise ConflictoPedido('Solo se pueden editar pedidos pendientes.')
                if pedido.asignaciones_preparacion.filter(preparacion__estado='confirmada', cantidad__gt=0).exists():
                    raise ConflictoPedido('Este pedido ya tiene cantidades preparadas. Conserva sus cantidades y trazabilidad de inventario.')
            if not cliente.activo or not sucursal.activo:
                raise ValidationError({'sucursal': 'El cliente y la sucursal deben estar activos para guardar el pedido.'})
            fecha = datos['fecha_requerida']
            if fecha < timezone.localdate() and (not pedido or fecha != pedido.fecha_requerida):
                raise ValidationError({'fecha_requerida': 'Elige hoy o una fecha posterior.'})
            lineas = validar_lineas(datos['detalles'], pedido)
            antes = estado_pedido(pedido) if pedido else {}
            if not pedido:
                responsable = sucursal.encargado_pedidos if sucursal.encargado_pedidos_id and sucursal.encargado_pedidos.is_active else actor
                pedido = Pedido(sucursal=sucursal, creado_por=actor, responsable=responsable,
                                responsable_nombre=nombre_responsable(responsable), cliente_nombre=cliente.razon_social,
                                sucursal_nombre=sucursal.nombre, direccion=sucursal.direccion,
                                clave_operacion=datos['clave_operacion'], huella_creacion=huella)
            pedido.fecha_requerida = fecha
            if 'observaciones' in datos:
                pedido.observaciones = datos['observaciones'].strip()
            pedido.save()
            conservados = []
            for linea, anterior, producto, referencias in lineas:
                detalle = anterior or DetallePedido(pedido=pedido, producto_id=linea['producto'], columna=linea['columna'])
                if producto:
                    presentacion, categoria = referencias
                    detalle.presentacion = presentacion
                    detalle.producto_nombre = producto.nombre
                    detalle.presentacion_nombre = presentacion.nombre
                    detalle.categoria_nombre = categoria.nombre
                detalle.cantidad = linea['cantidad']
                detalle.save()
                conservados.append(detalle.pk)
            pedido.detalles.exclude(pk__in=conservados).delete()
            registrar_actividad('pedidos', 'editar' if instancia else 'crear', actor=actor, objeto=pedido,
                                objeto_nombre=pedido.codigo, cambios=diferencias(antes, estado_pedido(pedido)))
            return pedido, not bool(instancia)
    except IntegrityError as error:
        if not instancia and Pedido.objects.filter(clave_operacion=datos['clave_operacion']).exists():
            return comprobar_reintento(Pedido.objects.select_related('sucursal').get(clave_operacion=datos['clave_operacion']), actor, huella)
        raise error


@transaction.atomic
def cancelar_pedido(actor, instancia, datos):
    from .serializadores import SerializadorCancelar
    formulario = SerializadorCancelar(data=datos)
    formulario.is_valid(raise_exception=True)
    datos = formulario.validated_data
    _, sucursal = bloquear_destino(instancia.sucursal_id)
    comprobar_escritura(actor, sucursal, 'cancelar_pedido')
    pedido = get_object_or_404(Pedido.objects.select_for_update(), pk=instancia.pk)
    if datos['version'] != obtener_version(pedido) or pedido.estado != Pedido.Estado.PENDIENTE:
        raise ConflictoPedido('El pedido cambió o ya no está pendiente. Recarga antes de continuar.')
    if pedido.asignaciones_preparacion.filter(preparacion__estado='confirmada', cantidad__gt=0).exists():
        raise ConflictoPedido('Este pedido ya tiene cantidades preparadas y no se puede cancelar desde Pedidos.')
    pedido.estado = Pedido.Estado.CANCELADO
    pedido.cancelado_por = actor
    pedido.cancelado_en = timezone.now()
    pedido.motivo_cancelacion = datos['motivo']
    pedido.save()
    registrar_actividad('pedidos', 'cancelar', actor=actor, objeto=pedido, objeto_nombre=pedido.codigo,
                        cambios={'estado': {'antes': 'pendiente', 'despues': 'cancelado'}, 'motivo': datos['motivo']})
    return pedido
