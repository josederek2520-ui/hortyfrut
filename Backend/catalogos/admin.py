from django.contrib import admin
from .models import UnidadMedida, CategoriaProducto


class CatalogoAdmin(admin.ModelAdmin):
    list_per_page = 10
    list_display = ('nombre', 'activo', 'creado_en')
    search_fields = ('nombre',)
    list_filter = ('activo',)
    exclude = ('actualizado_en',)
    readonly_fields = ('nombre', 'activo', 'creado_en')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(UnidadMedida)
class UnidadMedidaAdmin(CatalogoAdmin):
    list_display = ('nombre', 'abreviatura', 'activo', 'creado_en')
    readonly_fields = ('nombre', 'abreviatura', 'activo', 'creado_en')


admin.site.register(CategoriaProducto, CatalogoAdmin)
