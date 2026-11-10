from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from clientes.models import Cliente
from productos.models import Producto
from entregas.models import Entrega
from .models import AcuerdoPrecio, DetallePrecio, EntregaPrecio, OperacionPrecio
from .consultas import huella, version_acuerdo, acuerdos_actuales
from .permisos import exigir
from .serializadores import SerializadorAcuerdo, SerializadorAccion


class ConflictoPrecio(APIException):
    status_code = 409
    default_code = 'precio_modificado'
    default_detail = 'La propuesta cambió. Recarga sus datos antes de continuar.'


def entrada(clase, datos):
    formulario = clase(data=datos)
    formulario.is_valid(raise_exception=True)
    return formulario.validated_data


def bloquear(actor, accion, identificador=None, cliente_id=None):
    solo_propias = getattr(actor, '_entregas_solo_propias', False)
    actor = get_object_or_404(get_user_model(), pk=actor.pk)
    actor._entregas_solo_propias = solo_propias
    exigir(actor, accion)
    if identificador:
        cliente_id = get_object_or_404(AcuerdoPrecio, pk=identificador).cliente_id
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=cliente_id)
    acuerdo = get_object_or_404(AcuerdoPrecio.objects.select_for_update(of=('self',)).select_related('anterior'), pk=identificador) if identificador else None
    return actor, cliente, acuerdo


def previa(actor, acuerdo, identificador, cliente, accion, datos):
    firma = huella([identificador, cliente.pk, accion, datos])
    operacion = OperacionPrecio.objects.select_related('acuerdo').filter(clave_operacion=datos['clave_operacion']).first()
    if operacion:
        if operacion.huella != firma or operacion.responsable_id != actor.pk or operacion.accion != accion:
            raise ConflictoPrecio('Esta clave ya se utilizó con otro cuerpo o responsable.')
        return firma, operacion.acuerdo
    if datos['version'] != (version_acuerdo(acuerdo) if acuerdo else ''):
        raise ConflictoPrecio()
    return firma, None


def registrar(actor, acuerdo, accion, datos, firma):
    acuerdo.save()
    OperacionPrecio.objects.create(acuerdo=acuerdo, clave_operacion=datos['clave_operacion'], huella=firma, accion=accion, responsable=actor)
    registrar_actividad('precios', accion, actor=actor, objeto=acuerdo, objeto_nombre=acuerdo.codigo,
        cambios={'estado': acuerdo.estado, 'cliente': acuerdo.cliente_id, 'alcance': acuerdo.alcance,
            'version_comercial': acuerdo.numero_version, 'anterior': acuerdo.anterior_id,
            'huella_precios': huella(list(acuerdo.lineas.order_by('producto_id').values('producto_id', 'precio_kg')))},
        descripcion=f'{accion.replace("_", " ").capitalize()} de precios propuestos por el supermercado')


