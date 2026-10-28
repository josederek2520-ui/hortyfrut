from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario
from .forms import UsuarioChangeForm, UsuarioCreationForm


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    has_add_permission = has_view_permission
    has_change_permission = has_view_permission

    def has_delete_permission(self, request, obj=None):
        return False

    form = UsuarioChangeForm
    add_form = UsuarioCreationForm
    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'cedula_identidad', 'is_active')
    search_fields = ('cedula_identidad', 'first_name', 'last_name', 'email', 'celular')
    readonly_fields = ('date_joined', 'last_login')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Información personal', {'fields': ('first_name', 'last_name', 'cedula_identidad', 'fecha_nacimiento', 'celular', 'direccion')}),
        ('Acceso', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Registro', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'cedula_identidad', 'first_name', 'last_name', 'password1', 'password2')}),
    )
