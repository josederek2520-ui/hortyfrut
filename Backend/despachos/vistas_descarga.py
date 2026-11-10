from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import action

from config.paginacion import PaginacionDiez
from .descargas import agrupar_pedidos_descarga, contenido_carga_descarga


class PaginacionPedidosDescarga(PaginacionDiez):
    page_query_param = 'pagina'


class SerializadorConsultaDescarga(serializers.Serializer):
    parada = serializers.IntegerField(min_value=1)


class ConsultaPedidosDescarga:
    def cargas_de_parada(self, request, despacho=None):
        formulario = SerializadorConsultaDescarga(data={'parada': request.query_params.get('parada')})
        formulario.is_valid(raise_exception=True)
        despacho = despacho if despacho is not None else self.get_object()
        parada = get_object_or_404(despacho.paradas, pk=formulario.validated_data['parada'])
        return [fila for fila in despacho.cargas.all() if fila.parada_id == parada.pk]

    @action(detail=True, methods=['get'], pagination_class=PaginacionPedidosDescarga)
    def pedidos(self, request, pk=None):
        filas = agrupar_pedidos_descarga(self.cargas_de_parada(request))
        return self.get_paginated_response(self.paginate_queryset(filas))

    @action(detail=True, methods=['get'], url_path='productos-pedido', pagination_class=PaginacionPedidosDescarga)
    def productos_pedido(self, request, pk=None):
        despacho = self.get_object()
        cargas = self.cargas_de_parada(request, despacho)
        try:
            pedido_id = serializers.IntegerField(min_value=1).run_validation(request.query_params.get('pedido'))
        except serializers.ValidationError as error:
            raise serializers.ValidationError({'pedido': error.detail}) from error
        filas = [fila for fila in cargas if fila.contenido['pedido'] == pedido_id]
        if not filas:
            from rest_framework.exceptions import NotFound
            raise NotFound('El pedido no tiene carga en esta parada del despacho.')
        pagina = [contenido_carga_descarga(fila) for fila in self.paginate_queryset(filas)]
        return self.get_paginated_response(self.completar_productos_descarga(despacho, pagina))

    def completar_productos_descarga(self, despacho, filas):
        return filas
