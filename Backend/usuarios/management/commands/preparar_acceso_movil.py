from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from auditoria.servicios import registrar_actividad


class Command(BaseCommand):
    help = 'Añade únicamente los permisos móviles de Despachos a sus roles operativos existentes, con auditoría.'

    @transaction.atomic
    def handle(self, *args, **options):
        permisos_por_rol = {
            'Administrador de despachos': ['enviar_despacho'],
            'Chofer de despachos': ['ver_despachos_propios', 'operar_despachos_propios'],
        }
        for nombre, codigos in permisos_por_rol.items():
            rol = Group.objects.select_for_update().filter(name=nombre).first()
            if rol is None:
                self.stdout.write(f'Rol pendiente de crear: {nombre}.')
                continue
            permisos = list(Permission.objects.filter(content_type__app_label='despachos', content_type__model='despacho', codename__in=codigos))
            if len(permisos) != len(codigos):
                raise CommandError('Aplica las migraciones antes de preparar el acceso móvil.')
            existentes = set(rol.permissions.values_list('pk', flat=True))
            nuevos = [permiso for permiso in permisos if permiso.pk not in existentes]
            if nuevos:
                rol.permissions.add(*nuevos)
                registrar_actividad('roles', 'habilitar_acceso_movil', objeto=rol, objeto_nombre=rol.name,
                                   cambios={'permisos_agregados': [f'despachos.{permiso.codename}' for permiso in nuevos]})
        self.stdout.write(self.style.SUCCESS('Acceso móvil preparado; se conservaron los usuarios y los demás permisos.'))
