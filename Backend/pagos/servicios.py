import uuid
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from clientes.models import Cliente
from cobros.comprobantes import preparar_comprobante, metadatos_comprobante
from cobros.consultas import representar_saldo
from cobros.servicios import validar_entrada, comprobar_saldos, revisar_cobro, registrar_cobro, ConflictoCobro
from precios.consultas import huella
from ventas.models import Venta
from .models import AvisoPago, AplicacionAvisoPago, ComprobanteAvisoPago, OperacionPago
from .permisos import autorizar_propios, autorizar_oficina
from .serializadores import DecisionPago


def entrada_pago(entrada, archivo):
    datos = validar_entrada(entrada)
    if datos['medio'] not in ['transferencia', 'deposito']:
        raise ValidationError({'medio': 'Informa una transferencia o un depósito.'})
    if datos['referencia'].strip():
        raise ValidationError({'referencia': 'El informe del pago utiliza un comprobante adjunto.'})
    comprobante = preparar_comprobante(archivo)
    if comprobante is None:
        raise ValidationError({'comprobante': 'Sube el comprobante del pago realizado.'})
    return datos, comprobante


def bloquear_propios(actor, datos):
    actor = autorizar_propios(actor, True, datos['cliente'])
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=datos['cliente'])
    ventas = list(Venta.objects.select_for_update().filter(pk__in=[f['venta'] for f in datos['aplicaciones']]).order_by('pk'))
    return autorizar_propios(actor, True, cliente.pk), cliente, ventas


@transaction.atomic
def revisar_informe(actor, entrada, archivo):
    datos, comprobante = entrada_pago(entrada, archivo)
    _, cliente, ventas = bloquear_propios(actor, datos)
    return comprobar_saldos(cliente, ventas, datos, comprobante)


@transaction.atomic
def informar_pago(actor, entrada, archivo):
    datos, comprobante = entrada_pago(entrada, archivo)
    actor, cliente, ventas = bloquear_propios(actor, datos)
    firma = huella([datos, metadatos_comprobante(comprobante)])
    anterior = AvisoPago.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if anterior:
        if anterior.huella != firma or anterior.informado_por_id != actor.pk or anterior.cliente_id != cliente.pk:
            raise ConflictoCobro('La clave ya pertenece a otro informe o responsable.')
        return anterior
    revision = comprobar_saldos(cliente, ventas, datos, comprobante)
    if not datos['revision'] or revision['revision'] != datos['revision']:
        raise ConflictoCobro('Revisa los importes y el comprobante antes de informar el pago.')
    actor = autorizar_propios(actor, True, cliente.pk)
    aviso = AvisoPago.objects.create(clave_operacion=datos['clave_operacion'], huella=firma, cliente=cliente,
        cliente_nombre=cliente.razon_social, cliente_nit=cliente.nit, fecha_pago=datos['fecha_cobro'], importe=datos['importe'],
        medio=datos['medio'], informado_por=actor, informado_por_nombre=nombre_responsable(actor))
    ComprobanteAvisoPago.objects.create(aviso=aviso, **comprobante)
    AplicacionAvisoPago.objects.bulk_create([AplicacionAvisoPago(aviso=aviso, venta_id=f['venta'], venta_codigo=f['codigo'],
        importe=f['importe'], saldo_informado=f['saldo_anterior']) for f in revision['aplicaciones']])
    registrar_actividad('pagos', 'informar', actor=actor, objeto=aviso, objeto_nombre=aviso.codigo,
        cambios={'cliente': cliente.pk, 'importe': str(aviso.importe), 'ventas': [f['venta'] for f in revision['aplicaciones']], 'comprobante_sha256': comprobante['sha256']},
        descripcion='Informar pago del supermercado para verificación')
    return aviso


def bloquear_oficina(actor, identificador, accion):
    actor = autorizar_oficina(actor, accion)
    origen = get_object_or_404(AvisoPago.objects.only('cliente_id'), pk=identificador)
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=origen.cliente_id)
    ventas = list(Venta.objects.select_for_update().filter(pk__in=AplicacionAvisoPago.objects.filter(aviso_id=identificador).values('venta_id')).order_by('pk'))
    aviso = get_object_or_404(AvisoPago.objects.select_for_update(), pk=identificador)
    actor = autorizar_oficina(actor, accion)
    if accion in ['confirmar', 'observar'] and aviso.informado_por_id == actor.pk:
        raise PermissionDenied('Otra persona de HortyFru debe verificar el pago que informaste.')
    return actor, cliente, ventas, aviso


