from django.contrib.auth.models import Group, Permission
from rest_framework import serializers
from .catalogo import permisos_publicos, permiso_data
from .services import bloqueo_rol, version_rol


class RolSerializer(serializers.ModelSerializer):
    asignable = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ('id', 'name', 'asignable')

    def get_asignable(self, obj):
        user = self.context['request'].user
        return user.is_superuser or all(user.has_perm(f'{p.content_type.app_label}.{p.codename}') for p in obj.permissions.all())


class RolListaSerializer(serializers.ModelSerializer):
    usuarios_count = serializers.IntegerField(read_only=True)
    permisos_count = serializers.IntegerField(read_only=True)
    gestion = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ('id', 'name', 'usuarios_count', 'permisos_count', 'gestion', 'version')

    def get_gestion(self, obj):
        user = self.context['request'].user
        reason = bloqueo_rol(user, obj)
        return {'edit': user.has_perm('auth.change_group') and not reason,
                'delete': user.has_perm('auth.delete_group') and not reason and obj.usuarios_count == 0,
                'reason': reason or ('assigned_users' if obj.usuarios_count else '')}

    def get_version(self, obj):
        return version_rol(obj)


class RolDetalleSerializer(RolListaSerializer):
    permissions = serializers.SerializerMethodField()
    actividad_reciente = serializers.SerializerMethodField()

    class Meta(RolListaSerializer.Meta):
        fields = RolListaSerializer.Meta.fields + ('permissions', 'actividad_reciente')

    def get_permissions(self, obj):
        return [permiso_data(p, self.context['request'].user) for p in obj.permissions.all()]

    def get_actividad_reciente(self, obj):
        return [{'id': a.pk, 'accion': a.accion, 'fecha': a.fecha,
                 'actor': (a.actor.get_full_name() or f'Cuenta {a.actor_id}') if a.actor else None}
                for a in obj.actividad_roles.select_related('actor')[:8]]


class RolEscrituraSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    permissions = serializers.PrimaryKeyRelatedField(queryset=Permission.objects.select_related('content_type'), many=True)
    version = serializers.CharField(max_length=64, required=False)

    def validate_name(self, value):
        if Group.objects.filter(name__iexact=value).exclude(pk=self.instance.pk if self.instance else None).exists():
            raise serializers.ValidationError('Ya existe un rol con este nombre.')
        return value

    def validate(self, attrs):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: 'Este campo no se puede modificar.' for key in unknown})
        if self.instance and not attrs.get('version'):
            raise serializers.ValidationError({'version': 'Vuelve a abrir el rol para cargar la versión actual.'})
        allowed = set(permisos_publicos().values_list('pk', flat=True))
        if self.instance:
            allowed.update(self.instance.permissions.values_list('pk', flat=True))
        if any(p.pk not in allowed for p in attrs.get('permissions', [])):
            raise serializers.ValidationError({'permissions': 'Selecciona permisos del catálogo disponible.'})
        return attrs


class EliminarRolSerializer(serializers.Serializer):
    version = serializers.CharField(max_length=64)
