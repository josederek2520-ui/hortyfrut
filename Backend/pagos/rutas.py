from rest_framework.routers import DefaultRouter
from .vistas import VistaMisPagos, VistaPagosOficina

router = DefaultRouter()
router.register('mis-pagos', VistaMisPagos, basename='mis-pagos')
router.register('pagos-por-verificar', VistaPagosOficina, basename='pagos-por-verificar')
urlpatterns = router.urls
