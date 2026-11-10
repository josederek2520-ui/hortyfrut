"""Un registro por cliente y fecha, sin fusionar pedidos ni preparaciones."""
from django.db.models import Case, CharField, Count, Exists, F, IntegerField, OuterRef, Subquery, Value, When
from django.db.models.functions import Coalesce
from pedidos.models import Pedido
from .models import Preparacion, AsignacionPreparacion
from .consultas import detalles_con_avance


def contar_grupo(consulta, agrupacion, campo='pk'):
    return Coalesce(Subquery(consulta.order_by().values(agrupacion).annotate(
        total=Count(campo, distinct=True)).values('total')[:1], output_field=IntegerField()), Value(0))


def jornadas_preparacion(filtros):
    pedidos = Pedido.objects.filter(sucursal__cliente_id=OuterRef('cliente_jornada'),
        fecha_requerida=OuterRef('fecha_jornada')).exclude(estado='cancelado')
    detalles = detalles_con_avance().filter(pedido__sucursal__cliente_id=OuterRef('cliente_jornada'),
        pedido__fecha_requerida=OuterRef('fecha_jornada'))
    preparaciones = Preparacion.objects.filter(cliente_id=OuterRef('cliente_jornada'), fecha_pedidos=OuterRef('fecha_jornada'))
    preparadas = AsignacionPreparacion.objects.filter(preparacion__estado='confirmada', cantidad__gt=0,
        pedido__sucursal__cliente_id=OuterRef('cliente_jornada'), pedido__fecha_requerida=OuterRef('fecha_jornada')).exclude(pedido__estado='cancelado')
    campos = ('cliente_jornada', 'fecha_jornada', 'nombre_grupo', 'cliente_activo', 'pedidos', 'sucursales',
              'productos', 'borradores', 'confirmadas', 'canceladas', 'borrador_id', 'situacion')

    def agrupar(consulta, cliente, fecha):
        consulta = consulta.order_by().annotate(cliente_jornada=F(f'{cliente}_id'), fecha_jornada=F(fecha),
            nombre_grupo=F(f'{cliente}__razon_social'), cliente_activo=F(f'{cliente}__activo'))
        consulta = consulta.annotate(
            pedidos=contar_grupo(pedidos, 'sucursal__cliente_id'),
            sucursales=contar_grupo(pedidos, 'sucursal__cliente_id', 'sucursal_id'),
            productos=contar_grupo(detalles, 'pedido__sucursal__cliente_id', 'producto_id'),
            borradores=contar_grupo(preparaciones.filter(estado='borrador'), 'cliente_id'),
            confirmadas=contar_grupo(preparaciones.filter(estado='confirmada'), 'cliente_id'),
            canceladas=contar_grupo(preparaciones.filter(estado='cancelada'), 'cliente_id'),
            borrador_id=Subquery(preparaciones.filter(estado='borrador').order_by('-actualizado_en', '-pk').values('pk')[:1]),
            hay_pendiente=Exists(detalles.filter(pendiente__gt=0)), hay_preparado=Exists(preparadas),
        ).annotate(situacion=Case(
            When(pedidos=0, then=Value('sin_pedidos')),
            When(hay_pendiente=False, productos__gt=0, then=Value('preparado')),
            When(hay_preparado=True, then=Value('parcial')),
            default=Value('pendiente'), output_field=CharField()))
        if filtros.get('cliente'):
            consulta = consulta.filter(cliente_jornada=filtros['cliente'])
        if filtros.get('fecha_pedidos'):
            consulta = consulta.filter(fecha_jornada=filtros['fecha_pedidos'])
        if filtros.get('estado'):
            consulta = consulta.filter(situacion=filtros['estado'])
        if filtros.get('buscar'):
            consulta = consulta.filter(**{f'{cliente}__razon_social__icontains': filtros['buscar']})
        return consulta.values(*campos)

    return agrupar(Pedido.objects.all(), 'sucursal__cliente', 'fecha_requerida').union(
        agrupar(Preparacion.objects.all(), 'cliente', 'fecha_pedidos')).order_by('-fecha_jornada', 'nombre_grupo', 'cliente_jornada')
