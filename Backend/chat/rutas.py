from django.urls import path
from .vistas import UsuariosChat, ConversacionesChat, MensajesChat, LecturasChat, AccesoChat, ResumenChat

urlpatterns = [
    path('chat/usuarios/', UsuariosChat.as_view()),
    path('chat/conversaciones/', ConversacionesChat.as_view()),
    path('chat/conversaciones/<int:identificador>/mensajes/', MensajesChat.as_view()),
    path('chat/conversaciones/<int:identificador>/lectura/', LecturasChat.as_view()),
    path('chat/acceso/', AccesoChat.as_view()),
    path('chat/resumen/', ResumenChat.as_view()),
]
