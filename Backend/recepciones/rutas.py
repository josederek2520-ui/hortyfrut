from rest_framework.routers import DefaultRouter
from .vistas import VistaRecepciones

enrutador = DefaultRouter()
enrutador.register('recepciones', VistaRecepciones, basename='recepciones')
urlpatterns = enrutador.urls
