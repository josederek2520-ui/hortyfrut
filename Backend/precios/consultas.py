import hashlib
import json
from django.db.models import Exists, OuterRef
from rest_framework.exceptions import ValidationError
from .models import AcuerdoPrecio, DetallePrecio


def huella(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, default=str, separators=(',', ':')).encode()).hexdigest()


def version_acuerdo(acuerdo):
    return huella([acuerdo.pk, acuerdo.actualizado_en.isoformat(), acuerdo.estado])


def acuerdos_con_vigencia():
    return AcuerdoPrecio.objects.annotate(tiene_sucesor=Exists(AcuerdoPrecio.objects.filter(anterior_id=OuterRef('pk'), estado='aceptado')))


def acuerdos_actuales():
    return acuerdos_con_vigencia().filter(estado='aceptado', tiene_sucesor=False)


def precio_para_entrega(entrega, producto_id):
    """Consulta exacta para la futura liquidación; nunca confirma ni mueve inventario.

    La vigencia usa la fecha requerida del pedido, independiente de la recepción.
    El documento comercial deberá persistir la línea y precio usados al emitirse.
    """
    if entrega.estado != 'confirmada':
        raise ValidationError('Confirma la entrega antes de consultar su precio comercial.')
    if not entrega.lineas.filter(producto_id=producto_id).exists():
        raise ValidationError('El producto no pertenece a la entrega.')
    acuerdos = acuerdos_actuales().filter(cliente_id=entrega.pedido.sucursal.cliente_id)
    especificos = acuerdos.filter(alcance='entregas', entregas__entrega=entrega)
    periodos = acuerdos.filter(alcance='periodo', desde__lte=entrega.pedido.fecha_requerida, hasta__gte=entrega.pedido.fecha_requerida)
    for consulta in [especificos, periodos]:
        lineas = list(DetallePrecio.objects.filter(acuerdo__in=consulta, producto_id=producto_id).select_related('acuerdo')[:2])
        if len(lineas) > 1:
            raise ValidationError('Existen precios comerciales ambiguos; revisa los acuerdos antes de liquidar.')
        if lineas:
            return lineas[0]
    return None
