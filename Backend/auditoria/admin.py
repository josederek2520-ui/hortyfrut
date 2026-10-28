from django.contrib import admin
from .models import RegistroActividad


@admin.register(RegistroActividad)
class RegistroActividadAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'responsable', 'modulo', 'accion', 'resultado')
    list_filter = ('modulo', 'resultado', 'origen')
    search_fields = ('responsable', 'descripcion', 'objeto_id')
    readonly_fields = tuple(campo.name for campo in RegistroActividad._meta.fields)

    def has_view_permission(self, request, obj=None):
        return request.user.has_perm('auditoria.ver_registroactividad')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
