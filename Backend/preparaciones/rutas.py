from rest_framework.routers import DefaultRouter
from .vistas import VistaPreparaciones

enrutador = DefaultRouter()
enrutador.register('preparaciones', VistaPreparaciones, basename='preparaciones')
urlpatterns = enrutador.urls
