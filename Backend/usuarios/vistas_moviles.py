from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers, mixins, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle

from compras.serializadores import SerializadorEstricto
from config.paginacion import PaginacionDiez
from despachos.permisos import exigir_permiso_chofer
from .autenticacion_movil import AutenticacionMovil, crear_sesion_movil, revocar_sesion_movil, exigir_conexion_movil
from .models import SesionMovil


class RespuestaMovilSinCache:
    modulo_auditoria = 'autenticacion'

    def finalize_response(self, request, response, *args, **kwargs):
        respuesta = super().finalize_response(request, response, *args, **kwargs)
        respuesta['Cache-Control'] = 'no-store'
        return respuesta


class LimiteAccesoMovil(AnonRateThrottle):
    scope = 'login'


class SerializadorAccesoMovil(SerializadorEstricto):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=128, write_only=True)
    identificador_dispositivo = serializers.UUIDField()
    nombre_dispositivo = serializers.CharField(max_length=80)


class VistaAccesoMovil(RespuestaMovilSinCache, APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LimiteAccesoMovil]

    def post(self, request):
        exigir_conexion_movil(request)
        formulario = SerializadorAccesoMovil(data=request.data)
        formulario.is_valid(raise_exception=True)
        datos = formulario.validated_data
        usuario = authenticate(request=request, email=datos['email'].strip().lower(), password=datos['password'])
        if usuario is None:
            raise serializers.ValidationError('El correo o la contraseña no son correctos.')
        sesion, credencial = crear_sesion_movil(usuario, datos['identificador_dispositivo'], datos['nombre_dispositivo'])
        return Response({'credencial': credencial, 'tipo': 'Bearer', 'sesion_id': sesion.pk, 'vence_en': sesion.vence_en,
                         'usuario': {'id': usuario.pk, 'nombre': sesion.usuario.get_full_name() or f'Cuenta #{usuario.pk}'}})


class VistaSesionMovil(RespuestaMovilSinCache, APIView):
    authentication_classes = [AutenticacionMovil]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exigir_permiso_chofer(request.user)
        return Response({'usuario': {'id': request.user.pk, 'nombre': request.user.get_full_name() or f'Cuenta #{request.user.pk}'},
                         'vence_en': request.auth.vence_en,
                         'puede_operar': request.user.has_perm('despachos.operar_despachos_propios')})

    def post(self, request):
        revocar_sesion_movil(request.user, request.auth.pk)
        return Response({'detail': 'Sesión móvil cerrada.'})


class SerializadorSesionMovil(serializers.ModelSerializer):
    class Meta:
        model = SesionMovil
        fields = ('id', 'nombre_dispositivo', 'creada_en', 'vence_en')
        read_only_fields = fields


class VistaDispositivosMoviles(RespuestaMovilSinCache, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    authentication_classes = [AutenticacionMovil]
    permission_classes = [IsAuthenticated]
    serializer_class = SerializadorSesionMovil
    pagination_class = PaginacionDiez
    http_method_names = ['get', 'delete', 'head', 'options']
    lookup_value_regex = '[0-9a-fA-F-]{36}'

    def get_queryset(self):
        return SesionMovil.objects.filter(usuario=self.request.user, revocada_en__isnull=True, vence_en__gt=timezone.now(),
                                         huella_autenticacion=self.request.user.get_session_auth_hash())

    def perform_destroy(self, instance):
        revocar_sesion_movil(self.request.user, instance.pk)
