from rest_framework.routers import DefaultRouter
from .vistas import VistaDevoluciones

router = DefaultRouter()
router.register('devoluciones', VistaDevoluciones, basename='devoluciones')
urlpatterns = router.urls
