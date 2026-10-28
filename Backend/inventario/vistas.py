from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from catalogos.models import UnidadMedida
from productos.models import Producto
from config.paginacion import PaginacionDiez
from almacenes.models import Almacen
from .models import MovimientoInventario, UnidadInventarioProducto
from .consultas import lotes_con_saldo, criterio_busqueda_lotes
from .permisos import PermisosLotes, PermisosMovimientos, PermisosUnidadesProducto
from .serializadores import SerializadorLote, SerializadorMovimiento, SerializadorMovimientoCompleto, SerializadorFiltrosInventario
from .servicios import cambiar_estado_lote, datos_unidad, habilitar_unidad, cambiar_unidad


class PaginacionInventario(PaginacionDiez):
    page_query_param = 'pagina'


class OpcionesAlmacen:
    @action(detail=False, methods=['get'])
    def almacenes(self, request):
        consulta = Almacen.objects.all()
        buscar = request.query_params.get('buscar', '')[:150]
        if buscar:
            consulta = consulta.filter(nombre__icontains=buscar)
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre, 'activo': obj.activo}
            for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])


class VistaLotes(OpcionesAlmacen, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = SerializadorLote
    permission_classes = [PermisosLotes]
    pagination_class = PaginacionInventario
    modulo_auditoria = 'lotes'
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        formulario = SerializadorFiltrosInventario(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        consulta = lotes_con_saldo(filtros.get('almacen')).select_related('detalle_recepcion__recepcion', 'separacion_preparacion__preparacion')
        if self.action not in ('list',):
            return consulta
        if filtros.get('buscar'):
            consulta = consulta.filter(criterio_busqueda_lotes(filtros['buscar']))
        if filtros.get('producto'):
            consulta = consulta.filter(producto_id=filtros['producto'])
        if filtros.get('fecha'):
            consulta = consulta.filter(fecha_ingreso=filtros['fecha'])
        if filtros.get('estado') == 'vencido':
            consulta = consulta.filter(fecha_vencimiento__lt=timezone.localdate())
        elif filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
            if filtros['estado'] == 'disponible':
                consulta = consulta.filter(Q(fecha_vencimiento__isnull=True) | Q(fecha_vencimiento__gte=timezone.localdate()), saldo__gt=0,
                    producto__activo=True, producto__categoria__activo=True, unidad__activo=True, almacen_origen__activo=True, calidad='apto')
        return consulta.order_by('-creado_en', '-pk')

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        lote = cambiar_estado_lote(request.user, self.get_object(), request.data)
        return Response(SerializadorLote(lotes_con_saldo().select_related('detalle_recepcion__recepcion', 'separacion_preparacion__preparacion').get(pk=lote.pk)).data)


class VistaMovimientos(OpcionesAlmacen, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosMovimientos]
    pagination_class = PaginacionInventario
    modulo_auditoria = 'movimientos_inventario'
    http_method_names = ['get', 'head', 'options']

    def get_serializer_class(self):
        return SerializadorMovimiento if self.action == 'list' else SerializadorMovimientoCompleto

    def get_queryset(self):
        consulta = MovimientoInventario.objects.annotate(cantidad_lotes=Count('detalles')).prefetch_related('detalles__lote')
        if self.action != 'list':
            return consulta
        formulario = SerializadorFiltrosInventario(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('almacen'):
            consulta = consulta.filter(almacen_id=filtros['almacen'])
        if filtros.get('fecha'):
            consulta = consulta.filter(fecha=filtros['fecha'])
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(referencia_codigo__icontains=buscar) | Q(almacen_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('MOV-')
            if codigo.isdigit():
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        return consulta.order_by('-creado_en', '-pk')


class VistaUnidadesProducto(viewsets.GenericViewSet):
    permission_classes = [PermisosUnidadesProducto]
    pagination_class = PaginacionInventario
    modulo_auditoria = 'unidades_inventario'
    http_method_names = ['get', 'post', 'head', 'options']

    def list(self, request, producto_pk=None):
        producto = get_object_or_404(Producto, pk=producto_pk)
        consulta = UnidadMedida.objects.filter(Q(pk=producto.unidad_medida_id) | Q(productos_inventario__producto=producto)).distinct().order_by('nombre', 'pk')
        pagina = self.paginate_queryset(consulta)
        configuraciones = {obj.unidad_id: obj for obj in UnidadInventarioProducto.objects.filter(producto=producto, unidad_id__in=[unidad.pk for unidad in pagina])}
        return self.get_paginated_response([datos_unidad(producto, unidad, configuraciones.get(unidad.pk)) for unidad in pagina])

    def create(self, request, producto_pk=None):
        datos, creada = habilitar_unidad(request.user, producto_pk, request.data)
        return Response(datos, status=201 if creada else 200)

    @action(detail=True, methods=['post'])
    def estado(self, request, producto_pk=None, pk=None):
        return Response(cambiar_unidad(request.user, producto_pk, pk, request.data))

    @action(detail=False, methods=['get'])
    def opciones(self, request, producto_pk=None):
        producto = get_object_or_404(Producto, pk=producto_pk)
        consulta = UnidadMedida.objects.filter(activo=True).exclude(pk=producto.unidad_medida_id).exclude(productos_inventario__producto=producto)
        buscar = request.query_params.get('buscar', '')[:150]
        if buscar:
            consulta = consulta.filter(Q(nombre__icontains=buscar) | Q(abreviatura__icontains=buscar))
        return self.get_paginated_response([{'id': unidad.pk, 'nombre': unidad.nombre, 'subtitulo': unidad.abreviatura} for unidad in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])
