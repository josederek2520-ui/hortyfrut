from django.db import IntegrityError
from rest_framework import viewsets
from rest_framework.response import Response
from .models import DatosEmpresa
from .permisos import PermisosEmpresa
from .servicios import representar_empresa, guardar_empresa, ConflictoEmpresa


class VistaEmpresa(viewsets.ViewSet):
    permission_classes = [PermisosEmpresa]
    modulo_auditoria = 'empresa'
    http_method_names = ['get', 'post', 'head', 'options']

    def finalize_response(self, request, response, *args, **kwargs):
        respuesta = super().finalize_response(request, response, *args, **kwargs)
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def list(self, request):
        respuesta = Response(representar_empresa(DatosEmpresa.objects.get(pk=1)))
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def create(self, request):
        try:
            empresa = guardar_empresa(request.user, request.data)
        except IntegrityError as error:
            raise ConflictoEmpresa() from error
        return Response(representar_empresa(empresa))
