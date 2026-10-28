from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import Group
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied, ValidationError
from auditoria.servicios import registrar_actividad, estado_usuario, diferencias
from .models import Usuario, ActividadUsuario


def comprobar_edicion(actor, usuario):
    if usuario.is_superuser and not actor.is_superuser:
        raise PermissionDenied('Esta cuenta está protegida y requiere un superusuario.')
    if usuario.pk and usuario.pk != actor.pk and not actor.is_superuser:
        from django.contrib.auth.models import Permission
        permissions = Permission.objects.filter(Q(group__user=usuario) | Q(user=usuario)).select_related('content_type').distinct()
        granted = actor.get_all_permissions()
        if (usuario.is_staff and not actor.is_staff) or any(f'{p.content_type.app_label}.{p.codename}' not in granted for p in permissions):
            raise PermissionDenied('Esta cuenta tiene un nivel de acceso superior al que puedes administrar.')


def comprobar_roles(actor, usuario, roles):
    if not actor.has_perm('usuarios.asignar_roles'):
        raise PermissionDenied('No tienes permiso para asignar roles.')
    if usuario and actor.pk == usuario.pk:
        raise ValidationError({'roles': 'Otro administrador debe modificar tus roles.'})
    if not actor.is_superuser:
        granted = actor.get_all_permissions()
        if any(f'{p.content_type.app_label}.{p.codename}' not in granted for r in roles for p in r.permissions.all()):
            raise PermissionDenied('No puedes asignar permisos que tu cuenta no posee.')


def guardar_usuario(actor, datos, instancia=None):
    roles = datos.pop('groups', None)
    try:
        with transaction.atomic():
            if roles is not None:
                # Serialize assignment with role editing/deletion, checking fresh permissions.
                role_ids = {r.pk for r in roles}
                roles = list(Group.objects.select_for_update().filter(pk__in=role_ids).order_by('pk'))
                if len(roles) != len(role_ids):
                    raise ValidationError({'roles': 'Un rol ya no está disponible. Actualiza el formulario.'})
                comprobar_roles(actor, instancia, roles)
            usuario = Usuario.objects.select_for_update().get(pk=instancia.pk) if instancia else Usuario()
            comprobar_edicion(actor, usuario)
            anterior = estado_usuario(usuario) if instancia else {}
            campos = [k for k, value in datos.items() if k != 'password' and getattr(usuario, k) != value]
            password = datos.pop('password', None)
            for key, value in datos.items():
                setattr(usuario, key, value)
            if password:
                usuario.set_password(password)
            usuario.save()
            if roles is not None:
                old = set(usuario.groups.values_list('pk', flat=True))
                usuario.groups.set(roles)
                if old != {r.pk for r in roles}:
                    campos.append('roles')
            ActividadUsuario.objects.create(actor=actor, usuario=usuario, accion='actualizado' if instancia else 'creado', campos=campos)
            registrar_actividad('usuarios', 'editar' if instancia else 'crear', actor=actor, objeto=usuario,
                                objeto_nombre=usuario.get_full_name() or f'Cuenta #{usuario.pk}',
                                descripcion='Usuario actualizado' if instancia else 'Usuario creado',
                                cambios=diferencias(anterior, estado_usuario(usuario)))
            return usuario
    except IntegrityError as exc:
        raise ValidationError({'detail': 'El correo o la cédula ya están registrados. Revisa los datos.'}) from exc


@transaction.atomic
def cambiar_estado(actor, instancia, activo):
    # Lock privileged accounts in a consistent order before locking the target.
    supers = list(Usuario.objects.select_for_update().filter(is_superuser=True, is_active=True).order_by('pk')) if instancia.is_superuser and not activo else []
    usuario = Usuario.objects.select_for_update().get(pk=instancia.pk)
    comprobar_edicion(actor, usuario)
    if actor.pk == usuario.pk and not activo:
        raise ValidationError({'detail': 'No puedes desactivar tu propia cuenta.'})
    if usuario.is_active != activo:
        if usuario.is_superuser and not activo:
            if len(supers) <= 1:
                raise ValidationError({'detail': 'Debe permanecer al menos un superusuario activo.'})
        usuario.is_active = activo
        usuario.save(update_fields=['is_active'])
        ActividadUsuario.objects.create(actor=actor, usuario=usuario, accion='activado' if activo else 'desactivado')
        registrar_actividad('usuarios', 'activar' if activo else 'desactivar', actor=actor, objeto=usuario,
                            objeto_nombre=usuario.get_full_name() or f'Cuenta #{usuario.pk}',
                            cambios={'is_active': {'antes': not activo, 'despues': activo}})
    return usuario


@transaction.atomic
def cambiar_password(request, instancia, password):
    usuario = Usuario.objects.select_for_update().get(pk=instancia.pk)
    comprobar_edicion(request.user, usuario)
    usuario.set_password(password)
    usuario.save(update_fields=['password'])
    if usuario.pk == request.user.pk:
        update_session_auth_hash(request, usuario)
    ActividadUsuario.objects.create(actor=request.user, usuario=usuario, accion='password_restablecido')
    registrar_actividad('usuarios', 'cambiar_contrasena' if usuario.pk == request.user.pk else 'restablecer_contrasena',
                        actor=request.user, objeto=usuario, objeto_nombre=usuario.get_full_name() or f'Cuenta #{usuario.pk}',
                        descripcion='Contraseña actualizada; su contenido no se registra')
