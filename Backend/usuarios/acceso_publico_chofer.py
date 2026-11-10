"""Presentación de sesión acotada al chofer en el proceso público de pruebas."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from chat.servicios import exigir_usuario
from .auth import LoginView, session_data


def datos_sesion_chofer(solicitud):
    def sin_permisos_administrativos(valor):
        if isinstance(valor, dict):
            return {clave: sin_permisos_administrativos(contenido) for clave, contenido in valor.items()}
        return False

    entregas = {clave: solicitud.user.has_perm('entregas.' + codigo) for clave, codigo in {
        'ver': 'view_entrega', 'crear': 'add_entrega', 'editar': 'change_entrega', 'enviar': 'enviar_entrega'}.items()}
    entregas.update(confirmar=False, ver_todas=False, gestionar_todas=False)
    return {**{clave: contenido if clave in ('user', 'permisos_chofer')
            else sin_permisos_administrativos(contenido)
            for clave, contenido in session_data(solicitud).items()}, 'permisos_entregas': entregas, 'acceso_publico': True}


class AccesoPublicoChofer(LoginView):
    def autorizar_usuario(self, usuario):
        exigir_usuario(usuario)

    def datos_sesion(self, request):
        return datos_sesion_chofer(request)


class SesionPublicaChofer(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exigir_usuario(request.user)
        respuesta = Response(datos_sesion_chofer(request))
        respuesta['Cache-Control'] = 'no-store'
        return respuesta
