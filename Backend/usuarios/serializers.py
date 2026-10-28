from django.contrib.auth import authenticate, password_validation
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from roles.serializers import RolSerializer
from .models import Usuario, ActividadUsuario


class UsuarioListaSerializer(serializers.ModelSerializer):
    roles = RolSerializer(source='groups', many=True, read_only=True)
    nombre_completo = serializers.CharField(source='get_full_name', read_only=True)
    protegido = serializers.BooleanField(source='is_superuser', read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'first_name', 'last_name', 'nombre_completo', 'email',
                  'cedula_identidad', 'celular', 'is_active', 'roles', 'date_joined', 'last_login', 'protegido')


class ActividadSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    def get_actor(self, obj):
        if obj.actor is None:
            return None
        return obj.actor.get_full_name() or f'Cuenta {obj.actor_id}'

    class Meta:
        model = ActividadUsuario
        fields = ('id', 'actor', 'accion', 'campos', 'fecha')


class UsuarioDetalleSerializer(UsuarioListaSerializer):
    actividad_reciente = serializers.SerializerMethodField()

    class Meta(UsuarioListaSerializer.Meta):
        fields = UsuarioListaSerializer.Meta.fields + ('fecha_nacimiento', 'direccion', 'actividad_reciente')

    def get_actividad_reciente(self, obj):
        return ActividadSerializer(obj.actividad.select_related('actor')[:8], many=True).data


class UsuarioEscrituraSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False, max_length=128)
    roles = serializers.PrimaryKeyRelatedField(queryset=Group.objects.prefetch_related('permissions__content_type'), many=True, required=False, source='groups')
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    cedula_identidad = serializers.RegexField(r'\A[0-9]+\Z', max_length=30, trim_whitespace=False, error_messages={'invalid': 'Ingresa únicamente números del 0 al 9.'})
    celular = serializers.RegexField(r'\A[0-9]*\Z', max_length=25, allow_blank=True, required=False, trim_whitespace=False, error_messages={'invalid': 'Ingresa únicamente números del 0 al 9.'})

    class Meta:
        model = Usuario
        fields = ('first_name', 'last_name', 'email', 'password', 'cedula_identidad',
                  'fecha_nacimiento', 'celular', 'direccion', 'roles')
        extra_kwargs = {'direccion': {'max_length': 500}}

    def validate_email(self, value):
        value = value.strip().lower()
        qs = Usuario.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un usuario con este correo electrónico.')
        return value

    def validate_cedula_identidad(self, value):
        qs = Usuario.objects.filter(cedula_identidad=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un usuario con esta cédula de identidad.')
        return value

    def validate_fecha_nacimiento(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError('La fecha de nacimiento no puede ser futura.')
        return value

    def validate(self, attrs):
        forbidden = set(self.initial_data) - set(self.fields)
        if forbidden:
            raise serializers.ValidationError({'detail': 'La solicitud incluye campos que no se pueden modificar.'})
        if self.instance and 'password' in attrs:
            raise serializers.ValidationError({'password': 'Usa la acción de restablecer contraseña.'})
        if not self.instance and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'Ingresa una contraseña inicial.'})
        if 'password' in attrs:
            candidate = Usuario(**{k: v for k, v in attrs.items() if k not in ('password', 'groups')})
            try:
                password_validation.validate_password(attrs['password'], user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages})
        return attrs


class EstadoSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    current_password = serializers.CharField(write_only=True, trim_whitespace=False, required=False, max_length=128)

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user.pk == self.context['usuario'].pk:
            if not request.user.check_password(attrs.get('current_password', '')):
                raise serializers.ValidationError({'current_password': 'Ingresa correctamente tu contraseña actual.'})
        return attrs

    def validate_password(self, value):
        try:
            password_validation.validate_password(value, self.context['usuario'])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value


class PerfilSerializer(UsuarioEscrituraSerializer):
    class Meta(UsuarioEscrituraSerializer.Meta):
        fields = ('first_name', 'last_name', 'email', 'cedula_identidad', 'fecha_nacimiento', 'celular', 'direccion')


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, max_length=128)
    remember = serializers.BooleanField(default=False)

    def validate(self, attrs):
        desconocidos = set(self.initial_data) - set(self.fields)
        if desconocidos:
            raise serializers.ValidationError('El acceso requiere correo electrónico y contraseña.')
        attrs['email'] = attrs['email'].strip().lower()
        usuario = authenticate(request=self.context['request'], email=attrs['email'], password=attrs['password'])
        if usuario is None:
            raise serializers.ValidationError('El correo o la contraseña no son correctos.')
        attrs['user'] = usuario
        return attrs
