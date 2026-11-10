import hashlib
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from auditoria.servicios import registrar_actividad
from config.paginacion import PaginacionDiez
from .archivos import ErrorRespaldo, ruta_respaldo
from .models import Respaldo
from .permisos import PermisosRespaldos
from .servicios import solicitar_respaldo


class ArchivoNoDisponible(APIException):
    status_code = 410
    default_detail = 'El archivo no está disponible o no supera la comprobación de integridad. Crea un respaldo nuevo.'


class SerializadorRespaldo(serializers.ModelSerializer):
    nombre = serializers.CharField(source='nombre_publico', read_only=True)
    estado = serializers.SerializerMethodField()
    error = serializers.SerializerMethodField()

    class Meta:
        model = Respaldo
        fields = ['id', 'nombre', 'estado', 'creado_en', 'finalizado_en', 'responsable_nombre', 'tamano_bytes', 'error']

    def get_estado(self, objeto):
        return 'fallido' if objeto.estado == 'preparando' and objeto.vence_en < timezone.now() else objeto.estado

    def get_error(self, objeto):
        return 'El proceso se interrumpió. Crea un respaldo nuevo.' if objeto.estado == 'preparando' and objeto.vence_en < timezone.now() else objeto.error


class PaginacionRespaldos(PaginacionDiez):
    page_query_param = 'pagina'


class VistaRespaldos(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, PermisosRespaldos]
    pagination_class = PaginacionRespaldos
    serializer_class = SerializadorRespaldo
    queryset = Respaldo.objects.all()
    http_method_names = ['get', 'post', 'head', 'options']

    def list(self, request):
        consulta = self.get_queryset()
        respuesta = self.get_paginated_response(self.get_serializer(self.paginate_queryset(consulta), many=True).data)
        respuesta.data['en_preparacion'] = consulta.filter(estado='preparando', vence_en__gt=timezone.now()).exists()
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def retrieve(self, request, pk=None):
        respuesta = Response(self.get_serializer(self.get_object()).data)
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def create(self, request):
        respaldo = solicitar_respaldo(request.user, request.data)
        return Response(self.get_serializer(respaldo).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['get'])
    def descargar(self, request, pk=None):
        respaldo = self.get_object()
        if respaldo.estado != 'completado':
            raise ArchivoNoDisponible()
        entrada = None
        try:
            archivo = ruta_respaldo(respaldo)
            entrada = archivo.open('rb')
            if archivo.stat().st_size != respaldo.tamano_bytes or hashlib.file_digest(entrada, 'sha256').hexdigest() != respaldo.sha256:
                raise ArchivoNoDisponible()
            entrada.seek(0)
            with transaction.atomic():
                registrar_actividad('respaldos', 'descargar_respaldo', actor=request.user, objeto=respaldo, objeto_nombre=respaldo.nombre_publico)
            respuesta = FileResponse(entrada, as_attachment=True, filename=respaldo.nombre_publico, content_type='application/zip')
            respuesta['Cache-Control'] = 'private, no-store'
            respuesta['X-Content-Type-Options'] = 'nosniff'
            return respuesta
        except (OSError, ErrorRespaldo):
            if entrada:
                entrada.close()
            raise ArchivoNoDisponible() from None
        except Exception:
            if entrada:
                entrada.close()
            raise
