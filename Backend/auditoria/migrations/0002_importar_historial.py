from django.db import migrations


def importar_historial(aplicaciones, esquema):
    Registro = aplicaciones.get_model('auditoria', 'RegistroActividad')
    ActividadUsuario = aplicaciones.get_model('usuarios', 'ActividadUsuario')
    ActividadRol = aplicaciones.get_model('roles', 'ActividadRol')
    conexion = esquema.connection.alias

    def responsable(actor):
        return 'Cuenta eliminada' if actor is None else f'{actor.first_name} {actor.last_name}'.strip() or f'Cuenta #{actor.pk}'

    acciones = {'creado': 'crear', 'actualizado': 'editar', 'activado': 'activar', 'desactivado': 'desactivar',
                'password_restablecido': 'restablecer_contrasena', 'eliminado': 'eliminar'}
    for anterior in ActividadUsuario.objects.using(conexion).select_related('actor', 'usuario').iterator(chunk_size=500):
        Registro.objects.using(conexion).get_or_create(clave_origen=f'usuarios:{anterior.pk}', defaults={
            'fecha': anterior.fecha, 'actor_id': anterior.actor_id, 'responsable': responsable(anterior.actor),
            'modulo': 'usuarios', 'accion': acciones.get(anterior.accion, anterior.accion),
            'descripcion': 'Actividad importada del historial de usuarios', 'objeto_tipo': 'usuarios.usuario',
            'objeto_id': str(anterior.usuario_id), 'objeto_nombre': responsable(anterior.usuario),
            'cambios': {'campos_registrados': anterior.campos}, 'origen': 'historico',
        })
    for anterior in ActividadRol.objects.using(conexion).select_related('actor').iterator(chunk_size=500):
        Registro.objects.using(conexion).get_or_create(clave_origen=f'roles:{anterior.pk}', defaults={
            'fecha': anterior.fecha, 'actor_id': anterior.actor_id, 'responsable': responsable(anterior.actor),
            'modulo': 'roles', 'accion': acciones.get(anterior.accion, anterior.accion),
            'descripcion': 'Actividad importada del historial de roles', 'objeto_tipo': 'auth.group',
            'objeto_id': str(anterior.rol_id or ''), 'objeto_nombre': anterior.nombre_rol,
            'cambios': anterior.cambios, 'origen': 'historico',
        })


class Migration(migrations.Migration):
    dependencies = [('auditoria', '0001_initial'), ('usuarios', '0002_alter_usuario_managers_and_more'),
                    ('roles', '0002_nombre_unico_sin_mayusculas')]
    operations = [migrations.RunPython(importar_historial, migrations.RunPython.noop)]
