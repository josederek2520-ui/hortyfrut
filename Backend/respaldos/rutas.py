from rest_framework.routers import DefaultRouter
from .vistas import VistaRespaldos

enrutador = DefaultRouter()
enrutador.register('respaldos', VistaRespaldos, basename='respaldos')
urlpatterns = enrutador.urls
