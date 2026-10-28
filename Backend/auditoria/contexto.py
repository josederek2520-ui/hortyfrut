from contextvars import ContextVar

solicitud_actual = ContextVar('solicitud_auditoria', default=None)