def validar_documento(acuerdo, cliente, completo=False):
    errores = {}
    if not cliente.activo:
        errores['cliente'] = 'El supermercado debe estar activo.'
    if acuerdo.alcance == 'periodo':
        if completo and (not acuerdo.desde or not acuerdo.hasta):
            errores['desde'] = 'Completa las dos fechas de vigencia.'
        if acuerdo.desde and acuerdo.hasta and acuerdo.desde > acuerdo.hasta:
            errores['hasta'] = 'La fecha final no puede ser anterior a la inicial.'
        if acuerdo.entregas.exists():
            errores['entregas'] = 'Un acuerdo por fechas no incluye entregas específicas.'
    elif acuerdo.desde or acuerdo.hasta:
        errores['desde'] = 'Las entregas específicas no utilizan un período adicional.'
    elif completo and not acuerdo.entregas.exists():
        errores['entregas'] = 'Selecciona al menos una entrega confirmada.'
    lineas = list(acuerdo.lineas.select_related('producto__categoria').order_by('producto_id'))
    if completo and not lineas:
        errores['lineas'] = 'Agrega al menos un producto con su precio por kg.'
    productos_entregados = set()
    for enlace in acuerdo.entregas.select_related('entrega__pedido__sucursal').prefetch_related('entrega__lineas'):
        if enlace.entrega.estado != 'confirmada' or enlace.entrega.pedido.sucursal.cliente_id != cliente.pk:
            errores['entregas'] = 'Selecciona solo entregas confirmadas del mismo supermercado.'
        productos_entregados.update(fila.producto_id for fila in enlace.entrega.lineas.all())
    for fila in lineas:
        if completo and fila.precio_kg is None:
            errores[f'{fila.producto_id}_precio_kg'] = 'Indica el precio que propone pagar el supermercado por kilogramo.'
        if completo and (not fila.producto.activo or not fila.producto.categoria.activo):
            errores[f'{fila.producto_id}_precio_kg'] = 'El producto y su categoría deben estar activos.'
        if completo and acuerdo.alcance == 'entregas' and fila.producto_id not in productos_entregados:
            errores[f'{fila.producto_id}_precio_kg'] = 'El producto no aparece en las entregas seleccionadas.'
    if acuerdo.anterior_id:
        anterior = acuerdo.anterior
        if not acuerdo.motivo_version.strip():
            errores['motivo_version'] = 'Indica por qué se corrige el acuerdo.'
        if (anterior.cliente_id, anterior.alcance, anterior.desde, anterior.hasta) != (acuerdo.cliente_id, acuerdo.alcance, acuerdo.desde, acuerdo.hasta):
            errores['desde'] = 'Una nueva versión conserva el supermercado y la vigencia del acuerdo original.'
        if set(anterior.entregas.values_list('entrega_id', flat=True)) != set(acuerdo.entregas.values_list('entrega_id', flat=True)):
            errores['entregas'] = 'Una nueva versión conserva las entregas del acuerdo original.'
        if set(anterior.lineas.values_list('producto_id', flat=True)) != {fila.producto_id for fila in lineas}:
            errores['lineas'] = 'Una nueva versión conserva los productos originales y permite corregir sus precios.'
        if anterior.versiones.filter(estado='aceptado').exists():
            raise ConflictoPrecio('Ya se aceptó otra versión. Abre la última versión del acuerdo.')
    if errores:
        raise ValidationError(errores)


@transaction.atomic
def guardar(actor, datos, identificador=None):
    datos = entrada(SerializadorAcuerdo, datos)
    actor, cliente, acuerdo = bloquear(actor, 'editar' if identificador else 'crear', identificador, datos['cliente'])
    firma, repetida = previa(actor, acuerdo, identificador, cliente, 'guardar', datos)
    if repetida:
        return repetida
    if acuerdo and acuerdo.estado != 'borrador':
        raise ConflictoPrecio('Solo se editan borradores; las propuestas registradas conservan sus precios.')
    if cliente.pk != datos['cliente']:
        raise ValidationError({'cliente': 'El supermercado del borrador no se puede cambiar.'})
    productos_ids = [fila['producto'] for fila in datos['lineas']]
    if len(productos_ids) != len(set(productos_ids)) or len(datos['entregas']) != len(set(datos['entregas'])):
        raise ValidationError({'lineas': 'Hay productos o entregas repetidos.'})
    productos = {p.pk: p for p in Producto.objects.select_related('categoria').filter(pk__in=productos_ids)}
    if set(productos) != set(productos_ids):
        raise ValidationError({'lineas': 'Hay productos que no existen.'})
    if acuerdo is None:
        acuerdo = AcuerdoPrecio(cliente=cliente, cliente_nombre=cliente.razon_social, registrado_por=actor, registrado_por_nombre=nombre_responsable(actor))
    for campo in ['alcance', 'desde', 'hasta', 'referencia_propuesta']:
        setattr(acuerdo, campo, datos[campo])
    if acuerdo.desde and acuerdo.hasta and acuerdo.desde > acuerdo.hasta:
        raise ValidationError({'hasta': 'La fecha final no puede ser anterior a la inicial.'})
    acuerdo.save()
    acuerdo.lineas.all().delete()
    DetallePrecio.objects.bulk_create([DetallePrecio(acuerdo=acuerdo, producto_id=fila['producto'], producto_nombre=productos[fila['producto']].nombre,
        categoria_nombre=productos[fila['producto']].categoria.nombre, precio_kg=fila['precio_kg']) for fila in datos['lineas']])
    entregas = list(Entrega.objects.filter(pk__in=datos['entregas'], estado='confirmada', pedido__sucursal__cliente=cliente))
    if len(entregas) != len(datos['entregas']):
        raise ValidationError({'entregas': 'Selecciona solo entregas confirmadas del supermercado elegido.'})
    acuerdo.entregas.all().delete()
    EntregaPrecio.objects.bulk_create([EntregaPrecio(acuerdo=acuerdo, entrega=entrega) for entrega in entregas])
    validar_documento(acuerdo, cliente)
    registrar(actor, acuerdo, 'guardar', datos, firma)
    return acuerdo


