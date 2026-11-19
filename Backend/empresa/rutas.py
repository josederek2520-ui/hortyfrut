from rest_framework.routers import DefaultRouter
from .vistas import VistaEmpresa

router = DefaultRouter()
router.register('datos-empresa', VistaEmpresa, basename='datos-empresa')
urlpatterns = router.urls
