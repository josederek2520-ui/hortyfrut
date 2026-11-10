"""Solo se usa en el proceso loopback del túnel. Sin rutas administrativas."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from usuarios.auth import csrf, LogoutView, PerfilView, PerfilPasswordView
from usuarios.acceso_publico_chofer import AccesoPublicoChofer, SesionPublicaChofer
from usuarios.acceso_chofer_web import AccesoChoferWeb
from despachos.vistas_chofer_web import VistaViajesChoferWeb
from entregas.vistas import VistaEntregasPublica

router = DefaultRouter()
router.register('chofer/mis-viajes', VistaViajesChoferWeb, basename='viajes-chofer-https')
router.register('entregas', VistaEntregasPublica, basename='entregas-publicas')
urlpatterns = [
    path('api/v1/', include('chat.rutas')),
    path('api/v1/auth/csrf/', csrf),
    path('api/v1/auth/login/', AccesoPublicoChofer.as_view()),
    path('api/v1/auth/me/', SesionPublicaChofer.as_view()),
    path('api/v1/auth/logout/', LogoutView.as_view()),
    path('api/v1/auth/profile/', PerfilView.as_view()),
    path('api/v1/auth/profile/password/', PerfilPasswordView.as_view()),
    path('api/v1/chofer/acceso/', AccesoChoferWeb.as_view()),
    path('api/v1/', include(router.urls)),
]
