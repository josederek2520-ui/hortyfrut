from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from catalogos.serializers import EstadoCatalogoSerializer
from .models import Producto, PresentacionProducto
from .views import PaginacionProductos
from .permisos import PermisosPresentacion
from .serializadores_presentaciones import SerializadorPresentacion, SerializadorEscrituraPresentacion, SerializadorFiltrosPresentacion
from .servicios_presentaciones import guardar_presentacion, cambiar_estado_presentacion


class VistaPresentaciones(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    modulo_auditoria = 'presentaciones'
    permission_classes = [PermisosPresentacion]
    pagination_class = PaginacionProductos
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def obtener_producto(self):
        if not hasattr(self, '_producto'):
            self._producto = get_object_or_404(Producto, pk=self.kwargs['producto_pk'])
        return self._producto

    def get_queryset(self):
        consulta = PresentacionProducto.objects.filter(producto=self.obtener_producto())
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = SerializadorFiltrosPresentacion(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        if filtros.get('uso'):
            usos = [filtros['uso'], 'ambos'] if filtros['uso'] != 'ambos' else ['ambos']
            consulta = consulta.filter(uso__in=usos)
        if self.action != 'resumen' and 'activo' in filtros:
            consulta = consulta.filter(activo=filtros['activo'])
        return consulta.order_by(filtros['orden'], 'pk')

    def get_serializer_class(self):
        return SerializadorEscrituraPresentacion if self.action in ('create', 'partial_update') else SerializadorPresentacion

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'producto_id': self.obtener_producto().pk}

    def create(self, request, producto_pk=None):
        formulario = self.get_serializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        registro = guardar_presentacion(request.user, self.obtener_producto().pk, formulario.validated_data)
        return Response(SerializadorPresentacion(registro).data, status=201)

    def partial_update(self, request, producto_pk=None, pk=None):
        instancia = self.get_object()
        formulario = self.get_serializer(instancia, data=request.data, partial=True)
        formulario.is_valid(raise_exception=True)
        registro = guardar_presentacion(request.user, self.obtener_producto().pk, formulario.validated_data, instancia)
        return Response(SerializadorPresentacion(registro).data)

    @action(detail=True, methods=['post'])
    def estado(self, request, producto_pk=None, pk=None):
        instancia = self.get_object()
        formulario = EstadoCatalogoSerializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        if set(request.data) - set(formulario.fields):
            raise ValidationError({'detail': 'La solicitud incluye campos no permitidos.'})
        registro = cambiar_estado_presentacion(request.user, self.obtener_producto().pk, instancia, **formulario.validated_data)
        return Response(SerializadorPresentacion(registro).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request, producto_pk=None):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)), inactivos=Count('pk', filter=Q(activo=False))))
