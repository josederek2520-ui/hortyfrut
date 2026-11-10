from collections import defaultdict
from zoneinfo import ZoneInfo
from django.db import migrations, models


def completar_consecutivos(aplicaciones, editor):
    respaldo = aplicaciones.get_model('respaldos', 'Respaldo')
    cantidades = defaultdict(int)
    for copia in respaldo.objects.using(editor.connection.alias).order_by('creado_en', 'id').iterator():
        fecha = copia.creado_en.astimezone(ZoneInfo('America/La_Paz')).date()
        cantidades[fecha] += 1
        copia.fecha_respaldo = fecha
        copia.consecutivo = cantidades[fecha]
        copia.save(using=editor.connection.alias, update_fields=['fecha_respaldo', 'consecutivo'])


class Migration(migrations.Migration):
    dependencies = [('respaldos', '0001_crear_respaldos')]
    operations = [
        migrations.AddField(model_name='respaldo', name='fecha_respaldo', field=models.DateField(null=True)),
        migrations.AddField(model_name='respaldo', name='consecutivo', field=models.PositiveIntegerField(null=True)),
        migrations.RunPython(completar_consecutivos, migrations.RunPython.noop),
        migrations.AlterField(model_name='respaldo', name='fecha_respaldo', field=models.DateField()),
        migrations.AlterField(model_name='respaldo', name='consecutivo', field=models.PositiveIntegerField()),
        migrations.AddConstraint(model_name='respaldo', constraint=models.UniqueConstraint(
            fields=['fecha_respaldo', 'consecutivo'], name='respaldo_consecutivo_diario_unico')),
        migrations.AddConstraint(model_name='respaldo', constraint=models.CheckConstraint(
            condition=models.Q(consecutivo__gt=0), name='respaldo_consecutivo_positivo')),
    ]
