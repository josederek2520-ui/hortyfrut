from rest_framework.routers import DefaultRouter
from .vistas import VistaEntregas

router = DefaultRouter()
router.register('entregas', VistaEntregas, basename='entregas')
urlpatterns = router.urls
