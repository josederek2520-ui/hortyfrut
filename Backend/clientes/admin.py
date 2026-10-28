from django.contrib import admin
from catalogos.admin import CatalogoAdmin
from .models import Cliente, Sucursal


@admin.register(Cliente)
class AdministracionCliente(CatalogoAdmin):
    list_display = ('razon_social', 'nit', 'activo', 'creado_en')
    search_fields = ('razon_social', 'nit')
    readonly_fields = ('razon_social', 'nit', 'telefono', 'email', 'activo', 'creado_en')


@admin.register(Sucursal)
class AdministracionSucursal(CatalogoAdmin):
    list_display = ('nombre', 'cliente', 'activo', 'creado_en')
    list_select_related = ('cliente',)
    search_fields = ('nombre', 'cliente__razon_social')
    readonly_fields = ('nombre', 'cliente', 'direccion', 'telefono', 'referencia', 'latitud', 'longitud', 'activo', 'creado_en')
