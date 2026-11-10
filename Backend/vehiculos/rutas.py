from rest_framework.routers import DefaultRouter
from .vistas import VistaVehiculos

router = DefaultRouter()
router.register('vehiculos', VistaVehiculos, basename='vehiculos')
urlpatterns = router.urls
