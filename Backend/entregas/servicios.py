from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError, PermissionDenied
from auditoria.servicios import registrar_actividad, nombre_responsable
from despachos.models import Despacho
from .models import Entrega, LineaEntrega, AporteEntrega, OperacionEntrega
from .consultas import origen_entrega, version_entrega, huella
from .permisos import exigir, es_oficina
from .serializadores import SerializadorHoja, SerializadorAccion
from .receptores import encargado_pedidos_recepcion


class ConflictoEntrega(APIException):
    status_code = 409
    default_code = 'entrega_modificada'
    default_detail = 'La entrega cambió. Recarga la hoja antes de continuar.'


def formulario(clase, datos):
    entrada = clase(data=datos)
    entrada.is_valid(raise_exception=True)
    return entrada.validated_data


def bloquear(actor, despacho, pedido, codigo):
    solo_propias = getattr(actor, '_entregas_solo_propias', False)
    actor = get_object_or_404(get_user_model().objects.all(), pk=actor.pk)
    actor._entregas_solo_propias = solo_propias
    if not actor.is_active or not actor.has_perm('entregas.view_entrega'):
        raise PermissionDenied('No tienes acceso a Entregas.')
    get_object_or_404(Despacho.objects.select_for_update(), pk=despacho)
    origen, sucursal = origen_entrega(actor, despacho, pedido, bloquear=True)
    from clientes.models import Sucursal
    sucursal = Sucursal.objects.select_for_update().get(pk=sucursal.pk)
    exigir(actor, sucursal, codigo)
    entrega = Entrega.objects.select_for_update().filter(despacho_id=despacho, pedido_id=pedido).first()
    if entrega and entrega.origen != origen:
        raise ConflictoEntrega('La carga de origen cambió; requiere revisión antes de continuar.')
    return actor, origen, entrega


def operacion_previa(actor, origen, entrega, accion, datos):
    firma = huella([origen['despacho'], origen['pedido'], accion, datos])
    previa = OperacionEntrega.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if previa:
        if previa.huella != firma or previa.entrega_id != getattr(entrega, 'pk', None) or previa.responsable_id != actor.pk:
            raise ConflictoEntrega('La clave de operación ya se utilizó con otros datos.')
        return firma, True
    if datos['version'] != version_entrega(entrega, origen):
        raise ConflictoEntrega()
    return firma, False


def registrar(actor, entrega, accion, datos, firma):
    OperacionEntrega.objects.create(entrega=entrega, clave_operacion=datos['clave_operacion'], accion=accion, huella=firma, responsable=actor)
    cantidades = list(entrega.lineas.order_by('producto_id').values('producto_id', 'cajas_recibidas', 'unidades_recibidas', 'peso_recibido_kg', 'cajas_rechazadas', 'unidades_rechazadas', 'peso_rechazado_kg'))
    registrar_actividad('entregas', accion, actor=actor, objeto=entrega, objeto_nombre=entrega.codigo,
        cambios={'estado': entrega.estado, 'pedido': entrega.pedido_id, 'despacho': entrega.despacho_id,
                 'recibido_por_usuario': entrega.recibido_por_usuario_id,
                 'productos': len(cantidades), 'cantidades': cantidades, 'huella_recepcion': huella(cantidades)}, descripcion=f'{accion.replace("_", " ").capitalize()} de recepción de sucursal')


def validar_lineas(origen, lineas, completo=False):
    permitidos = {fila['producto']: fila for fila in origen['productos']}
    identificadores = [fila['producto'] for fila in lineas]
    if len(set(identificadores)) != len(identificadores) or not set(identificadores) <= set(permitidos):
        raise ValidationError({'lineas': 'Hay productos repetidos o ajenos a esta carga.'})
    errores = {}
    for fila in lineas:
        producto = fila['producto']
        for recibido, rechazado in [('cajas_recibidas', 'cajas_rechazadas'), ('unidades_recibidas', 'unidades_rechazadas'), ('peso_recibido_kg', 'peso_rechazado_kg')]:
            if completo and fila[recibido] is None:
                errores[f'{producto}_{recibido}'] = 'Completa lo recibido; indica cero si no recibiste esa cantidad.'
            if fila[recibido] is not None and fila[rechazado] > fila[recibido]:
                errores[f'{producto}_{rechazado}'] = 'El rechazo no puede superar lo recibido.'
        if any(fila[campo] > 0 for campo in ['cajas_rechazadas', 'unidades_rechazadas', 'peso_rechazado_kg']) and not fila['motivo_rechazo'].strip():
            errores[f'{producto}_motivo_rechazo'] = 'Indica el motivo del rechazo.'
        if completo and permitidos[producto]['peso_kg'] is None:
            errores[f'{producto}_peso_recibido_kg'] = 'El envío no conserva un peso completo para comparar.'
    if completo and set(identificadores) != set(permitidos):
        errores['lineas'] = 'Revisa todos los productos de la entrega, también los de otras páginas.'
    if errores:
        raise ValidationError(errores)


