from django.db.models import Q, Sum, OuterRef, Subquery, BigIntegerField, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from almacenes.models import Almacen
from clientes.models import Sucursal
from .models import MovimientoCajilla
from .consultas import cajillas_con_saldos, saldos_almacenes, saldos_sucursales, sumar_cantidad
from .permisos import PermisosCajillas
from .serializadores import SerializadorCajilla, SerializadorMovimientoCajilla, SerializadorFiltrosCajillas
from .servicios import crear_cajilla, registrar_movimiento


class PaginacionCajillas(PaginacionDiez):
    page_query_param = 'pagina'


class VistaCajillas(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosCajillas]
    pagination_class = PaginacionCajillas
    serializer_class = SerializadorCajilla
    modulo_auditoria = 'cajillas'
    http_method_names = ['get', 'post', 'head', 'options']

    def filtros(self):
        formulario = SerializadorFiltrosCajillas(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def get_queryset(self):
        consulta = cajillas_con_saldos()
        if self.action in ('list', 'resumen') and self.filtros().get('buscar'):
            consulta = consulta.filter(color__icontains=self.filtros()['buscar'])
        return consulta.order_by('color', 'pk')

    def create(self, request):
        cajilla, creada = crear_cajilla(request.user, request.data)
        return Response(SerializadorCajilla(cajillas_con_saldos().get(pk=cajilla.pk)).data, status=201 if creada else 200)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        consulta = self.get_queryset()
        datos = consulta.aggregate(**{f'suma_{campo}': Coalesce(Sum(campo), Value(0), output_field=BigIntegerField()) for campo in ('total', 'en_almacen', 'en_sucursales')})
        return Response({**{campo.removeprefix('suma_'): valor for campo, valor in datos.items()}, 'colores': consulta.count()})

    @action(detail=True, methods=['post'], url_path='movimientos')
    def registrar(self, request, pk=None):
        movimiento, creado = registrar_movimiento(request.user, self.get_object().pk, request.data)
        return Response({'movimiento': SerializadorMovimientoCajilla(movimiento).data,
            'cajilla': SerializadorCajilla(cajillas_con_saldos().get(pk=movimiento.cajilla_id)).data}, status=201 if creado else 200)

    @action(detail=False, methods=['get'])
    def movimientos(self, request):
        filtros = self.filtros()
        consulta = MovimientoCajilla.objects.all()
        for campo in ('cajilla', 'almacen', 'sucursal', 'tipo'):
            if campo in filtros:
                consulta = consulta.filter(**{campo: filtros[campo]})
        if filtros.get('fecha'):
            consulta = consulta.filter(creado_en__date=filtros['fecha'])
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(color__icontains=buscar) | Q(almacen_nombre__icontains=buscar) | Q(sucursal_nombre__icontains=buscar) | Q(cliente_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('CAJ-')
            if codigo.isdigit():
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        return self.get_paginated_response(SerializadorMovimientoCajilla(self.paginate_queryset(consulta), many=True).data)

    @action(detail=True, methods=['get'], url_path='saldos-almacenes')
    def saldos_almacenes(self, request, pk=None):
        cajilla = self.get_object()
        consulta = saldos_almacenes(cajilla.pk)
        filtros = self.filtros()
        if filtros.get('buscar'):
            consulta = consulta.filter(almacen__nombre__icontains=filtros['buscar'])
        if filtros.get('operacion') == 'salida':
            consulta = consulta.filter(almacen__activo=True)
        return self.get_paginated_response([{'id': fila['almacen_id'], 'nombre': fila['almacen__nombre'],
            'activo': fila['almacen__activo'], 'cantidad': fila['cantidad']} for fila in self.paginate_queryset(consulta)])

    @action(detail=True, methods=['get'], url_path='saldos-sucursales')
    def saldos_sucursales(self, request, pk=None):
        cajilla = self.get_object()
        return self.get_paginated_response([{'id': fila['sucursal_id'], 'nombre': fila['sucursal__nombre'],
            'cliente': fila['sucursal__cliente__razon_social'], 'activo': fila['sucursal__activo'] and fila['sucursal__cliente__activo'],
            'cantidad': fila['cantidad']} for fila in self.paginate_queryset(saldos_sucursales(cajilla.pk))])

    @action(detail=False, methods=['get'])
    def almacenes(self, request):
        filtros = self.filtros()
        consulta = Almacen.objects.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre} for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    @action(detail=False, methods=['get'])
    def sucursales(self, request):
        filtros = self.filtros()
        consulta = Sucursal.objects.select_related('cliente')
        if filtros.get('operacion') == 'devolucion':
            if not filtros.get('cajilla'):
                raise ValidationError({'cajilla': 'Selecciona el color de las cajillas.'})
            get_object_or_404(cajillas_con_saldos(), pk=filtros['cajilla'])
            pendientes = MovimientoCajilla.objects.filter(cajilla_id=filtros['cajilla'], sucursal_id=OuterRef('pk')).values('sucursal_id').annotate(
                saldo=sumar_cantidad(Q(tipo='salida')) - sumar_cantidad(Q(tipo='devolucion'))).values('saldo')
            consulta = consulta.annotate(pendiente=Coalesce(Subquery(pendientes, output_field=BigIntegerField()), Value(0), output_field=BigIntegerField())).filter(pendiente__gt=0)
        else:
            consulta = consulta.filter(activo=True, cliente__activo=True)
        if filtros.get('sucursal'):
            consulta = consulta.filter(pk=filtros['sucursal'])
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(nombre__icontains=filtros['buscar']) | Q(cliente__razon_social__icontains=filtros['buscar']))
        return self.get_paginated_response([{'id': obj.pk, 'nombre': f'{obj.cliente.razon_social} · {obj.nombre}',
            'activo': obj.activo and obj.cliente.activo, 'pendiente': getattr(obj, 'pendiente', None)}
            for obj in self.paginate_queryset(consulta.order_by('cliente__razon_social', 'nombre', 'pk'))])
