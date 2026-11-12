from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from clientes.models import Cliente
from entregas.models import Entrega
from precios.consultas import huella
from .models import Venta, SeleccionVenta, EntregaVenta, LineaVenta, AporteVenta, OperacionVenta
from .consultas import version_venta, revisar_venta
from .permisos import autorizar
from .serializadores import SerializadorVenta, SerializadorAccion


class ConflictoVenta(APIException):
    status_code = 409
    default_code = 'venta_modificada'
    default_detail = 'Los datos cambiaron. Recarga y revisa nuevamente la venta.'


def validar(clase, datos):
    formulario = clase(data=datos)
    formulario.is_valid(raise_exception=True)
    return formulario.validated_data


def bloquear(actor, accion, identificador=None, cliente_id=None, entregas_ids=None):
    actor = autorizar(actor, accion)
    if identificador:
        cliente_id = get_object_or_404(Venta, pk=identificador).cliente_id
    # Mismo bloqueo que aceptación/corrección de precios: ninguna emisión usa un
    # precio a medio reemplazar. Entregas preceden al documento en orden estable.
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=cliente_id)
    if identificador and entregas_ids is None:
        entregas_ids = list(SeleccionVenta.objects.filter(venta_id=identificador).values_list('entrega_id', flat=True))
    list(Entrega.objects.select_for_update().filter(pk__in=entregas_ids or []).order_by('pk'))
    venta = get_object_or_404(Venta.objects.select_for_update(), pk=identificador) if identificador else None
    return autorizar(actor, accion), cliente, venta


def comprobar_operacion(actor, venta, identificador, cliente, accion, datos):
    firma = huella([identificador, cliente.pk, accion, datos])
    anterior = OperacionVenta.objects.select_related('venta').filter(clave_operacion=datos['clave_operacion']).first()
    if anterior:
        if (anterior.huella, anterior.responsable_id, anterior.accion) != (firma, actor.pk, accion):
            raise ConflictoVenta('La clave de operación ya corresponde a otro cuerpo o responsable.')
        return firma, anterior.venta
    if datos['version'] != (version_venta(venta) if venta else ''):
        raise ConflictoVenta()
    if venta and venta.estado != 'borrador':
        raise ConflictoVenta('El documento emitido o cancelado conserva sus datos y no se modifica.')
    return firma, None


def registrar(actor, venta, accion, datos, firma, cambio=True):
    OperacionVenta.objects.create(venta=venta, clave_operacion=datos['clave_operacion'], huella=firma, accion=accion, responsable=actor)
    if cambio:
        registrar_actividad('ventas', accion, actor=actor, objeto=venta, objeto_nombre=venta.codigo,
            cambios={'estado': venta.estado, 'cliente': venta.cliente_id, 'entregas': list(venta.selecciones.order_by('entrega_id').values_list('entrega_id', flat=True)),
                'total': str(venta.total) if venta.estado == 'emitida' else None}, descripcion=f'{accion.capitalize()} resumen de venta')