def validar_cabecera(entrega, origen):
    if not entrega.recibido_por.strip():
        raise ValidationError({'recibido_por': 'Asigna un encargado de pedidos activo a la sucursal y guarda la recepción.'})
    if not entrega.fecha_recepcion or not entrega.recibido_por.strip():
        raise ValidationError({'cabecera': 'Completa la fecha de recepción y quién recibió.'})
    fecha_descarga = timezone.localtime(timezone.datetime.fromisoformat(origen['descargada_en'])).date()
    if not fecha_descarga <= entrega.fecha_recepcion <= timezone.localdate():
        raise ValidationError({'fecha_recepcion': 'La fecha debe estar entre la descarga y hoy.'})


def datos_lineas(entrega):
    return list(entrega.lineas.values('producto', 'cajas_recibidas', 'unidades_recibidas', 'peso_recibido_kg',
        'cajas_rechazadas', 'unidades_rechazadas', 'peso_rechazado_kg', 'motivo_rechazo'))


def guardar_aportes(entrega, origen, datos):
    permitidos = {(a['carga'], a['lote']) for p in origen['productos'] for a in p['aportes']}
    claves = [(a['carga'], a['lote']) for a in datos]
    if len(set(claves)) != len(claves) or not set(claves) <= permitidos:
        raise ValidationError({'aportes': 'Los lotes deben pertenecer a la carga de esta entrega y no repetirse.'})
    if any(a['peso_rechazado_kg'] > a['peso_recibido_kg'] for a in datos):
        raise ValidationError({'aportes': 'El rechazo de un lote no puede superar lo recibido de ese lote.'})
    entrega.aportes.all().delete()
    AporteEntrega.objects.bulk_create([AporteEntrega(entrega=entrega, carga_id=a['carga'], lote_id=a['lote'],
        peso_recibido_kg=a['peso_recibido_kg'], peso_rechazado_kg=a['peso_rechazado_kg']) for a in datos])


@transaction.atomic
def guardar_hoja(actor, despacho, pedido, datos):
    datos = formulario(SerializadorHoja, datos)
    actor, origen, entrega = bloquear(actor, despacho, pedido, 'view_entrega')
    from clientes.models import Sucursal
    sucursal = Sucursal.objects.get(pk=origen['sucursal'])
    primera_operacion = (OperacionEntrega.objects.filter(entrega=entrega, accion='guardar').order_by('pk')
                         .values_list('clave_operacion', flat=True).first()) if entrega else None
    creando = entrega is None or primera_operacion == datos['clave_operacion']
    exigir(actor, sucursal, 'add_entrega' if creando else 'change_entrega')
    receptor = encargado_pedidos_recepcion(sucursal, bloquear=True) if entrega is None or not entrega.recibido_por else None
    firma, repetida = operacion_previa(actor, origen, entrega, 'guardar', datos)
    if repetida:
        return entrega
    if entrega and (entrega.estado == 'confirmada' or (entrega.estado == 'revision' and not es_oficina(actor))):
        raise ConflictoEntrega('Esta recepción está en revisión o confirmada; no admite esta edición.')
    validar_lineas(origen, datos['lineas'])
    if datos['fecha_recepcion'] and datos['fecha_recepcion'] > timezone.localdate():
        raise ValidationError({'fecha_recepcion': 'La recepción no puede tener una fecha futura.'})
    if entrega is None:
        entrega = Entrega(despacho_id=despacho, pedido_id=pedido, parada_id=origen['parada'], origen=origen,
            responsable=actor, responsable_nombre=nombre_responsable(actor))
    entrega.fecha_recepcion = datos['fecha_recepcion']
    # El campo legado se acepta en el cuerpo para conservar la huella de reintentos;
    # una captura nueva siempre toma la identidad de la asignación de la sucursal.
    if not entrega.pk or not entrega.recibido_por:
        entrega.recibido_por_usuario = receptor
        entrega.recibido_por = nombre_responsable(receptor) if receptor else ''
    entrega.save()
    entrega.lineas.all().delete()
    LineaEntrega.objects.bulk_create([LineaEntrega(entrega=entrega, producto_id=fila['producto'],
        **{k: v for k, v in fila.items() if k != 'producto'}) for fila in datos['lineas']])
    if es_oficina(actor):
        guardar_aportes(entrega, origen, datos['aportes'])
    elif datos['aportes']:
        raise PermissionDenied('La conciliación por lote corresponde a la oficina.')
    registrar(actor, entrega, 'guardar', datos, firma)
    return entrega


