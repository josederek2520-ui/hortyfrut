from rest_framework.decorators import action
from rest_framework.response import Response
from .seguimiento import consultar_seguimiento, iniciar_seguimiento, detener_seguimiento, recibir_posiciones
from .modelos_seguimiento import PosicionSeguimiento
from .serializadores_seguimiento import SerializadorPosicionGuardada


class SeguimientoChofer:
    @action(detail=True, methods=['get'])
    def seguimiento(self, request, pk=None):
        return Response(consultar_seguimiento(request.user, request.auth, self.get_object().pk))

    @action(detail=True, methods=['post'], url_path='iniciar-seguimiento')
    def iniciar_seguimiento(self, request, pk=None):
        return Response(iniciar_seguimiento(request.user, request.auth, self.get_object().pk, request.data))

    @action(detail=True, methods=['post'], url_path='detener-seguimiento')
    def detener_seguimiento(self, request, pk=None):
        return Response(detener_seguimiento(request.user, request.auth, self.get_object().pk, request.data))

    @action(detail=True, methods=['post'], url_path='enviar-posiciones')
    def enviar_posiciones(self, request, pk=None):
        return Response(recibir_posiciones(request.user, request.auth, self.get_object().pk, request.data))

    @action(detail=True, methods=['get'], url_path='posiciones-seguimiento')
    def posiciones_seguimiento(self, request, pk=None):
        despacho = self.get_object()
        consultar_seguimiento(request.user, request.auth, despacho.pk)
        consulta = PosicionSeguimiento.objects.filter(sesion__despacho=despacho, sesion__usuario=request.user)
        return self.get_paginated_response(SerializadorPosicionGuardada(self.paginate_queryset(consulta), many=True).data)
