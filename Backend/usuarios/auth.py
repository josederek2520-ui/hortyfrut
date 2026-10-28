from django.contrib.auth import login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView, exception_handler
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from auditoria.servicios import registrar_actividad
from catalogos.permisos import permisos_catalogos
from productos.permisos import permisos_productos, permisos_presentaciones
from clientes.permisos import permisos_comerciales
from pedidos.permisos import permisos_pedidos
from proveedores.permisos import permisos_proveedores
from compras.permisos import permisos_compras
from almacenes.permisos import permisos_almacenes
from recepciones.permisos import permisos_recepciones
from inventario.permisos import permisos_inventario
from cajillas.permisos import permisos_cajillas
from preparaciones.permisos import permisos_preparaciones
from .serializers import LoginSerializer, UsuarioListaSerializer, UsuarioDetalleSerializer, PerfilSerializer, PasswordSerializer


@require_GET
@ensure_csrf_cookie
def csrf(request):
    response = JsonResponse({'csrfToken': get_token(request)})
    response['Cache-Control'] = 'no-store'
    return response


def csrf_failure(request, reason=''):
    return JsonResponse({'detail': 'Actualiza la sesión de seguridad e intenta nuevamente.', 'code': 'csrf_failed'}, status=403)


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


def session_data(request):
    user = request.user
    permissions = {
        'view': 'view_usuario', 'create': 'add_usuario', 'edit': 'change_usuario',
        'change_status': 'desactivar_usuario', 'assign_roles': 'asignar_roles',
        'reset_password': 'restablecer_password',
    }
    return {
        'user': UsuarioListaSerializer(user, context={'request': request}).data,
        'capabilities': {key: user.has_perm('usuarios.' + value) for key, value in permissions.items()},
        'role_capabilities': {key: user.has_perm(f'auth.{value}_group') for key, value in {
            'view': 'view', 'create': 'add', 'edit': 'change', 'delete': 'delete',
        }.items()},
        'permisos_actividad': {'ver': user.has_perm('auditoria.ver_registroactividad')},
        'permisos_catalogos': permisos_catalogos(user),
        'permisos_productos': permisos_productos(user),
        'permisos_presentaciones': permisos_presentaciones(user),
        'permisos_clientes': permisos_comerciales(user, 'cliente'),
        'permisos_sucursales': permisos_comerciales(user, 'sucursal'),
        'puede_asignar_encargado': user.has_perm('clientes.asignar_encargado'),
        'permisos_pedidos': permisos_pedidos(user),
        'permisos_proveedores': permisos_proveedores(user),
        'permisos_compras': permisos_compras(user),
        'permisos_almacenes': permisos_almacenes(user),
        'permisos_recepciones': permisos_recepciones(user),
        'permisos_inventario': permisos_inventario(user),
        'permisos_cajillas': permisos_cajillas(user),
        'permisos_preparaciones': permisos_preparaciones(user),
    }


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        login(request, serializer.validated_data['user'])
        request.session.set_expiry(60 * 60 * 24 * 14 if serializer.validated_data['remember'] else 0)
        registrar_actividad('autenticacion', 'iniciar_sesion', actor=request.user, descripcion='Inicio de sesión exitoso')
        return Response({**session_data(request), 'csrfToken': get_token(request)})


class SessionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = Response(session_data(request))
        response['Cache-Control'] = 'no-store'
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        registrar_actividad('autenticacion', 'cerrar_sesion', actor=request.user, descripcion='Cierre de sesión')
        logout(request)
        return Response({'detail': 'Sesión cerrada.'})


class PerfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UsuarioDetalleSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        from .services import guardar_usuario
        serializer = PerfilSerializer(request.user, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = guardar_usuario(request.user, serializer.validated_data, request.user)
        return Response(UsuarioDetalleSerializer(user, context={'request': request}).data)


class PerfilPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .services import cambiar_password
        serializer = PasswordSerializer(data=request.data, context={'usuario': request.user, 'request': request})
        serializer.is_valid(raise_exception=True)
        cambiar_password(request, request.user, serializer.validated_data['password'])
        return Response({'detail': 'Contraseña actualizada correctamente.'})


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        if isinstance(exc, ValidationError):
            response.data = {'detail': 'Revisa los campos indicados.', 'errors': response.data}
        else:
            response.data['code'] = getattr(exc, 'default_code', 'error')
    return response
