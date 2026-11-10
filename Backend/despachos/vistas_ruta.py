from rest_framework.decorators import action
from rest_framework.response import Response
from .rutas_carretera import aprobar_ruta, calcular_ruta, consultar_ruta


class GestionRutaDespacho:
    @action(detail=True, methods=['get'])
    def ruta(self, request, pk=None):
        despacho = self.get_object()
        return Response(consultar_ruta(request.user, despacho.pk))

    @action(detail=True, methods=['post'], url_path='calcular-ruta')
    def calcular_ruta(self, request, pk=None):
        despacho = calcular_ruta(request.user, self.get_object().pk, request.data)
        return Response(consultar_ruta(request.user, despacho.pk))

    @action(detail=True, methods=['post'], url_path='aprobar-ruta')
    def aprobar_ruta(self, request, pk=None):
        despacho = aprobar_ruta(request.user, self.get_object().pk, request.data)
        return Response(consultar_ruta(request.user, despacho.pk))


class ConsultaRutaChofer:
    @action(detail=True, methods=['post'], url_path='consultar-alternativas')
    def consultar_alternativas(self, request, pk=None):
        from .alternativas_ruta import consultar_alternativas_ruta
        return Response(consultar_alternativas_ruta(request.user, self.get_object().pk, request.data))

    @action(detail=True, methods=['post'], url_path='elegir-alternativa')
    def elegir_alternativa(self, request, pk=None):
        from .alternativas_ruta import elegir_alternativa_ruta
        despacho = elegir_alternativa_ruta(request.user, self.get_object().pk, request.data)
        return Response(consultar_ruta(request.user, despacho.pk, como_chofer=True))

    @action(detail=True, methods=['post'], url_path='optimizar-ruta')
    def optimizar_ruta(self, request, pk=None):
        from .optimizacion.servicios import solicitar_optimizacion
        despacho = solicitar_optimizacion(request.user, self.get_object().pk, request.data)
        return Response(consultar_ruta(request.user, despacho.pk, como_chofer=True), status=202)

    @action(detail=True, methods=['post'], url_path='cancelar-optimizacion')
    def cancelar_optimizacion(self, request, pk=None):
        from .optimizacion.servicios import cancelar_optimizacion
        despacho = cancelar_optimizacion(request.user, self.get_object().pk, request.data)
        return Response(consultar_ruta(request.user, despacho.pk, como_chofer=True))

    @action(detail=True, methods=['get'])
    def ruta(self, request, pk=None):
        despacho = self.get_object()
        return Response(consultar_ruta(request.user, despacho.pk, como_chofer=True))

    @action(detail=True, methods=['post'], url_path='calcular-ruta')
    def calcular_ruta(self, request, pk=None):
        despacho = calcular_ruta(request.user, self.get_object().pk, request.data, como_chofer=True)
        return Response(consultar_ruta(request.user, despacho.pk, como_chofer=True))

    @action(detail=True, methods=['post'], url_path='aprobar-ruta')
    def aprobar_ruta(self, request, pk=None):
        despacho = aprobar_ruta(request.user, self.get_object().pk, request.data, como_chofer=True)
        return Response(consultar_ruta(request.user, despacho.pk, como_chofer=True))
