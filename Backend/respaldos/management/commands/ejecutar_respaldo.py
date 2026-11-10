from django.core.management.base import BaseCommand
from respaldos.ejecucion import ejecutar_respaldo


class Command(BaseCommand):
    help = 'Ejecuta una solicitud de respaldo persistida y revalida su autorización.'

    def add_arguments(self, parser):
        parser.add_argument('identificador', type=str)

    def handle(self, *args, **options):
        ejecutar_respaldo(options['identificador'])
