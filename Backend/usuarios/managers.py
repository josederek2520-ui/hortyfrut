import re

from django.contrib.auth.base_user import BaseUserManager
from django.core.exceptions import ValidationError
from .validadores import normalizar_correo


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **campos_extra):
        cedula_identidad = campos_extra.get('cedula_identidad')
        if not isinstance(cedula_identidad, str) or not re.fullmatch(r'[0-9]{1,30}', cedula_identidad):
            raise ValueError('La cédula es obligatoria y debe contener únicamente números del 0 al 9.')
        try:
            correo = normalizar_correo(email)
        except ValidationError as error:
            raise ValueError('Ingresa un correo electrónico válido.') from error
        usuario = self.model(email=correo, **campos_extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, password=None, **campos_extra):
        campos_extra.setdefault('is_staff', True)
        campos_extra.setdefault('is_superuser', True)
        campos_extra.setdefault('is_active', True)
        if not campos_extra['is_staff'] or not campos_extra['is_superuser'] or not campos_extra['is_active']:
            raise ValueError('El superusuario debe estar activo y tener acceso administrativo.')
        return self.create_user(email, password, **campos_extra)

    def get_by_natural_key(self, correo):
        return self.get(email=str(correo).strip().lower())

    async def aget_by_natural_key(self, correo):
        return await self.aget(email=str(correo).strip().lower())
