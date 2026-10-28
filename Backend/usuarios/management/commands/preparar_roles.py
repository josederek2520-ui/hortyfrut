from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Crea los roles iniciales del módulo sin modificar roles existentes.'

    @transaction.atomic
    def handle(self, *args, **options):
        admin, created = Group.objects.get_or_create(name='Administrador de usuarios')
        if created:
            admin.permissions.set(Permission.objects.filter(content_type__app_label='usuarios', content_type__model='usuario').exclude(codename='delete_usuario'))
        reader, created = Group.objects.get_or_create(name='Consulta de usuarios')
        if created:
            reader.permissions.set(Permission.objects.filter(content_type__app_label='usuarios', codename='view_usuario'))
        roles_admin, created = Group.objects.get_or_create(name='Administrador de roles')
        if created:
            roles_admin.permissions.set(Permission.objects.filter(content_type__app_label='auth', content_type__model='group'))
        auditor, creado = Group.objects.get_or_create(name='Auditor del sistema')
        if creado:
            auditor.permissions.set(Permission.objects.filter(content_type__app_label='auditoria', codename='ver_registroactividad'))
        catalogos, creado = Group.objects.get_or_create(name='Administrador de catálogos')
        if creado:
            catalogos.permissions.set(Permission.objects.filter(content_type__app_label='catalogos'))
        productos, creado = Group.objects.get_or_create(name='Administrador de productos')
        if creado:
            productos.permissions.set(Permission.objects.filter(content_type__app_label='productos'))
        clientes, creado = Group.objects.get_or_create(name='Administrador de clientes')
        if creado:
            clientes.permissions.set(Permission.objects.filter(content_type__app_label='clientes'))
        proveedores, creado = Group.objects.get_or_create(name='Administrador de proveedores')
        if creado:
            proveedores.permissions.set(Permission.objects.filter(content_type__app_label='proveedores'))
        compras, creado = Group.objects.get_or_create(name='Administrador de compras')
        if creado:
            compras.permissions.set(Permission.objects.filter(content_type__app_label='compras', content_type__model='compra'))
        almacenes, creado = Group.objects.get_or_create(name='Administrador de almacenes')
        if creado:
            almacenes.permissions.set(Permission.objects.filter(content_type__app_label='almacenes', content_type__model='almacen'))
        recepciones, creado_recepciones = Group.objects.get_or_create(name='Administrador de recepciones')
        if creado_recepciones:
            recepciones.permissions.set(Permission.objects.filter(content_type__app_label='recepciones', content_type__model='recepcion'))
        inventario, creado_inventario = Group.objects.get_or_create(name='Administrador de inventario')
        if creado_inventario:
            inventario.permissions.set(Permission.objects.filter(content_type__app_label='inventario'))
        cajillas, creadas_cajillas = Group.objects.get_or_create(name='Administrador de cajillas')
        if creadas_cajillas:
            cajillas.permissions.set(Permission.objects.filter(content_type__app_label='cajillas', content_type__model='cajilla'))
        preparaciones, creadas_preparaciones = Group.objects.get_or_create(name='Administrador de preparaciones')
        if creadas_preparaciones:
            preparaciones.permissions.set(Permission.objects.filter(content_type__app_label='preparaciones', content_type__model='preparacion'))
        pedidos, creado = Group.objects.get_or_create(name='Administrador de pedidos')
        if creado:
            pedidos.permissions.set(Permission.objects.filter(content_type__app_label='pedidos', content_type__model='pedido'))
        encargado, creado = Group.objects.get_or_create(name='Encargado de pedidos')
        if creado:
            encargado.permissions.set(Permission.objects.filter(content_type__app_label='pedidos', codename__in=['view_pedido', 'add_pedido', 'change_pedido', 'cancelar_pedido']))
        self.stdout.write(self.style.SUCCESS('Roles iniciales disponibles.'))
