import logging
import uuid
from .contexto import solicitud_actual
from .servicios import registrar_actividad

bitacora = logging.getLogger(__name__)
RUTAS_TECNICAS = {'/api/v1/auth/me/', '/api/v1/auth/csrf/'}


class RegistroActividadMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, solicitud):
        solicitud.auditoria_id = uuid.uuid4()
        ficha = solicitud_actual.set(solicitud)
        try:
            respuesta = self.get_response(solicitud)
            if self.debe_registrar(solicitud, respuesta):
                try:
                    self.registrar_solicitud(solicitud, respuesta.status_code)
                except Exception:
                    # Un fallo de observabilidad de lectura no debe reemplazar la respuesta.
                    # Las escrituras de negocio registran su evidencia dentro de transaction.atomic.
                    bitacora.exception('No se pudo registrar la solicitud %s', solicitud.auditoria_id)
            respuesta['X-Request-ID'] = str(solicitud.auditoria_id)
            return respuesta
        finally:
            solicitud_actual.reset(ficha)

    def debe_registrar(self, solicitud, respuesta):
        if not solicitud.path.startswith('/api/v1/') or solicitud.method in ('HEAD', 'OPTIONS'):
            return False
        if solicitud.path in RUTAS_TECNICAS:
            return respuesta.status_code >= 400 and solicitud.path != '/api/v1/auth/me/'
        coincidencia = solicitud.resolver_match
        acciones = getattr(coincidencia.func, 'actions', {}) if coincidencia else {}
        if solicitud.method == 'GET' and acciones.get('get') == 'imagen':
            return respuesta.status_code >= 400
        if solicitud.method == 'GET' and solicitud.path.rstrip('/').split('/')[-1] in ('resumen', 'opciones', 'imagen'):
            return respuesta.status_code >= 400
        return respuesta.status_code >= 400 or not getattr(solicitud, 'auditoria_registrada', False)

    def registrar_solicitud(self, solicitud, estado):
        segmentos = solicitud.path.strip('/').split('/')[2:]
        modulo = segmentos[0] if segmentos else 'sistema'
        modulo = modulo.replace('-', '_')
        if modulo == 'auth':
            modulo = 'autenticacion'
        elif modulo == 'actividad':
            modulo = 'auditoria'
        coincidencia = solicitud.resolver_match
        modulo_vista = getattr(getattr(coincidencia.func, 'cls', None), 'modulo_auditoria', None) if coincidencia else None
        if modulo_vista:
            modulo = modulo_vista
        parametros = coincidencia.kwargs if coincidencia else {}
        identificador = str(parametros.get('pk', parametros.get('identificador', parametros.get('id', ''))))
        accion = {'GET': 'ver_detalle' if identificador else 'listar', 'POST': 'crear', 'PATCH': 'editar', 'PUT': 'editar', 'DELETE': 'eliminar'}.get(solicitud.method, 'solicitar')
        acciones_vista = getattr(coincidencia.func, 'actions', {}) if coincidencia else {}
        accion_vista = acciones_vista.get(solicitud.method.lower())
        if accion_vista:
            accion = {'list': 'listar', 'retrieve': 'ver_detalle', 'create': 'crear', 'update': 'editar',
                      'partial_update': 'editar', 'destroy': 'eliminar', 'estado': 'cambiar_estado',
                      'password': 'restablecer_contrasena'}.get(accion_vista, accion_vista)
        if len(segmentos) > 1 and segmentos[0] == 'auth':
            accion = {'login': 'iniciar_sesion', 'logout': 'cerrar_sesion', 'profile': 'ver_perfil' if solicitud.method == 'GET' else 'editar_perfil'}.get(segmentos[1], accion)
        if segmentos and segmentos[-1] == 'password':
            accion = 'cambiar_contrasena'
        resultado = 'error' if estado >= 500 else 'rechazado' if estado >= 400 else 'exito'
        registrar_actividad(modulo[:64], accion, solicitud=solicitud, objeto_id=identificador, resultado=resultado, codigo_http=estado)
