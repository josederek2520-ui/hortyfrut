from datetime import datetime
from zoneinfo import ZoneInfo


def nombre_respaldo(instante, consecutivo):
    fecha = instante.astimezone(ZoneInfo('America/La_Paz')) if isinstance(instante, datetime) else instante
    return f'hortyfru_{fecha:%d-%m-%Y}_{consecutivo:03d}.zip'
