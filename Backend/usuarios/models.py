from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from django.utils import timezone
from .managers import UsuarioManager
from .validadores import normalizar_correo


solo_digitos = RegexValidator(r'\A[0-9]*\Z', 'Ingresa únicamente números del 0 al 9.')


class Usuario(AbstractUser):
    username = None
    email = models.EmailField('correo electrónico', unique=True)
    cedula_identidad = models.CharField('cédula de identidad', max_length=30, unique=True, validators=[RegexValidator(r'\A[0-9]+\Z', 'Ingresa únicamente números del 0 al 9.')])
    fecha_nacimiento = models.DateField('fecha de nacimiento', null=True, blank=True)
    celular = models.CharField(max_length=25, blank=True, validators=[solo_digitos])
    direccion = models.TextField('dirección', blank=True, max_length=500)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['cedula_identidad']
    objects = UsuarioManager()

    def __str__(self):
        return self.get_full_name() or self.cedula_identidad

    class Meta:
        verbose_name = 'usuario'
        verbose_name_plural = 'usuarios'
        ordering = ['-date_joined', '-pk']
        permissions = [
            ('asignar_roles', 'Puede asignar roles a usuarios'),
            ('desactivar_usuario', 'Puede activar o desactivar usuarios'),
            ('restablecer_password', 'Puede restablecer contraseñas de usuarios'),
        ]
        constraints = [
            models.UniqueConstraint(Lower('email'), condition=~Q(email=''), name='usuario_email_unico'),
            models.CheckConstraint(condition=~Q(email=''), name='usuario_correo_obligatorio'),
            models.CheckConstraint(condition=Q(email=Lower(Trim('email'))), name='usuario_correo_normalizado'),
            models.CheckConstraint(condition=Q(cedula_identidad__regex=r'^[0-9]+$'), name='usuario_cedula_digitos'),
            models.CheckConstraint(condition=Q(celular__regex=r'^[0-9]*$'), name='usuario_celular_digitos'),
        ]

    def clean(self):
        super().clean()
        try:
            self.email = normalizar_correo(self.email)
        except ValidationError as error:
            raise ValidationError({'email': error.messages}) from error
        if self.fecha_nacimiento and self.fecha_nacimiento > timezone.localdate():
            raise ValidationError({'fecha_nacimiento': 'La fecha de nacimiento no puede ser futura.'})

    def save(self, *args, **kwargs):
        self.email = normalizar_correo(self.email)
        return super().save(*args, **kwargs)


class ActividadUsuario(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='acciones_realizadas')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='actividad')
    accion = models.CharField(max_length=40)
    campos = models.JSONField(default=list)
    fecha = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-fecha', '-pk']
