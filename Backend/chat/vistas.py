from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from config.paginacion import PaginacionDiez
from .servicios import alcance_conversaciones, abrir_conversacion, enviar_mensaje, obtener_conversacion, registrar_lectura, resumen_buzon
from .serializadores import (SerializadorInicioChat, SerializadorEnvioChat, SerializadorLecturaChat,
    SerializadorFiltrosChat, SerializadorMensaje, mostrar_usuario, mostrar_conversacion)
from .acceso import autorizar_canal


class CuentaChatActiva(BasePermission):
    def has_permission(self, request, view):
        esperado = request.headers.get('X-Usuario-Chat')
        return request.user.is_authenticated and request.user.is_active and (esperado is None or esperado == str(request.user.pk))


class PaginacionChat(PaginacionDiez):
    page_query_param = 'pagina'


class VistaChat(APIView):
    permission_classes = [CuentaChatActiva]
    modulo_auditoria = 'chat'

    def filtros(self, request):
        formulario = SerializadorFiltrosChat(data=request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def finalizar_lista(self, request, consulta, mostrar):
        paginacion = PaginacionChat()
        filas = paginacion.paginate_queryset(consulta, request, view=self)
        return paginacion.get_paginated_response([mostrar(fila) for fila in filas])

    def finalize_response(self, request, response, *args, **kwargs):
        respuesta = super().finalize_response(request, response, *args, **kwargs)
        respuesta['Cache-Control'] = 'no-store'
        return respuesta


class UsuariosChat(VistaChat):
    def get(self, request):
        consulta = get_user_model().objects.filter(is_active=True).exclude(pk=request.user.pk)
        for palabra in self.filtros(request)['buscar'].split():
            consulta = consulta.filter(Q(first_name__icontains=palabra) | Q(last_name__icontains=palabra))
        return self.finalizar_lista(request, consulta.order_by('first_name', 'last_name', 'pk'), mostrar_usuario)


class ConversacionesChat(VistaChat):
    def get(self, request):
        consulta = alcance_conversaciones(request.user).select_related('usuario_menor', 'usuario_mayor', 'ultimo_mensaje')
        for palabra in self.filtros(request)['buscar'].split():
            consulta = consulta.filter(
                Q(usuario_menor=request.user) & (Q(usuario_mayor__first_name__icontains=palabra) | Q(usuario_mayor__last_name__icontains=palabra))
                | Q(usuario_mayor=request.user) & (Q(usuario_menor__first_name__icontains=palabra) | Q(usuario_menor__last_name__icontains=palabra)))
        return self.finalizar_lista(request, consulta.order_by('-actualizada_en', '-pk'), lambda fila: mostrar_conversacion(fila, request.user))

    def post(self, request):
        formulario = SerializadorInicioChat(data=request.data)
        formulario.is_valid(raise_exception=True)
        conversacion, creada = abrir_conversacion(request.user, formulario.validated_data['usuario'])
        return Response(mostrar_conversacion(conversacion, request.user), status=201 if creada else 200)


class MensajesChat(VistaChat):
    def get(self, request, identificador):
        conversacion = obtener_conversacion(request.user, identificador)
        filtros = self.filtros(request)
        corte = filtros.get('corte')
        if corte is None:
            corte = conversacion.ultimo_mensaje_id or 0
        consulta = conversacion.mensajes.filter(pk__lte=corte).order_by('-pk')
        respuesta = self.finalizar_lista(request, consulta, lambda fila: SerializadorMensaje(fila).data)
        respuesta.data['corte'] = corte
        respuesta.data['conversacion'] = mostrar_conversacion(conversacion, request.user)
        return respuesta

    def post(self, request, identificador):
        formulario = SerializadorEnvioChat(data=request.data)
        formulario.is_valid(raise_exception=True)
        mensaje, creado = enviar_mensaje(request.user, identificador, formulario.validated_data)
        return Response(SerializadorMensaje(mensaje).data, status=201 if creado else 200)


class LecturasChat(VistaChat):
    def post(self, request, identificador):
        formulario = SerializadorLecturaChat(data=request.data)
        formulario.is_valid(raise_exception=True)
        return Response(registrar_lectura(request.user, identificador, formulario.validated_data['mensajes']))


class AccesoChat(VistaChat):
    def post(self, request):
        return Response(autorizar_canal(request))


class ResumenChat(VistaChat):
    def get(self, request):
        return Response(resumen_buzon(request.user))
