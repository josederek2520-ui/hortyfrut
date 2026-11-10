from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .auth import csrf, LoginView, LogoutView, SessionView, PerfilView, PerfilPasswordView
from .views import UsuarioViewSet
from .vistas_moviles import VistaAccesoMovil, VistaSesionMovil, VistaDispositivosMoviles

router = DefaultRouter()
router.register('usuarios', UsuarioViewSet, basename='usuario')
router.register('movil/dispositivos', VistaDispositivosMoviles, basename='dispositivos-moviles')
urlpatterns = [
    path('movil/iniciar-sesion/', VistaAccesoMovil.as_view()),
    path('movil/sesion/', VistaSesionMovil.as_view()),
    path('auth/csrf/', csrf),
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/me/', SessionView.as_view()),
    path('auth/profile/', PerfilView.as_view()),
    path('auth/profile/password/', PerfilPasswordView.as_view()),
    path('', include(router.urls)),
]
