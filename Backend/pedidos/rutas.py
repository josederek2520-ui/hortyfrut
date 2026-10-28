from rest_framework.routers import DefaultRouter
from .vistas import VistaPedidos

router = DefaultRouter()
router.register('pedidos', VistaPedidos, basename='pedidos')
urlpatterns = router.urls