@transaction.atomic
def guardar(actor, datos, identificador=None):
    datos = validar(SerializadorVenta, datos)
    accion = 'editar' if identificador else 'crear'
    actor, cliente, venta = bloquear(actor, accion, identificador, datos['cliente'], datos['entregas'])
    firma, anterior = comprobar_operacion(actor, venta, identificador, cliente, 'guardar', datos)
    if anterior:
        return anterior
    if not cliente.activo or cliente.pk != datos['cliente']:
        raise ValidationError({'cliente': 'Selecciona el supermercado activo del documento.'})
    entregas = list(Entrega.objects.filter(pk__in=datos['entregas'], estado='confirmada', pedido__sucursal__cliente=cliente,
        fecha_recepcion__gte=datos['desde'], fecha_recepcion__lte=datos['hasta']))
    if len(entregas) != len(datos['entregas']):
        raise ValidationError({'entregas': 'Selecciona entregas confirmadas del supermercado dentro de las fechas de recepción elegidas.'})
    if EntregaVenta.objects.filter(entrega_id__in=datos['entregas']).exists():
        raise ConflictoVenta('Una entrega ya se incluyó en otra venta. Actualiza la selección.')
    if sum(e.lineas.count() for e in entregas) > 500:
        raise ValidationError({'entregas': 'Incluye hasta 500 productos entre las entregas del documento.'})
    cambio = venta is None or (venta.desde, venta.hasta, venta.vencimiento, set(venta.selecciones.values_list('entrega_id', flat=True))) != (
        datos['desde'], datos['hasta'], datos['vencimiento'], set(datos['entregas']))
    if venta is None:
        venta = Venta(cliente=cliente, cliente_nombre=cliente.razon_social, cliente_nit=cliente.nit,
            registrado_por=actor, registrado_por_nombre=nombre_responsable(actor))
    if cambio:
        for campo in ['desde', 'hasta', 'vencimiento']:
            setattr(venta, campo, datos[campo])
        venta.save()
        venta.selecciones.all().delete()
        SeleccionVenta.objects.bulk_create([SeleccionVenta(venta=venta, entrega=e) for e in entregas])
    autorizar(actor, accion)
    registrar(actor, venta, 'guardar', datos, firma, cambio)
    return venta


@transaction.atomic
def actuar(actor, identificador, accion, datos):
    if accion not in ['emitir', 'cancelar']:
        raise ValidationError('Operación de ventas desconocida.')
    datos = validar(SerializadorAccion, datos)
    actor, cliente, venta = bloquear(actor, accion, identificador)
    firma, anterior = comprobar_operacion(actor, venta, identificador, cliente, accion, datos)
    if anterior:
        return anterior
    if accion == 'cancelar':
        venta.estado = 'cancelada'
    else:
        venta.cliente = cliente
        revision = revisar_venta(venta)
        if revision['incidencias']:
            raise ValidationError({'entregas': 'Revisa las entregas y los precios pendientes antes de emitir.', 'incidencias': revision['incidencias']})
        if not datos['revision'] or datos['revision'] != revision['revision']:
            raise ConflictoVenta('Cambió la revisión de pesos o precios. Revisa el total actualizado antes de emitir.')
        hoy = timezone.localdate()
        if venta.vencimiento and venta.vencimiento < hoy:
            raise ValidationError({'vencimiento': 'El vencimiento no puede ser anterior al día de emisión.'})
        venta.estado, venta.fecha_emision, venta.emitido_en = 'emitida', hoy, timezone.now()
        venta.emitido_por, venta.emitido_por_nombre = actor, nombre_responsable(actor)
        venta.cliente_nombre, venta.cliente_nit = cliente.razon_social, cliente.nit
        venta.total, venta.peso_aceptado_kg = Decimal(revision['total']), Decimal(revision['peso_aceptado_kg'])
        EntregaVenta.objects.bulk_create([EntregaVenta(venta=venta, entrega_id=e['id']) for e in revision['entregas']])
        for fila in revision['lineas']:
            contenido = {k: v for k, v in fila.items() if k != 'aportes'}
            linea = LineaVenta.objects.create(venta=venta, linea_entrega_id=fila['linea_entrega'], precio_id=fila['precio'], contenido=contenido,
                peso_aceptado_kg=Decimal(fila['peso_aceptado_kg']), precio_kg=Decimal(fila['precio_kg']), importe=Decimal(fila['importe']))
            AporteVenta.objects.bulk_create([AporteVenta(linea=linea, aporte_id=a['aporte'], codigo_lote=a['codigo_lote'],
                peso_aceptado_kg=Decimal(a['peso_aceptado_kg']), importe=Decimal(a['importe'])) for a in fila['aportes']])
    autorizar(actor, accion)
    venta.save()
    registrar(actor, venta, accion, datos, firma)
    return venta
