"""Presentación de sesión acotada al chofer en el proceso público de pruebas."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from chat.servicios import exigir_usuario
from .auth import LoginView, session_data
from precios.permisos import permisos_precios, cliente_inicial_precios
from pagos.permisos import permisos_propios, cliente_inicial_pagos
from django.utils import timezone


def datos_sesion_chofer(solicitud):
    def sin_permisos_administrativos(valor):
        if isinstance(valor, dict):
            return {clave: sin_permisos_administrativos(contenido) for clave, contenido in valor.items()}
        return False

    entregas = {clave: solicitud.user.has_perm('entregas.' + codigo) for clave, codigo in {
        'ver': 'view_entrega', 'crear': 'add_entrega', 'editar': 'change_entrega', 'enviar': 'enviar_entrega'}.items()}
    entregas.update(confirmar=False, ver_todas=False, gestionar_todas=False)
    solicitud.user._precios_solo_propios = True
    precios = permisos_precios(solicitud.user)
    pagos = permisos_propios(solicitud.user)
    return {**{clave: contenido if clave in ('user', 'permisos_chofer')
            else sin_permisos_administrativos(contenido)
            for clave, contenido in session_data(solicitud).items()}, 'permisos_entregas': entregas,
            'permisos_precios': precios, 'precios_supermercado': bool(precios['ver']),
            'cliente_precios': cliente_inicial_precios(solicitud.user) if precios['ver'] else None,
            'fecha_precios': timezone.localdate().isoformat() if precios['ver'] else None,
            'permisos_mis_pagos': pagos, 'cliente_pagos': cliente_inicial_pagos(solicitud.user) if pagos['ver'] else None,
            'acceso_publico': True}


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
