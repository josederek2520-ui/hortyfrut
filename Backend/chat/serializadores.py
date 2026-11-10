from django.db.models import Q
from rest_framework import serializers
from compras.serializadores import SerializadorEstricto
from .models import Mensaje


class SerializadorInicioChat(SerializadorEstricto):
    usuario = serializers.IntegerField(min_value=1)


class SerializadorEnvioChat(SerializadorEstricto):
    clave_cliente = serializers.UUIDField()
    texto = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)


class SerializadorLecturaChat(SerializadorEstricto):
    mensajes = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1, max_length=10)

    def validate_mensajes(self, valores):
        if len(valores) != len(set(valores)):
            raise serializers.ValidationError('No repitas identificadores de mensajes.')
        return valores


class SerializadorFiltrosChat(SerializadorEstricto):
    buscar = serializers.CharField(max_length=150, required=False, default='', allow_blank=True)
    pagina = serializers.IntegerField(min_value=1, required=False, default=1)
    corte = serializers.IntegerField(min_value=0, required=False)


class SerializadorMensaje(serializers.ModelSerializer):
    class Meta:
        model = Mensaje
        fields = ('id', 'conversacion', 'autor', 'clave_cliente', 'texto', 'creado_en', 'leido_en')
        read_only_fields = fields


def mostrar_usuario(usuario):
    return {'id': usuario.pk, 'nombre': usuario.get_full_name() or 'Usuario', 'activo': usuario.is_active}


def mostrar_conversacion(conversacion, actor):
    otro = conversacion.usuario_mayor if conversacion.usuario_menor_id == actor.pk else conversacion.usuario_menor
    return {'id': conversacion.pk, 'usuario': mostrar_usuario(otro), 'actualizada_en': conversacion.actualizada_en,
        'ultimo_mensaje': SerializadorMensaje(conversacion.ultimo_mensaje).data if conversacion.ultimo_mensaje_id else None,
        'no_leidos': conversacion.mensajes.filter(leido_en__isnull=True).exclude(autor=actor).count()}
