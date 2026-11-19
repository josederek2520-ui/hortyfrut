from rest_framework.routers import DefaultRouter
from .vistas import VistaCobros

router = DefaultRouter()
router.register('cobros', VistaCobros, basename='cobros')
urlpatterns = router.urls
