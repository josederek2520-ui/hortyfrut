from django.contrib import admin
from .models import Pedido


@admin.register(Pedido)
class AdministracionPedido(admin.ModelAdmin):
    list_display = ('codigo', 'sucursal_nombre', 'fecha_requerida', 'estado')
    list_per_page = 10
    readonly_fields = tuple(campo.name for campo in Pedido._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
