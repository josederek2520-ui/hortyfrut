from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('roles', '0001_initial')]
    # Group is owned by django.contrib.auth. This application-owned PostgreSQL
    # index enforces case-insensitive uniqueness even for concurrent requests.
    operations = [migrations.RunSQL(
        'CREATE UNIQUE INDEX roles_group_nombre_ci_unique ON auth_group (LOWER(name))',
        'DROP INDEX roles_group_nombre_ci_unique',
    )]
