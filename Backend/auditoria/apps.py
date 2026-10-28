from django.apps import AppConfig


class AuditoriaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'auditoria'
    verbose_name = 'Registro de actividad'

    def ready(self):
        from . import registros_admin  # noqa: F401
