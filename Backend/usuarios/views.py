from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from config.paginacion import PaginacionDiez
from rest_framework.response import Response
from .models import Usuario
from .permissions import PermisosUsuarios
from .serializers import UsuarioListaSerializer, UsuarioDetalleSerializer, UsuarioEscrituraSerializer, EstadoSerializer, PasswordSerializer
from .services import guardar_usuario, cambiar_estado, cambiar_password


class PaginacionUsuarios(PaginacionDiez):
    pass


class UsuarioViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosUsuarios]
    pagination_class = PaginacionUsuarios
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = Usuario.objects.prefetch_related('groups__permissions__content_type')
        search = self.request.query_params.get('search', '').strip()[:150]
        if search:
            qs = qs.filter(Q(first_name__icontains=search) |
                           Q(last_name__icontains=search) | Q(email__icontains=search) | Q(cedula_identidad__icontains=search))
        active = self.request.query_params.get('is_active')
        if active in ('true', 'false'):
            qs = qs.filter(is_active=active == 'true')
        role = self.request.query_params.get('role', '')
        if role.isdigit():
            qs = qs.filter(groups__pk=int(role))
        ordering = self.request.query_params.get('ordering', '-date_joined')
        if ordering not in ('cedula_identidad', '-cedula_identidad', 'first_name', '-first_name', 'date_joined', '-date_joined'):
            ordering = '-date_joined'
        return qs.order_by(ordering, '-pk').distinct()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return UsuarioEscrituraSerializer
        return UsuarioDetalleSerializer if self.action == 'retrieve' else UsuarioListaSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = guardar_usuario(request.user, serializer.validated_data)
        return Response(UsuarioDetalleSerializer(usuario, context=self.get_serializer_context()).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        usuario = self.get_object()
        serializer = self.get_serializer(usuario, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        usuario = guardar_usuario(request.user, serializer.validated_data, usuario)
        return Response(UsuarioDetalleSerializer(usuario, context=self.get_serializer_context()).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        # Overall counts stay stable while the table is filtered.
        return Response(Usuario.objects.aggregate(total=Count('pk'), activos=Count('pk', filter=Q(is_active=True)), inactivos=Count('pk', filter=Q(is_active=False))))

    @action(detail=True, methods=['post'])
    def estado(self, request, pk=None):
        serializer = EstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = cambiar_estado(request.user, self.get_object(), serializer.validated_data['is_active'])
        return Response(UsuarioDetalleSerializer(usuario, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'])
    def password(self, request, pk=None):
        usuario = self.get_object()
        serializer = PasswordSerializer(data=request.data, context={'usuario': usuario, 'request': request})
        serializer.is_valid(raise_exception=True)
        cambiar_password(request, usuario, serializer.validated_data['password'])
        return Response({'detail': 'Contraseña actualizada correctamente.'})
