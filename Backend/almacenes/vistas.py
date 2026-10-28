from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from .models import Almacen
from .permisos import PermisosAlmacenes
from .serializadores import SerializadorAlmacen, SerializadorFiltrosAlmacenes
from .servicios import guardar_almacen, cambiar_estado_almacen


class PaginacionAlmacenes(PaginacionDiez):
    page_query_param = 'pagina'


class VistaAlmacenes(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = SerializadorAlmacen
    permission_classes = [PermisosAlmacenes]
    pagination_class = PaginacionAlmacenes
    modulo_auditoria = 'almacenes'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = Almacen.objects.all()
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = SerializadorFiltrosAlmacenes(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            consulta = consulta.filter(Q(nombre__icontains=buscar) | Q(direccion__icontains=buscar))
        if self.action != 'resumen' and 'activo' in filtros:
            consulta = consulta.filter(activo=filtros['activo'])
        return consulta.order_by(filtros['orden'], 'pk')

    def create(self, request):
        almacen = guardar_almacen(request.user, request.data)
        return Response(SerializadorAlmacen(almacen).data, status=201)

    def partial_update(self, request, pk=None):
        almacen = guardar_almacen(request.user, request.data, self.get_object())
        return Response(SerializadorAlmacen(almacen).data)

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        almacen = cambiar_estado_almacen(request.user, self.get_object(), request.data)
        return Response(SerializadorAlmacen(almacen).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)), inactivos=Count('pk', filter=Q(activo=False))))
