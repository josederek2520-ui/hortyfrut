from rest_framework.routers import DefaultRouter
from .views import ProductoViewSet
from .vistas_presentaciones import VistaPresentaciones

router = DefaultRouter()
router.register('productos', ProductoViewSet, basename='productos')
router.register(r'productos/(?P<producto_pk>[0-9]+)/presentaciones', VistaPresentaciones, basename='presentaciones-producto')
urlpatterns = router.urls
