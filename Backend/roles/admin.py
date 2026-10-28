from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin
from django.contrib.auth.models import Group


# Business administrators use the audited API. The technical admin cannot bypass
# its grant restrictions through Django's unrestricted permissions widget.
admin.site.unregister(Group)


@admin.register(Group)
class GrupoTecnicoAdmin(GroupAdmin):
    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_superuser

    has_add_permission = has_view_permission
    has_change_permission = has_view_permission
    has_delete_permission = has_view_permission
