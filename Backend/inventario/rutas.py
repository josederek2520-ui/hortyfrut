from rest_framework.routers import DefaultRouter
from .vistas import VistaLotes, VistaMovimientos, VistaUnidadesProducto

router = DefaultRouter()
router.register('inventario/lotes', VistaLotes, basename='lotes')
router.register('inventario/movimientos', VistaMovimientos, basename='movimientos-inventario')
router.register(r'inventario/productos/(?P<producto_pk>[0-9]+)/unidades', VistaUnidadesProducto, basename='unidades-inventario-producto')
urlpatterns = router.urls
