from rest_framework.routers import DefaultRouter
from .views import UnidadMedidaViewSet, CategoriaProductoViewSet

router = DefaultRouter()
router.register('unidades-medida', UnidadMedidaViewSet, basename='unidades-medida')
router.register('categorias-productos', CategoriaProductoViewSet, basename='categorias-productos')
urlpatterns = router.urls
