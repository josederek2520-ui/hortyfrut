from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import BasePermission


class AutenticacionSesion(SessionAuthentication):
    def authenticate_header(self, request):
        return 'Session'


class PermisosUsuarios(BasePermission):
    permissions = {
        'list': 'view_usuario', 'retrieve': 'view_usuario', 'resumen': 'view_usuario',
        'create': 'add_usuario', 'update': 'change_usuario', 'partial_update': 'change_usuario',
        'estado': 'desactivar_usuario', 'password': 'restablecer_password',
    }

    def has_permission(self, request, view):
        codename = self.permissions.get(view.action)
        return bool(request.user.is_authenticated and codename and request.user.has_perm('usuarios.' + codename))
