from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.db.models.signals import post_save
from django.dispatch import receiver
from .servicios import registrar_actividad


@receiver(post_save, sender=LogEntry, dispatch_uid='auditoria_administracion_tecnica')
def registrar_accion_admin(sender, instance, created, **kwargs):
    if not created:
        return
    tipo = instance.content_type
    modulo = 'roles' if tipo and tipo.app_label == 'auth' and tipo.model == 'group' else tipo.app_label if tipo else 'administracion'
    registrar_actividad(modulo, {ADDITION: 'crear', CHANGE: 'editar', DELETION: 'eliminar'}.get(instance.action_flag, 'administrar'),
                        actor=instance.user, origen='admin', objeto_id=instance.object_id or '',
                        objeto_tipo=f'{tipo.app_label}.{tipo.model}' if tipo else '',
                        descripcion='Operación desde la administración técnica', cambios={'referencia_admin': instance.pk})