def conciliar_aportes(entrega):
    existentes = {(a.carga_id, a.lote_id): a for a in entrega.aportes.all()}
    lineas = {fila.producto_id: fila for fila in entrega.lineas.all()}
    errores = {}
    for producto in entrega.origen['productos']:
        fila = lineas[producto['producto']]
        origenes = producto['aportes']
        if len(origenes) == 1:
            referencia = origenes[0]
            AporteEntrega.objects.update_or_create(entrega=entrega, carga_id=referencia['carga'], lote_id=referencia['lote'],
                defaults={'peso_recibido_kg': fila.peso_recibido_kg, 'peso_rechazado_kg': fila.peso_rechazado_kg})
            continue
        elegidos = [existentes.get((a['carga'], a['lote'])) for a in origenes]
        if not origenes or any(a is None for a in elegidos) or sum((a.peso_recibido_kg for a in elegidos), Decimal(0)) != fila.peso_recibido_kg or sum((a.peso_rechazado_kg for a in elegidos), Decimal(0)) != fila.peso_rechazado_kg:
            errores[f"lotes_{producto['producto']}"] = 'Distribuye los kilos recibidos y rechazados entre todos sus aportes de lotes. Las sumas deben coincidir con la recepción.'
    if errores:
        raise ValidationError(errores)


@transaction.atomic
def ejecutar_accion(actor, despacho, pedido, accion, datos):
    datos = formulario(SerializadorAccion, datos)
    codigo = 'enviar_entrega' if accion == 'enviar' else 'confirmar_entrega'
    actor, origen, entrega = bloquear(actor, despacho, pedido, codigo)
    firma, repetida = operacion_previa(actor, origen, entrega, accion, datos)
    if repetida:
        return entrega
    if entrega is None:
        raise ValidationError({'entrega': 'Guarda primero la recepción.'})
    if accion == 'enviar':
        if entrega.estado != 'borrador':
            raise ConflictoEntrega('Solo un borrador se puede enviar a revisión.')
        validar_cabecera(entrega, origen)
        validar_lineas(origen, datos_lineas(entrega), completo=True)
        entrega.estado, entrega.enviado_en = 'revision', timezone.now()
    elif accion == 'confirmar':
        if entrega.estado != 'revision':
            raise ConflictoEntrega('La entrega debe estar enviada a revisión.')
        validar_cabecera(entrega, origen)
        validar_lineas(origen, datos_lineas(entrega), completo=True)
        conciliar_aportes(entrega)
        entrega.estado, entrega.confirmado_en = 'confirmada', timezone.now()
        entrega.confirmado_por, entrega.confirmado_por_nombre = actor, nombre_responsable(actor)
    elif accion == 'devolver':
        if entrega.estado != 'revision':
            raise ConflictoEntrega('Solo una recepción en revisión puede volver a borrador.')
        entrega.estado, entrega.enviado_en = 'borrador', None
    else:
        raise ValidationError({'accion': 'Acción no válida.'})
    entrega.save()
    registrar(actor, entrega, accion, datos, firma)
    return entrega
