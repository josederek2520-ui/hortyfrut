from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Case, IntegerField, Q, Value, When
from .serializadores import SerializadorDespacho
from .supervision import autorizar_acceso_supervision, consultar_supervision


class SupervisionDespacho:
    @action(detail=False, methods=['get'], url_path='viajes-actuales')
    def viajes_actuales(self, request):
        # Filtrar el estado operativo antes de contar y paginar. No depende de la fecha.
        filtros = self.filtros()
        consulta = self.get_queryset().filter(Q(estado='en_ruta') | Q(estado='borrador', enviado_en__isnull=False))
        buscar = filtros['buscar'].strip()
        criterio = Q(vehiculo_placa__icontains=buscar) | Q(chofer_nombre__icontains=buscar) | Q(almacen_nombre__icontains=buscar)
        numero = buscar.upper().removeprefix('DES-')
        if numero.isdigit():
            criterio |= Q(pk=int(numero))
        consulta = consulta.filter(criterio)
        if filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
        consulta = consulta.order_by(Case(When(estado='en_ruta', then=Value(0)), default=Value(1), output_field=IntegerField()), 'fecha_reparto', 'pk')
        respuesta = self.get_paginated_response(SerializadorDespacho(self.paginate_queryset(consulta), many=True).data)
        respuesta['Cache-Control'] = 'no-store'
        return respuesta

    @action(detail=True, methods=['get'])
    def supervision(self, request, pk=None):
        respuesta = Response(consultar_supervision(request.user, self.get_object().pk))
        respuesta['Cache-Control'] = 'no-store'
        return respuesta

    @action(detail=True, methods=['post'], url_path='acceso-supervision')
    def acceso_supervision(self, request, pk=None):
        respuesta = Response(autorizar_acceso_supervision(request, self.get_object().pk))
        respuesta['Cache-Control'] = 'no-store'
        return respuesta
