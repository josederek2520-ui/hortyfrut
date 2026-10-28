import json
from django.core.serializers.json import DjangoJSONEncoder
from .contexto import solicitud_actual
from .models import RegistroActividad

CLAVES_SECRETAS = ('password', 'contrasena', 'contraseña', 'token', 'secret', 'authorization', 'autorizacion',
                  'cookie', 'session', 'sesion', 'api_key', 'clave_api', 'credencial')
CAMPOS_PROTEGIDOS = {'cedula_identidad', 'celular', 'direccion', 'fecha_nacimiento', 'email', 'nit', 'telefono', 'referencia', 'latitud', 'longitud'}


def limpiar_cambios(valor, profundidad=0):
    """Nunca persistir cargas de solicitudes, secretos ni valores personales completos."""
    if profundidad > 6:
        return '[contenido omitido]'
    if isinstance(valor, dict):
        limpio = {}
        for clave, contenido in list(valor.items())[:100]:
            nombre = str(clave)
            if any(secreto in nombre.casefold() for secreto in CLAVES_SECRETAS):
                continue
            limpio[nombre] = '[dato protegido]' if nombre.casefold() in CAMPOS_PROTEGIDOS else limpiar_cambios(contenido, profundidad + 1)
        return limpio
    if isinstance(valor, (tuple, list, set)):
        return [limpiar_cambios(elemento, profundidad + 1) for elemento in list(valor)[:100]]
    if isinstance(valor, str):
        return valor[:1000]
    return json.loads(json.dumps(valor, cls=DjangoJSONEncoder))


def nombre_responsable(actor):
    if actor is not None and actor.is_authenticated:
        return (actor.get_full_name().strip() or f'Cuenta #{actor.pk}')[:200]
    return 'Sistema'


def registrar_actividad(modulo, accion, *, actor=None, objeto=None, objeto_nombre='', descripcion='', cambios=None,
                       resultado='exito', origen=None, solicitud=None, codigo_http=None, **datos):
    """Invocar dentro de la transacción de negocio para conservar operación y evidencia juntas."""
    solicitud = solicitud or solicitud_actual.get()
    if actor is None and solicitud is not None:
        actor = getattr(solicitud, 'user', None)
    actor_valido = actor if actor is not None and actor.is_authenticated and actor.pk else None
    coincidencia = getattr(solicitud, 'resolver_match', None)
    registro = RegistroActividad.objects.create(
        actor=actor_valido, responsable=nombre_responsable(actor_valido) if actor_valido else ('Anónimo' if solicitud else 'Sistema'),
        modulo=modulo[:64], accion=accion[:64], descripcion=(descripcion or f'{accion.replace("_", " ").capitalize()} en {modulo}')[:250],
        objeto_tipo=objeto._meta.label_lower if objeto else datos.pop('objeto_tipo', ''),
        objeto_id=str(objeto.pk) if objeto else str(datos.pop('objeto_id', '')),
        objeto_nombre=objeto_nombre[:200], resultado=resultado, cambios=limpiar_cambios(cambios or {}),
        origen=origen or ('api' if solicitud else 'sistema'),
        metodo=solicitud.method if solicitud else '',
        # Guardar el patrón de la ruta; nunca query strings, cookies o cuerpo HTTP.
        ruta=str(coincidencia.route)[:300] if coincidencia else '',
        codigo_http=codigo_http,
        **({'solicitud_id': solicitud.auditoria_id} if solicitud and hasattr(solicitud, 'auditoria_id') else {}),
        **datos,
    )
    if solicitud is not None:
        solicitud.auditoria_registrada = True
    return registro


def estado_usuario(usuario):
    campos = ['first_name', 'last_name', 'email', 'cedula_identidad', 'fecha_nacimiento', 'celular', 'direccion', 'is_active']
    roles = [{'id': rol['id'], 'nombre': rol['name']} for rol in usuario.groups.order_by('pk').values('id', 'name')] if usuario.pk else []
    return {**{campo: getattr(usuario, campo) for campo in campos}, 'roles': roles}


def diferencias(antes, despues):
    return {campo: {'antes': antes.get(campo), 'despues': valor} for campo, valor in despues.items() if antes.get(campo) != valor}
