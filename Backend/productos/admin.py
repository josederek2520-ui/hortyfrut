from django.contrib import admin
from catalogos.admin import CatalogoAdmin
from .models import Producto, PresentacionProducto


@admin.register(Producto)
class ProductoAdmin(CatalogoAdmin):
    list_display = ('nombre', 'categoria', 'unidad_medida', 'activo', 'creado_en')
    list_select_related = ('categoria', 'unidad_medida')
    readonly_fields = ('nombre', 'categoria', 'unidad_medida', 'activo', 'creado_en')
    list_per_page = 10


@admin.register(PresentacionProducto)
class AdministracionPresentacion(CatalogoAdmin):
    list_display = ('nombre', 'producto', 'uso', 'activo')
    list_select_related = ('producto',)
    readonly_fields = ('nombre', 'producto', 'uso', 'activo', 'creado_en')
