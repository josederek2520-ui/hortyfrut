from rest_framework.routers import DefaultRouter
from .vistas import VistaDespachos
from .vistas_chofer import VistaMisDespachos
from django.urls import path
from usuarios.acceso_chofer_web import AccesoChoferWeb
from .vistas_chofer_web import VistaViajesChoferWeb

router = DefaultRouter()
router.register('despachos', VistaDespachos, basename='despachos')
router.register('movil/mis-despachos', VistaMisDespachos, basename='mis-despachos')
router.register('chofer/mis-viajes', VistaViajesChoferWeb, basename='viajes-chofer-web')
urlpatterns = [path('chofer/acceso/', AccesoChoferWeb.as_view(), name='acceso-chofer-web'), *router.urls]
