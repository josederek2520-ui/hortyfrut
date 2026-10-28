from rest_framework.routers import DefaultRouter
from .vistas import VistaCompras

router = DefaultRouter()
router.register('compras', VistaCompras, basename='compras')
urlpatterns = router.urls