def datos_del_aviso(aviso, ventas):
    por_venta = {v.pk: v for v in ventas}
    aplicaciones = []
    for fila in aviso.aplicaciones.order_by('venta_id'):
        venta = por_venta.get(fila.venta_id)
        if venta is None:
            raise ConflictoCobro('La venta informada ya no está disponible.')
        aplicaciones.append({'venta': venta.pk, 'importe': str(fila.importe), 'version_saldo': representar_saldo(venta)['version_saldo']})
    archivo = aviso.archivo_comprobante
    contenido = bytes(archivo.contenido)
    comprobante = SimpleUploadedFile(archivo.nombre, contenido, content_type=archivo.tipo)
    if metadatos_comprobante(preparar_comprobante(comprobante)) != {'nombre': archivo.nombre, 'tipo': archivo.tipo, 'tamano': archivo.tamano, 'sha256': archivo.sha256}:
        raise ConflictoCobro('El comprobante no supera su verificación de integridad.')
    return {'clave_operacion': str(aviso.clave_cobro), 'cliente': aviso.cliente_id, 'fecha_cobro': str(aviso.fecha_pago),
        'importe': str(aviso.importe), 'medio': aviso.medio, 'referencia': '', 'aplicaciones': aplicaciones}, comprobante


def decision_validada(entrada):
    formulario = DecisionPago(data=entrada)
    formulario.is_valid(raise_exception=True)
    return formulario.validated_data


@transaction.atomic
def revisar_verificacion(actor, identificador, entrada):
    datos = decision_validada(entrada)
    actor, _, ventas, aviso = bloquear_oficina(actor, identificador, 'confirmar')
    if aviso.estado != 'por_verificar' or aviso.version != datos['version']:
        raise ConflictoCobro('El pago cambió. Vuelve a abrirlo para revisar.')
    cuerpo, archivo = datos_del_aviso(aviso, ventas)
    return {**revisar_cobro(actor, cuerpo, archivo), 'version_aviso': str(aviso.version)}


@transaction.atomic
def decidir_pago(actor, identificador, accion, entrada):
    datos = decision_validada(entrada)
    actor, _, ventas, aviso = bloquear_oficina(actor, identificador, accion)
    firma = huella([identificador, accion, datos])
    repetida = OperacionPago.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if repetida:
        if repetida.aviso_id != aviso.pk or repetida.accion != accion or repetida.huella != firma or repetida.responsable_id != actor.pk:
            raise ConflictoCobro('La clave pertenece a otra decisión o responsable.')
        return aviso
    if aviso.estado != 'por_verificar' or aviso.version != datos['version']:
        raise ConflictoCobro('El pago ya fue revisado o su versión cambió.')
    if accion == 'confirmar':
        cuerpo, archivo = datos_del_aviso(aviso, ventas)
        cobro = registrar_cobro(actor, {**cuerpo, 'revision': datos['revision']}, archivo)
        aviso.estado, aviso.cobro = 'confirmado', cobro
    elif accion == 'observar':
        if not datos['motivo'].strip():
            raise ValidationError({'motivo': 'Indica por qué el pago necesita una corrección.'})
        aviso.estado, aviso.motivo_observacion = 'observado', datos['motivo'].strip()
    else:
        raise ValidationError({'accion': 'Decisión no disponible.'})
    actor = autorizar_oficina(actor, accion)
    aviso.revisado_por, aviso.revisado_por_nombre, aviso.revisado_en = actor, nombre_responsable(actor), timezone.now()
    aviso.version = uuid.uuid4()
    aviso.save()
    OperacionPago.objects.create(clave_operacion=datos['clave_operacion'], aviso=aviso, accion=accion, huella=firma, responsable=actor)
    registrar_actividad('pagos', accion, actor=actor, objeto=aviso, objeto_nombre=aviso.codigo,
        cambios={'estado': aviso.estado, 'cobro': aviso.cobro_id, 'motivo': aviso.motivo_observacion}, descripcion='Verificar pago informado por supermercado')
    return aviso
