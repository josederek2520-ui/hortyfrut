from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from catalogos.models import CategoriaProducto
from config.paginacion import PaginacionDiez
from .models import Proveedor
from .permisos import PermisosProveedores
from .serializadores import SerializadorProveedor, SerializadorFiltrosProveedores, SerializadorOpcionesCategorias
from .servicios import guardar_proveedor, cambiar_estado_proveedor


class PaginacionProveedores(PaginacionDiez):
    page_query_param = 'pagina'


class VistaProveedores(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosProveedores]
    pagination_class = PaginacionProveedores
    serializer_class = SerializadorProveedor
    modulo_auditoria = 'proveedores'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = Proveedor.objects.select_related('categoria')
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = SerializadorFiltrosProveedores(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            consulta = consulta.filter(Q(nombre__icontains=buscar) | Q(telefono__icontains=buscar) |
                                       Q(direccion__icontains=buscar) | Q(categoria__nombre__icontains=buscar))
        if 'categoria' in filtros:
            consulta = consulta.filter(categoria_id=filtros['categoria'])
        if self.action != 'resumen' and 'activo' in filtros:
            consulta = consulta.filter(activo=filtros['activo'])
        return consulta.order_by(filtros['orden'], 'pk')

    def create(self, request):
        proveedor = guardar_proveedor(request.user, request.data)
        return Response(SerializadorProveedor(proveedor).data, status=201)

    def partial_update(self, request, pk=None):
        proveedor = guardar_proveedor(request.user, request.data, self.get_object())
        return Response(SerializadorProveedor(proveedor).data)

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        proveedor = cambiar_estado_proveedor(request.user, self.get_object(), request.data)
        return Response(SerializadorProveedor(proveedor).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)),
                                                     inactivos=Count('pk', filter=Q(activo=False))))

    @action(detail=False, methods=['get'])
    def categorias(self, request):
        formulario = SerializadorOpcionesCategorias(data=request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        consulta = CategoriaProducto.objects.all()
        if not filtros['incluir_inactivos']:
            consulta = consulta.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        pagina = self.paginate_queryset(consulta.order_by('nombre', 'pk'))
        return self.get_paginated_response([{'id': categoria.pk, 'nombre': categoria.nombre, 'activo': categoria.activo} for categoria in pagina])
