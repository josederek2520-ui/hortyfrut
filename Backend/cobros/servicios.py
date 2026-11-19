from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from clientes.models import Cliente
from precios.consultas import huella
from ventas.models import Venta
from .models import Cobro, AplicacionCobro, ComprobanteCobro
from .comprobantes import preparar_comprobante, metadatos_comprobante, comprobar_medio_comprobante
from .permisos import autorizar
from .serializadores import EntradaCobro
from .consultas import representar_saldo


class ConflictoCobro(APIException):
    status_code = 409
    default_detail = 'Los saldos cambiaron. Actualízalos y revisa el cobro nuevamente.'


def validar_entrada(entrada):
    formulario = EntradaCobro(data=entrada)
    formulario.is_valid(raise_exception=True)
    return formulario.validated_data


def bloquear(actor, datos):
    actor = autorizar(actor, True)
    cliente = get_object_or_404(Cliente.objects.select_for_update(), pk=datos['cliente'])
    ventas = list(Venta.objects.select_for_update().filter(pk__in=[f['venta'] for f in datos['aplicaciones']]).order_by('pk'))
    return autorizar(actor, True), cliente, ventas


def comprobar_saldos(cliente, ventas, datos, comprobante=None):
    por_venta = {v.pk: v for v in ventas}
    filas = []
    for entrada in datos['aplicaciones']:
        venta = por_venta.get(entrada['venta'])
        if venta is None or venta.cliente_id != cliente.pk or venta.estado != 'emitida':
            raise ValidationError({'aplicaciones': 'Elige solo ventas emitidas del mismo supermercado.'})
        saldo = representar_saldo(venta)
        if entrada['version_saldo'] != saldo['version_saldo']:
            raise ConflictoCobro()
        if entrada['importe'] > Decimal(saldo['saldo']):
            raise ValidationError({'aplicaciones': f'{venta.codigo}: el importe supera el saldo pendiente.'})
        filas.append({'venta': venta.pk, 'codigo': venta.codigo, 'importe': str(entrada['importe']),
            'saldo_anterior': saldo['saldo'], 'saldo_posterior': format(Decimal(saldo['saldo']) - entrada['importe'], '.2f')})
    contenido = {k: v for k, v in datos.items() if k not in ('clave_operacion', 'revision')}
    metadatos = metadatos_comprobante(comprobante)
    if metadatos:
        contenido['comprobante'] = metadatos
    return {'cliente_nombre': cliente.razon_social, 'cliente_nit': cliente.nit, 'importe': str(datos['importe']),
        'fecha_cobro': datos['fecha_cobro'], 'medio': datos['medio'], 'comprobante': metadatos,
        'aplicaciones': filas, 'revision': huella([contenido, cliente.razon_social, cliente.nit, filas])}


@transaction.atomic
def revisar_cobro(actor, entrada, archivo=None):
    datos = validar_entrada(entrada)
    comprobante = preparar_comprobante(archivo)
    _, cliente, ventas = bloquear(actor, datos)
    comprobar_medio_comprobante(datos, comprobante)
    return comprobar_saldos(cliente, ventas, datos, comprobante)


@transaction.atomic
def registrar_cobro(actor, entrada, archivo=None):
    datos = validar_entrada(entrada)
    comprobante = preparar_comprobante(archivo)
    actor, cliente, ventas = bloquear(actor, datos)
    metadatos = metadatos_comprobante(comprobante)
    firma = huella([datos, metadatos]) if metadatos else huella(datos)
    anterior = Cobro.objects.filter(clave_operacion=datos['clave_operacion']).first()
    if anterior:
        if (anterior.huella, anterior.registrado_por_id) != (firma, actor.pk):
            raise ConflictoCobro('La clave de operación pertenece a otro cobro o responsable.')
        return anterior
    comprobar_medio_comprobante(datos, comprobante)
    revision = comprobar_saldos(cliente, ventas, datos, comprobante)
    if not datos['revision'] or datos['revision'] != revision['revision']:
        raise ConflictoCobro('Revisa los importes asignados antes de registrar el cobro.')
    actor = autorizar(actor, True)
    cobro = Cobro.objects.create(clave_operacion=datos['clave_operacion'], huella=firma, cliente=cliente,
        cliente_nombre=cliente.razon_social, cliente_nit=cliente.nit, fecha_cobro=datos['fecha_cobro'], importe=datos['importe'],
        medio=datos['medio'], referencia=datos['referencia'].strip(), registrado_por=actor, registrado_por_nombre=nombre_responsable(actor))
    if comprobante:
        ComprobanteCobro.objects.create(cobro=cobro, **comprobante)
    AplicacionCobro.objects.bulk_create([AplicacionCobro(cobro=cobro, venta_id=fila['venta'], venta_codigo=fila['codigo'],
        importe=Decimal(fila['importe']), saldo_anterior=Decimal(fila['saldo_anterior']), saldo_posterior=Decimal(fila['saldo_posterior'])) for fila in revision['aplicaciones']])
    registrar_actividad('cobros', 'registrar', actor=actor, objeto=cobro, objeto_nombre=cobro.codigo,
        cambios={'cliente': cliente.pk, 'importe': str(cobro.importe), 'ventas': [f['venta'] for f in revision['aplicaciones']],
            'comprobante_sha256': metadatos['sha256'] if metadatos else None},
        descripcion='Registrar ingreso recibido y aplicado a ventas')
    return cobro
