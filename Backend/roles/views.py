from django.contrib.auth.models import Group
from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from config.paginacion import PaginacionDiez
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from .catalogo import MODULOS, permisos_publicos, permiso_data
from .serializers import RolSerializer, RolListaSerializer, RolDetalleSerializer, RolEscrituraSerializer, EliminarRolSerializer
from .services import guardar_rol, eliminar_rol


class PermisosRoles(BasePermission):
    actions = {'list': 'view', 'retrieve': 'view', 'resumen': 'view', 'create': 'add', 'partial_update': 'change', 'destroy': 'delete'}

    def has_permission(self, request, view):
        permission = self.actions.get(view.action)
        return bool(request.user.is_authenticated and permission and request.user.has_perm(f'auth.{permission}_group'))


class PuedeConsultarPermisos(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and any(request.user.has_perm(f'auth.{action}_group') for action in ('view', 'add', 'change'))


class PuedeConsultarRoles(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and any(request.user.has_perm(p) for p in (
            'usuarios.view_usuario', 'usuarios.add_usuario', 'usuarios.asignar_roles',
        ))


class RolesDisponiblesView(ListAPIView):
    permission_classes = [PuedeConsultarRoles]
    serializer_class = RolSerializer
    pagination_class = None
    queryset = Group.objects.prefetch_related('permissions__content_type').order_by('name')


class PermisosView(APIView):
    permission_classes = [PuedeConsultarPermisos]

    def get(self, request):
        permissions = list(permisos_publicos())
        return Response([{'key': key, 'label': module['label'], 'permissions': [
            permiso_data(p, request.user) for code in module['permissions'] for p in permissions
            if p.content_type.app_label == module['app'] and p.codename == code
        ]} for key, module in MODULOS.items()])


class PaginacionRoles(PaginacionDiez):
    pass


class RolViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosRoles]
    pagination_class = PaginacionRoles
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Group.objects.annotate(
            usuarios_count=Count('user', distinct=True),
            permisos_count=Count('permissions', distinct=True),
            asignado_actor=Count('user', filter=Q(user__pk=self.request.user.pk), distinct=True),
            superusuarios_count=Count('user', filter=Q(user__is_superuser=True), distinct=True),
        ).prefetch_related('permissions__content_type')
        if self.action == 'list':
            search = self.request.query_params.get('search', '').strip()[:150]
            if search:
                qs = qs.filter(name__icontains=search)
            membership = self.request.query_params.get('membership')
            if membership == 'assigned':
                qs = qs.filter(usuarios_count__gt=0)
            elif membership == 'unassigned':
                qs = qs.filter(usuarios_count=0)
        ordering = self.request.query_params.get('ordering', 'name')
        if ordering not in ('name', '-name', 'usuarios_count', '-usuarios_count', 'permisos_count', '-permisos_count'):
            ordering = 'name'
        return qs.order_by(ordering, 'pk')

    def get_serializer_class(self):
        return RolDetalleSerializer if self.action == 'retrieve' else RolListaSerializer

    def respuesta_detalle(self, rol):
        instance = self.get_queryset().get(pk=rol.pk)
        return Response(RolDetalleSerializer(instance, context=self.get_serializer_context()).data)

    def create(self, request):
        serializer = RolEscrituraSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self.respuesta_detalle(guardar_rol(request.user, serializer.validated_data))
        response.status_code = 201
        return response

    def partial_update(self, request, pk=None):
        instance = self.get_object()
        serializer = RolEscrituraSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return self.respuesta_detalle(guardar_rol(request.user, serializer.validated_data, instance))

    def destroy(self, request, pk=None):
        serializer = EliminarRolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        eliminar_rol(request.user, self.get_object(), serializer.validated_data['version'])
        return Response(status=204)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        qs = Group.objects.annotate(members=Count('user'))
        return Response(qs.aggregate(total=Count('pk'), asignados=Count('pk', filter=Q(members__gt=0)), sin_usuarios=Count('pk', filter=Q(members=0))))
