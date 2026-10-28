from django.db.models import Count, Q
from django.http import FileResponse, Http404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from catalogos.models import CategoriaProducto, UnidadMedida
from catalogos.serializers import EstadoCatalogoSerializer
from config.paginacion import PaginacionDiez
from .models import Producto
from .permisos import PermisosProducto
from .serializers import ProductoSerializer, ProductoEscrituraSerializer, FiltrosProductoSerializer, OpcionesProductoSerializer
from .servicios import guardar_producto, cambiar_estado_producto


class PaginacionProductos(PaginacionDiez):
    page_query_param = 'pagina'


class ProductoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosProducto]
    pagination_class = PaginacionProductos
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = Producto.objects.select_related('categoria', 'unidad_medida')
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = FiltrosProductoSerializer(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(nombre__icontains=filtros['buscar']) | Q(categoria__nombre__icontains=filtros['buscar']) |
                                       Q(unidad_medida__nombre__icontains=filtros['buscar']) | Q(unidad_medida__abreviatura__icontains=filtros['buscar']))
        for campo in ('categoria', 'unidad_medida'):
            if campo in filtros:
                consulta = consulta.filter(**{f'{campo}_id': filtros[campo]})
        if self.action != 'resumen' and 'activo' in filtros:
            consulta = consulta.filter(activo=filtros['activo'])
        return consulta.order_by(filtros['orden'], 'pk')

    def get_serializer_class(self):
        return ProductoEscrituraSerializer if self.action in ('create', 'partial_update') else ProductoSerializer

    def create(self, request):
        formulario = self.get_serializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        producto = guardar_producto(request.user, formulario.validated_data)
        return Response(ProductoSerializer(producto).data, status=201)

    def partial_update(self, request, pk=None):
        producto = self.get_object()
        formulario = self.get_serializer(producto, data=request.data, partial=True)
        formulario.is_valid(raise_exception=True)
        producto = guardar_producto(request.user, formulario.validated_data, producto)
        return Response(ProductoSerializer(producto).data)

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        formulario = EstadoCatalogoSerializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        if set(request.data) - set(formulario.fields):
            raise ValidationError({'detail': 'La solicitud incluye campos no permitidos.'})
        producto = cambiar_estado_producto(request.user, self.get_object(), **formulario.validated_data)
        return Response(ProductoSerializer(producto).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)), inactivos=Count('pk', filter=Q(activo=False))))

    @action(detail=False, methods=['get'])
    def opciones(self, request):
        formulario = OpcionesProductoSerializer(data=request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        unidad = filtros['tipo'] == 'unidades_medida'
        modelo = UnidadMedida if unidad else CategoriaProducto
        consulta = modelo.objects.all() if filtros['incluir_inactivos'] else modelo.objects.filter(activo=True)
        if filtros.get('buscar'):
            criterio = Q(nombre__icontains=filtros['buscar'])
            if unidad:
                criterio |= Q(abreviatura__icontains=filtros['buscar'])
            consulta = consulta.filter(criterio)
        pagina = self.paginate_queryset(consulta.order_by('nombre', 'pk'))
        campos = ['id', 'nombre', 'activo'] + (['abreviatura'] if unidad else [])
        return self.get_paginated_response([{campo: getattr(registro, campo) for campo in campos} for registro in pagina])

    @action(detail=True, methods=['get'])
    def imagen(self, request, pk=None):
        producto = self.get_object()
        if not producto.imagen:
            raise Http404
        try:
            archivo = producto.imagen.open('rb')
        except FileNotFoundError as error:
            raise Http404 from error
        respuesta = FileResponse(archivo, content_type='image/webp')
        respuesta['Content-Disposition'] = 'inline; filename="producto.webp"'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta
