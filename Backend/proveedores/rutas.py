from rest_framework.routers import DefaultRouter
from .vistas import VistaProveedores

router = DefaultRouter()
router.register('proveedores', VistaProveedores, basename='proveedores')
urlpatterns = router.urls
