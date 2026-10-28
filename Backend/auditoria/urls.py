from rest_framework.routers import DefaultRouter
from .views import RegistroActividadViewSet

router = DefaultRouter()
router.register('actividad', RegistroActividadViewSet, basename='actividad')
urlpatterns = router.urls
