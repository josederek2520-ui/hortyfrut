from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import RolViewSet, RolesDisponiblesView, PermisosView

router = DefaultRouter()
router.register('roles', RolViewSet, basename='roles')
urlpatterns = [path('roles/opciones/', RolesDisponiblesView.as_view()), path('permisos/', PermisosView.as_view()), *router.urls]
