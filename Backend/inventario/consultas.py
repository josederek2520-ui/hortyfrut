from decimal import Decimal
from django.db.models import Case, When, F, Sum, DecimalField, Value, Q
from django.db.models.functions import Coalesce
from catalogos.models import UnidadMedida
from .models import Lote, UnidadInventarioProducto


def unidades_habilitadas(producto):
    return UnidadMedida.objects.filter(activo=True).filter(Q(pk=producto.unidad_medida_id) | Q(productos_inventario__producto=producto, productos_inventario__activo=True)).distinct().order_by('nombre', 'pk')


def es_kilogramo(unidad):
    return unidad.abreviatura.strip().casefold() == 'kg'


def criterio_busqueda_lotes(buscar):
    normalizado = buscar.strip().upper()
    criterio = Q(producto_nombre__icontains=buscar.strip()) | Q(codigo_lote__icontains=normalizado)
    anterior = normalizado.removeprefix('LOT-')
    if anterior.isascii() and anterior.isdecimal():
        identificador = int(anterior)
        if identificador <= 9223372036854775807:
            criterio |= Q(pk=identificador)
    return criterio


def lotes_con_saldo(almacen=None):
    consulta = Lote.objects.select_related('producto__categoria', 'unidad', 'almacen_origen')
    if almacen:
        consulta = consulta.filter(movimientos__movimiento__almacen_id=almacen)
    importe = Case(When(movimientos__movimiento__estado='registrado', movimientos__movimiento__naturaleza='entrada', then=F('movimientos__cantidad')),
                   When(movimientos__movimiento__estado='registrado', movimientos__movimiento__naturaleza='salida', then=-F('movimientos__cantidad')),
                   default=Value(Decimal('0')), output_field=DecimalField(max_digits=24, decimal_places=3))
    return consulta.annotate(saldo=Coalesce(Sum(importe), Value(Decimal('0')), output_field=DecimalField(max_digits=24, decimal_places=3)))
