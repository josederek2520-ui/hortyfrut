from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from config.paginacion import PaginacionDiez
from rest_framework.response import Response
from .models import UnidadMedida, CategoriaProducto
from .permisos import PermisosCatalogo
from .serializers import (UnidadMedidaSerializer, CategoriaProductoSerializer, CatalogoEscrituraSerializer,
                          UnidadMedidaEscrituraSerializer, EstadoCatalogoSerializer, FiltrosCatalogoSerializer)
from .servicios import guardar_catalogo, cambiar_estado_catalogo


class PaginacionCatalogo(PaginacionDiez):
    page_query_param = 'pagina'


class CatalogoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosCatalogo]
    pagination_class = PaginacionCatalogo
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = self.modelo.objects.all()
        if self.action not in ('list', 'resumen'):
            return consulta.order_by('nombre', 'pk')
        # Los parámetros de URL no representan casillas HTML: un filtro ausente
        # debe conservarse ausente, en lugar de interpretarse como activo=False.
        formulario = FiltrosCatalogoSerializer(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            criterio = Q(nombre__icontains=filtros['buscar'])
            if self.modelo is UnidadMedida:
                criterio |= Q(abreviatura__icontains=filtros['buscar'])
            consulta = consulta.filter(criterio)
        if self.action != 'resumen' and 'activo' in filtros:
            consulta = consulta.filter(activo=filtros['activo'])
        return consulta.order_by(filtros['orden'], 'pk')

    def get_serializer_class(self):
        return self.serializador_escritura if self.action in ('create', 'partial_update') else self.serializador_lectura

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'modelo': self.modelo}

    def create(self, request):
        formulario = self.get_serializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        registro = guardar_catalogo(self.modelo, request.user, formulario.validated_data)
        return Response(self.serializador_lectura(registro).data, status=201)

    def partial_update(self, request, pk=None):
        instancia = self.get_object()
        formulario = self.get_serializer(instancia, data=request.data, partial=True)
        formulario.is_valid(raise_exception=True)
        registro = guardar_catalogo(self.modelo, request.user, formulario.validated_data, instancia)
        return Response(self.serializador_lectura(registro).data)

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        formulario = EstadoCatalogoSerializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        if set(request.data) - set(formulario.fields):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'La solicitud incluye campos no permitidos.'})
        registro = cambiar_estado_catalogo(self.modelo, request.user, self.get_object(), **formulario.validated_data)
        return Response(self.serializador_lectura(registro).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)), inactivos=Count('pk', filter=Q(activo=False))))


class UnidadMedidaViewSet(CatalogoViewSet):
    modelo = UnidadMedida
    serializador_lectura = UnidadMedidaSerializer
    serializador_escritura = UnidadMedidaEscrituraSerializer


class CategoriaProductoViewSet(CatalogoViewSet):
    modelo = CategoriaProducto
    serializador_lectura = CategoriaProductoSerializer
    serializador_escritura = CatalogoEscrituraSerializer
