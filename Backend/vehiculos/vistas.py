from django.db.models import Count, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from .models import Vehiculo
from .permisos import PermisosVehiculos
from .serializadores import SerializadorVehiculo
from .servicios import guardar_vehiculo, cambiar_estado_vehiculo


class PaginacionVehiculos(PaginacionDiez):
    page_query_param = 'pagina'


class VistaVehiculos(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = SerializadorVehiculo
    permission_classes = [PermisosVehiculos]
    pagination_class = PaginacionVehiculos
    modulo_auditoria = 'vehiculos'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = Vehiculo.objects.all()
        if self.action in ('list', 'resumen'):
            buscar = self.request.query_params.get('buscar', '')[:150]
            consulta = consulta.filter(Q(placa__icontains=buscar) | Q(marca__icontains=buscar) | Q(tipo__icontains=buscar))
            if self.action == 'list' and self.request.query_params.get('activo') in ('true', 'false'):
                consulta = consulta.filter(activo=self.request.query_params['activo'] == 'true')
        return consulta

    def create(self, request):
        return Response(SerializadorVehiculo(guardar_vehiculo(request.user, request.data)).data, status=201)

    def partial_update(self, request, pk=None):
        return Response(SerializadorVehiculo(guardar_vehiculo(request.user, request.data, self.get_object())).data)

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        return Response(SerializadorVehiculo(cambiar_estado_vehiculo(request.user, self.get_object(), request.data)).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)), inactivos=Count('pk', filter=Q(activo=False))))

    @action(detail=True, methods=['get'])
    def imagen(self, request, pk=None):
        vehiculo = get_object_or_404(self.get_queryset().exclude(imagen=''), pk=pk)
        respuesta = FileResponse(vehiculo.imagen.open('rb'), content_type='image/webp')
        respuesta['Cache-Control'] = 'private, no-store'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta
