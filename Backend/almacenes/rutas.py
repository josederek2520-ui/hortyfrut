from rest_framework.routers import DefaultRouter
from .vistas import VistaAlmacenes

router = DefaultRouter()
router.register('almacenes', VistaAlmacenes, basename='almacenes')
urlpatterns = router.urls
