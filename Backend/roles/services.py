import hashlib
import json
from django.contrib.auth.models import Group
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from auditoria.servicios import registrar_actividad, diferencias
from .models import ActividadRol


class ConflictoRol(APIException):
    status_code = 409
    default_detail = 'El rol cambió mientras lo editabas. Ciérralo y vuelve a abrirlo para cargar la versión actual.'
    default_code = 'role_conflict'


def version_rol(rol):
    value = [rol.name, sorted(p.pk for p in rol.permissions.all())]
    return hashlib.sha256(json.dumps(value).encode()).hexdigest()


def bloqueo_rol(actor, rol):
    if actor.is_superuser:
        return ''
    own = getattr(rol, 'asignado_actor', None)
    if own is None:
        own = rol.user_set.filter(pk=actor.pk).exists()
    if own:
        return 'own_role'
    protected = getattr(rol, 'superusuarios_count', None)
    if protected is None:
        protected = rol.user_set.filter(is_superuser=True).exists()
    if protected:
        return 'protected_members'
    granted = actor.get_all_permissions()
    if any(f'{p.content_type.app_label}.{p.codename}' not in granted for p in rol.permissions.all()):
        return 'higher_permissions'
    return ''


def comprobar_gestion(actor, rol):
    reason = bloqueo_rol(actor, rol)
    if reason:
        raise PermissionDenied({
            'own_role': 'Otro administrador debe modificar un rol asignado a tu propia cuenta.',
            'protected_members': 'Este rol está asignado a una cuenta protegida.',
            'higher_permissions': 'Este rol contiene permisos que no puedes administrar.',
        }[reason])


def estado_rol(rol):
    return {'name': rol.name, 'permissions': sorted(f'{p.content_type.app_label}.{p.codename}' for p in rol.permissions.all())}


def guardar_rol(actor, datos, instancia=None):
    try:
        with transaction.atomic():
            rol = get_object_or_404(Group.objects.select_for_update(), pk=instancia.pk) if instancia else Group()
            if instancia:
                comprobar_gestion(actor, rol)
                if datos['version'] != version_rol(rol):
                    raise ConflictoRol()
            name = datos.get('name', rol.name).strip()
            if Group.objects.filter(name__iexact=name).exclude(pk=rol.pk).exists():
                raise ValidationError({'name': 'Ya existe un rol con este nombre.'})
            before = estado_rol(rol) if instancia else None
            permissions = datos.get('permissions')
            if permissions is not None and not actor.is_superuser:
                if any(not actor.has_perm(f'{p.content_type.app_label}.{p.codename}') for p in permissions):
                    raise PermissionDenied('No puedes otorgar permisos que tu cuenta no posee.')
            rol.name = name
            rol.save()
            if permissions is not None:
                rol.permissions.set(permissions)
            after = estado_rol(rol)
            if before != after:
                ActividadRol.objects.create(rol=rol, nombre_rol=name, actor=actor, accion='actualizado' if instancia else 'creado', cambios={'antes': before, 'despues': after})
                registrar_actividad('roles', 'editar' if instancia else 'crear', actor=actor, objeto=rol,
                                    objeto_nombre=rol.name, cambios=diferencias(before or {}, after))
            return rol
    except IntegrityError as exc:
        raise ValidationError({'name': 'Ya existe un rol con este nombre.'}) from exc


@transaction.atomic
def eliminar_rol(actor, instancia, version):
    rol = get_object_or_404(Group.objects.select_for_update(), pk=instancia.pk)
    comprobar_gestion(actor, rol)
    if version != version_rol(rol):
        raise ConflictoRol()
    if rol.user_set.exists():
        raise ValidationError({'detail': 'Este rol tiene usuarios asignados. Reasígnalos desde Usuarios antes de eliminarlo.'})
    ActividadRol.objects.create(rol=rol, nombre_rol=rol.name, actor=actor, accion='eliminado', cambios={'antes': estado_rol(rol), 'despues': None})
    registrar_actividad('roles', 'eliminar', actor=actor, objeto=rol, objeto_nombre=rol.name,
                        cambios={'registro': {'antes': estado_rol(rol), 'despues': None}})
    rol.delete()
