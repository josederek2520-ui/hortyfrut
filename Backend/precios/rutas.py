from rest_framework.routers import DefaultRouter
from .vistas import VistaPrecios

enrutador = DefaultRouter()
enrutador.register('precios-acordados', VistaPrecios, basename='precios-acordados')
urlpatterns = enrutador.urls
