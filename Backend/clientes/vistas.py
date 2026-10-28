from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from catalogos.serializers import EstadoCatalogoSerializer
from .models import Cliente, Sucursal
from .permisos import PermisosDirectorio
from .serializadores import SerializadorCliente, SerializadorSucursal, SerializadorEscrituraCliente, SerializadorEscrituraSucursal, SerializadorFiltros
from .servicios import guardar_registro, cambiar_estado


class PaginacionDirectorio(PaginacionDiez):
    page_query_param = 'pagina'


class VistaDirectorio(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosDirectorio]
    pagination_class = PaginacionDirectorio
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def obtener_cliente(self):
        if self.modelo is not Sucursal:
            return None
        if not hasattr(self, '_cliente'):
            self._cliente = get_object_or_404(Cliente, pk=self.kwargs['cliente_pk'])
        return self._cliente

    def get_queryset(self):
        consulta = self.modelo.objects.all()
        if self.modelo is Cliente:
            consulta = consulta.annotate(cantidad_sucursales=Count('sucursales'))
        else:
            consulta = consulta.filter(cliente=self.obtener_cliente())
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = SerializadorFiltros(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            criterio = Q()
            for campo in self.campos_busqueda:
                criterio |= Q(**{f'{campo}__icontains': filtros['buscar']})
            consulta = consulta.filter(criterio)
        if self.action != 'resumen' and 'activo' in filtros:
            consulta = consulta.filter(activo=filtros['activo'])
        orden = filtros['orden'].replace('nombre', 'razon_social') if self.modelo is Cliente else filtros['orden']
        return consulta.order_by(orden, 'pk')

    def get_serializer_class(self):
        return self.serializador_escritura if self.action in ('create', 'partial_update') else self.serializador_lectura

    def get_serializer_context(self):
        cliente = self.obtener_cliente()
        return {**super().get_serializer_context(), **({'cliente_id': cliente.pk} if cliente else {})}

    def serializar(self, registro):
        if self.modelo is Cliente:
            registro.cantidad_sucursales = registro.sucursales.count()
        return self.serializador_lectura(registro).data

    def create(self, request, **kwargs):
        formulario = self.get_serializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        cliente = self.obtener_cliente()
        registro = guardar_registro(self.modelo, request.user, formulario.validated_data, cliente_id=cliente.pk if cliente else None)
        return Response(self.serializar(registro), status=201)

    def partial_update(self, request, **kwargs):
        instancia = self.get_object()
        formulario = self.get_serializer(instancia, data=request.data, partial=True)
        formulario.is_valid(raise_exception=True)
        cliente = self.obtener_cliente()
        registro = guardar_registro(self.modelo, request.user, formulario.validated_data, instancia, cliente_id=cliente.pk if cliente else None)
        return Response(self.serializar(registro))

    @action(detail=True, methods=['post'])
    def estado(self, request, **kwargs):
        instancia = self.get_object()
        formulario = EstadoCatalogoSerializer(data=request.data)
        formulario.is_valid(raise_exception=True)
        if set(request.data) - set(formulario.fields):
            raise ValidationError({'detail': 'La solicitud incluye campos no permitidos.'})
        cliente = self.obtener_cliente()
        registro = cambiar_estado(self.modelo, request.user, instancia, **formulario.validated_data, cliente_id=cliente.pk if cliente else None)
        return Response(self.serializar(registro))

    @action(detail=False, methods=['get'])
    def resumen(self, request, **kwargs):
        return Response(self.get_queryset().aggregate(total=Count('pk'), activos=Count('pk', filter=Q(activo=True)), inactivos=Count('pk', filter=Q(activo=False))))


class VistaClientes(VistaDirectorio):
    modelo = Cliente
    modulo_auditoria = 'clientes'
    serializador_lectura = SerializadorCliente
    serializador_escritura = SerializadorEscrituraCliente
    campos_busqueda = ('razon_social', 'nit', 'telefono', 'email')

    @action(detail=False, methods=['get'])
    def encargados(self, request):
        from django.contrib.auth import get_user_model
        from rest_framework.exceptions import PermissionDenied
        if not request.user.has_perm('clientes.asignar_encargado') or not request.user.has_perm('clientes.view_cliente'):
            raise PermissionDenied()
        consulta = get_user_model().objects.filter(is_active=True)
        for codigo in ('view_pedido', 'add_pedido'):
            consulta = consulta.filter(Q(is_superuser=True) | Q(user_permissions__content_type__app_label='pedidos', user_permissions__codename=codigo) | Q(groups__permissions__content_type__app_label='pedidos', groups__permissions__codename=codigo))
        buscar = request.query_params.get('buscar', '')[:150]
        consulta = consulta.filter(Q(first_name__icontains=buscar) | Q(last_name__icontains=buscar)).distinct().order_by('first_name', 'last_name', 'pk')
        return self.get_paginated_response([{'id': usuario.pk, 'nombre': usuario.get_full_name() or f'Cuenta #{usuario.pk}', 'activo': True} for usuario in self.paginate_queryset(consulta)])


class VistaSucursales(VistaDirectorio):
    modelo = Sucursal
    modulo_auditoria = 'sucursales'
    serializador_lectura = SerializadorSucursal
    serializador_escritura = SerializadorEscrituraSucursal
    campos_busqueda = ('nombre', 'direccion', 'telefono', 'referencia')
