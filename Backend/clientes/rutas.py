from rest_framework.routers import DefaultRouter
from .vistas import VistaClientes, VistaSucursales

router = DefaultRouter()
router.register('clientes', VistaClientes, basename='clientes')
router.register(r'clientes/(?P<cliente_pk>[0-9]+)/sucursales', VistaSucursales, basename='sucursales-cliente')
urlpatterns = router.urls
