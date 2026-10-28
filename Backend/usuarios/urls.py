from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .auth import csrf, LoginView, LogoutView, SessionView, PerfilView, PerfilPasswordView
from .views import UsuarioViewSet

router = DefaultRouter()
router.register('usuarios', UsuarioViewSet, basename='usuario')
urlpatterns = [
    path('auth/csrf/', csrf),
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/me/', SessionView.as_view()),
    path('auth/profile/', PerfilView.as_view()),
    path('auth/profile/password/', PerfilPasswordView.as_view()),
    path('', include(router.urls)),
]
