from django.db.models import Q
from rest_framework import mixins, viewsets, serializers
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from config.paginacion import PaginacionDiez
from usuarios.autenticacion_movil import AutenticacionMovil
from usuarios.vistas_moviles import RespuestaMovilSinCache
from .consultas import despachos_con_relaciones
from .permisos import exigir_permiso_chofer
from .serializadores import SerializadorDespacho, SerializadorDetalleDespacho
from .servicios import ejecutar_accion
from .vistas_descarga import ConsultaPedidosDescarga
from .vistas_ruta import ConsultaRutaChofer
from .vistas_seguimiento import SeguimientoChofer


class PermisosChofer(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        exigir_permiso_chofer(request.user, operar=view.action not in ('list', 'retrieve', 'pedidos', 'productos_pedido', 'imagen_producto', 'ruta', 'seguimiento', 'posiciones_seguimiento'))
        return True


class VistaMisDespachos(SeguimientoChofer, ConsultaRutaChofer, ConsultaPedidosDescarga, RespuestaMovilSinCache, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    modulo_auditoria = 'despachos'
    authentication_classes = [AutenticacionMovil]
    permission_classes = [PermisosChofer]
    serializer_class = SerializadorDespacho
    pagination_class = PaginacionDiez
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        consulta = despachos_con_relaciones().filter(chofer=self.request.user).filter(Q(enviado_en__isnull=False) | Q(estado__in=['en_ruta', 'finalizado']))
        estado = self.request.query_params.get('estado')
        if estado:
            if estado not in ('borrador', 'en_ruta', 'finalizado', 'cancelado'):
                raise serializers.ValidationError({'estado': 'Selecciona un estado válido.'})
            consulta = consulta.filter(estado=estado)
        return consulta

    def retrieve(self, request, pk=None):
        return Response(SerializadorDetalleDespacho(self.get_object()).data)

    def operar(self, request, accion):
        despacho = ejecutar_accion(request.user, self.get_object(), accion, request.data, como_chofer=True)
        return Response(SerializadorDetalleDespacho(despachos_con_relaciones().get(pk=despacho.pk)).data)

    @action(detail=True, methods=['post'])
    def iniciar(self, request, pk=None):
        return self.operar(request, 'iniciar')

    @action(detail=True, methods=['post'])
    def llegar(self, request, pk=None):
        return self.operar(request, 'llegar')

    @action(detail=True, methods=['post'])
    def descargar(self, request, pk=None):
        return self.operar(request, 'descargar')

    @action(detail=True, methods=['post'], url_path='descargar-pedido')
    def descargar_pedido(self, request, pk=None):
        return self.operar(request, 'descargar_pedido')

    @action(detail=True, methods=['post'])
    def finalizar(self, request, pk=None):
        return self.operar(request, 'finalizar')
