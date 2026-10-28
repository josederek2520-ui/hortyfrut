from rest_framework.routers import DefaultRouter
from .vistas import VistaCajillas

enrutador = DefaultRouter()
enrutador.register('cajillas', VistaCajillas, basename='cajillas')
urlpatterns = enrutador.urls