def validar_solapamiento(acuerdo):
    candidatos = acuerdos_actuales().filter(cliente=acuerdo.cliente, alcance=acuerdo.alcance).exclude(pk=acuerdo.anterior_id)
    if acuerdo.alcance == 'periodo':
        candidatos = candidatos.filter(desde__lte=acuerdo.hasta, hasta__gte=acuerdo.desde)
    else:
        candidatos = candidatos.filter(entregas__entrega_id__in=acuerdo.entregas.values('entrega_id'))
    conflicto = DetallePrecio.objects.filter(acuerdo__in=candidatos, producto_id__in=acuerdo.lineas.values('producto_id')).select_related('acuerdo').first()
    if conflicto:
        raise ValidationError({'lineas': f'{conflicto.producto_nombre} ya tiene un precio aceptado en {conflicto.acuerdo.codigo} para ese alcance. Ajusta la vigencia o crea una nueva versión desde ese acuerdo.'})


@transaction.atomic
def actuar(actor, identificador, accion, datos):
    if accion not in ['presentar', 'aceptar', 'rechazar', 'cancelar', 'nueva_version']:
        raise ValidationError('Acción de precios desconocida.')
    datos = entrada(SerializadorAccion, datos)
    actor, cliente, acuerdo = bloquear(actor, 'crear' if accion == 'nueva_version' else accion, identificador)
    firma, repetida = previa(actor, acuerdo, identificador, cliente, accion, datos)
    if repetida:
        return repetida
    esperado = 'aceptado' if accion == 'nueva_version' else 'borrador' if accion in ['presentar', 'cancelar'] else 'propuesta'
    if acuerdo.estado != esperado:
        raise ConflictoPrecio('La propuesta ya cambió de estado. Recarga antes de continuar.')
    if accion == 'nueva_version':
        if acuerdo.versiones.filter(estado='aceptado').exists():
            raise ConflictoPrecio('Crea la corrección desde la última versión aceptada.')
        if not datos['motivo'].strip():
            raise ValidationError({'motivo': 'Indica el motivo de la nueva versión.'})
        nuevo = AcuerdoPrecio.objects.create(cliente=cliente, cliente_nombre=acuerdo.cliente_nombre, alcance=acuerdo.alcance,
            familia=acuerdo.familia, desde=acuerdo.desde, hasta=acuerdo.hasta, referencia_propuesta=acuerdo.referencia_propuesta, anterior=acuerdo,
            numero_version=acuerdo.numero_version + 1, motivo_version=datos['motivo'].strip(), registrado_por=actor, registrado_por_nombre=nombre_responsable(actor))
        DetallePrecio.objects.bulk_create([DetallePrecio(acuerdo=nuevo, producto_id=f.producto_id, producto_nombre=f.producto_nombre,
            categoria_nombre=f.categoria_nombre, precio_kg=f.precio_kg) for f in acuerdo.lineas.all()])
        EntregaPrecio.objects.bulk_create([EntregaPrecio(acuerdo=nuevo, entrega_id=i) for i in acuerdo.entregas.values_list('entrega_id', flat=True)])
        registrar(actor, nuevo, accion, datos, firma)
        return nuevo
    if accion in ['presentar', 'aceptar']:
        # Las filas del catálogo se bloquean al decidir; las medidas físicas no se alteran.
        list(Producto.objects.select_for_update().filter(pk__in=acuerdo.lineas.values('producto_id')).order_by('pk'))
        validar_documento(acuerdo, cliente, completo=True)
    if accion == 'presentar':
        acuerdo.estado, acuerdo.propuesto_en = 'propuesta', timezone.now()
        acuerdo.propuesto_por, acuerdo.propuesto_por_nombre = actor, nombre_responsable(actor)
    elif accion == 'aceptar':
        validar_solapamiento(acuerdo)
        acuerdo.estado = 'aceptado'
    elif accion == 'rechazar':
        if not datos['motivo'].strip():
            raise ValidationError({'motivo': 'Indica por qué no se acepta la propuesta.'})
        acuerdo.estado, acuerdo.motivo_rechazo = 'rechazado', datos['motivo'].strip()
    else:
        acuerdo.estado = 'cancelado'
    if accion in ['aceptar', 'rechazar']:
        acuerdo.revisado_por, acuerdo.revisado_por_nombre = actor, nombre_responsable(actor)
        acuerdo.revisado_en = timezone.now()
    registrar(actor, acuerdo, accion, datos, firma)
    return acuerdo
