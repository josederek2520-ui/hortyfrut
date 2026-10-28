from datetime import datetime, time, timedelta
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from config.paginacion import PaginacionDiez
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from .models import RegistroActividad
from .serializers import RegistroActividadListaSerializer, RegistroActividadDetalleSerializer, FiltrosActividadSerializer


class PuedeVerActividad(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_perm('auditoria.ver_registroactividad')


class PaginacionActividad(PaginacionDiez):
    pass


class RegistroActividadViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PuedeVerActividad]
    pagination_class = PaginacionActividad
    http_method_names = ['get', 'head', 'options']

    def get_serializer_class(self):
        return RegistroActividadDetalleSerializer if self.action == 'retrieve' else RegistroActividadListaSerializer

    def get_queryset(self):
        consulta = RegistroActividad.objects.all()
        if self.action == 'retrieve':
            return consulta
        formulario = FiltrosActividadSerializer(data=self.request.query_params)
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        for campo in ('modulo', 'accion', 'actor'):
            if filtros.get(campo):
                consulta = consulta.filter(**{campo: filtros[campo]})
        limite = getattr(self, 'corte', filtros.get('corte'))
        if limite is not None:
            consulta = consulta.filter(pk__lte=limite)
        if self.action != 'resumen' and not getattr(self, 'ignorar_resultado', False) and filtros.get('resultado'):
            consulta = consulta.filter(resultado=filtros['resultado'])
        if filtros.get('responsable'):
            consulta = consulta.filter(responsable__icontains=filtros['responsable'])
        if filtros.get('buscar'):
            valor = filtros['buscar']
            consulta = consulta.filter(Q(responsable__icontains=valor) | Q(descripcion__icontains=valor) | Q(objeto_nombre__icontains=valor) | Q(objeto_id=valor))
        for campo in ('desde', 'hasta'):
            if filtros.get(campo):
                fecha = filtros[campo] + (timedelta(days=1) if campo == 'hasta' else timedelta())
                limite = timezone.make_aware(datetime.combine(fecha, time.min))
                consulta = consulta.filter(**{'fecha__gte' if campo == 'desde' else 'fecha__lt': limite})
        return consulta

    def list(self, request, *args, **kwargs):
        filtros = FiltrosActividadSerializer(data=request.query_params)
        filtros.is_valid(raise_exception=True)
        self.corte = filtros.validated_data.get('corte')
        if self.corte is None:
            self.corte = RegistroActividad.objects.aggregate(ultimo=Max('pk'))['ultimo'] or 0
        respuesta = super().list(request, *args, **kwargs)
        self.ignorar_resultado = True
        respuesta.data['corte'] = self.corte
        respuesta.data['resumen'] = self.contar(self.get_queryset())
        return respuesta

    @staticmethod
    def contar(consulta):
        return consulta.aggregate(total=Count('pk'), exitosos=Count('pk', filter=Q(resultado='exito')),
                                 rechazados=Count('pk', filter=Q(resultado='rechazado')), errores=Count('pk', filter=Q(resultado='error')))

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.contar(self.get_queryset()))

    @action(detail=False, methods=['get'])
    def opciones(self, request):
        consulta = RegistroActividad.objects.order_by()
        return Response({'modulos': list(consulta.values_list('modulo', flat=True).distinct().order_by('modulo')),
                         'acciones': list(consulta.values_list('accion', flat=True).distinct().order_by('accion'))})
