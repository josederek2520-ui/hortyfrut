from django.contrib.auth.hashers import make_password
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class MigracionCorreoTests(TransactionTestCase):
    desde = [('usuarios', '0002_alter_usuario_managers_and_more')]
    hasta = [('usuarios', '0003_acceso_por_correo')]

    def setUp(self):
        self.ejecutor = MigrationExecutor(connection)
        self.ejecutor.migrate(self.desde)
        aplicaciones = self.ejecutor.loader.project_state(self.desde).apps
        self.UsuarioAnterior = aplicaciones.get_model('usuarios', 'Usuario')
        self.GrupoAnterior = aplicaciones.get_model('auth', 'Group')
        self.cuentas = []
        self.grupos = []

    def crear_cuenta(self, correo, cedula='550001'):
        usuario = self.UsuarioAnterior.objects.create(email=correo, cedula_identidad=cedula, password=make_password('MigracionSegura_2026!'), is_active=True)
        self.cuentas.append(usuario.pk)
        return usuario

    def tearDown(self):
        # Solo los identificadores creados por esta prueba en la base de pruebas.
        self.UsuarioAnterior.objects.filter(pk__in=self.cuentas).delete()
        self.GrupoAnterior.objects.filter(pk__in=self.grupos).delete()
        MigrationExecutor(connection).migrate(self.hasta)
        super().tearDown()

    def test_migracion_normaliza_y_conserva_identidad_contrasena_roles(self):
        usuario = self.crear_cuenta('  MIGRACION@Example.test  ')
        rol = self.GrupoAnterior.objects.create(name='Rol de migracion')
        self.grupos.append(rol.pk)
        usuario.groups.add(rol)
        identificador, contrasena = usuario.pk, usuario.password
        MigrationExecutor(connection).migrate(self.hasta)
        UsuarioActual = self.ejecutor.loader.project_state(self.hasta).apps.get_model('usuarios', 'Usuario')
        conservado = UsuarioActual.objects.get(pk=identificador)
        self.assertEqual(conservado.email, 'migracion@example.test')
        self.assertEqual(conservado.password, contrasena)
        self.assertEqual(conservado.cedula_identidad, '550001')
        self.assertEqual(list(conservado.groups.values_list('pk', flat=True)), [rol.pk])

    def test_migracion_rechaza_correo_faltante_sin_borrar_cuenta(self):
        usuario = self.crear_cuenta('')
        with self.assertRaisesRegex(RuntimeError, 'correo válido'):
            MigrationExecutor(connection).migrate(self.hasta)
        self.assertTrue(self.UsuarioAnterior.objects.filter(pk=usuario.pk, email='').exists())

    def test_migracion_rechaza_duplicados_al_normalizar(self):
        self.crear_cuenta('duplicado@example.test')
        self.crear_cuenta(' DUPLICADO@example.test ', '550002')
        with self.assertRaisesRegex(RuntimeError, 'repetidos'):
            MigrationExecutor(connection).migrate(self.hasta)
        self.assertEqual(self.UsuarioAnterior.objects.filter(pk__in=self.cuentas).count(), 2)
