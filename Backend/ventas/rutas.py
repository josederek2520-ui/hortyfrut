from rest_framework.routers import DefaultRouter
from .vistas import VistaVentas

enrutador = DefaultRouter()
enrutador.register('ventas', VistaVentas, basename='ventas')
urlpatterns = enrutador.urls
