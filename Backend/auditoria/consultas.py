"""Actividad operativa visible, sin modificar la evidencia técnica conservada."""
from django.db.models import Q

from .models import RegistroActividad


ACCIONES_CATALOGO = ('crear', 'editar', 'activar', 'desactivar')
ACCIONES_MODULOS = {
    **{modulo: ACCIONES_CATALOGO for modulo in (
        'unidades_medida', 'categorias_productos', 'productos', 'presentaciones',
        'clientes', 'sucursales', 'proveedores', 'almacenes', 'vehiculos',
    )},
    'usuarios': (*ACCIONES_CATALOGO, 'cambiar_contrasena', 'restablecer_contrasena'),
    'roles': ('crear', 'editar', 'eliminar', 'habilitar_acceso_movil'),
    'pedidos': ('crear', 'editar', 'cancelar'),
    'compras': ('crear', 'editar', 'registrar', 'cancelar'),
    'recepciones': ('crear', 'editar', 'confirmar', 'cancelar'),
    'preparaciones': ('crear', 'editar', 'confirmar', 'cancelar'),
    'lotes': ('bloquear_lote', 'desbloquear_lote'),
    'unidades_inventario': ('habilitar_unidad', 'inhabilitar_unidad'),
    # El saldo inicial pertenece al alta de la cajilla; carga y entrega al despacho.
    'cajillas': ('crear', 'registrar_ingreso', 'registrar_salida', 'registrar_devolucion'),
    'despachos': (
        'crear', 'editar', 'enviar', 'iniciar', 'llegar', 'descargar', 'descargar_pedido',
        'finalizar', 'cancelar_despacho', 'calcular_ruta', 'aprobar_ruta',
        'elegir_alternativa_ruta', 'solicitar_optimizacion', 'optimizacion_cancelada',
    ),
    'entregas': ('guardar', 'enviar', 'confirmar', 'devolver'),
    'devoluciones': ('guardar', 'guardar_revision', 'recibir', 'revisar', 'cancelar'),
    'precios': ('guardar', 'presentar', 'aceptar', 'rechazar', 'cancelar', 'nueva_version'),
    'ventas': ('guardar', 'emitir', 'cancelar', 'descargar'),
    # La finalización automática conserva evidencia, sin volver a contar la solicitud.
    'respaldos': ('solicitar_respaldo', 'descargar_respaldo'),
}

# Los rechazos HTTP pueden usar el nombre de la acción de la vista, previo al servicio.
ACCIONES_HTTP_ADICIONALES = {
    **{modulo: ('cambiar_estado',) for modulo, acciones in ACCIONES_MODULOS.items() if 'activar' in acciones},
    'lotes': ('cambiar_estado',),
    'unidades_inventario': ('crear', 'cambiar_estado'),
    'cajillas': ('registrar',),
    'despachos': ('cancelar', 'elegir_alternativa', 'optimizar_ruta', 'cancelar_optimizacion'),
    'entregas': ('hoja', 'operar'),
    'devoluciones': ('crear', 'revision'),
    'precios': ('crear',),
    'ventas': ('crear',),
    'respaldos': ('crear', 'descargar'),
}


def criterio_acciones(acciones_por_modulo):
    criterio = Q(pk__in=[])
    for modulo, acciones in acciones_por_modulo.items():
        criterio |= Q(modulo=modulo, accion__in=acciones)
    return criterio


def actividad_modulos():
    """Filtrar antes de contar/paginar; sirve también para los registros históricos.

    Un éxito necesita evidencia central del objeto afectado. El HTTP exitoso de
    respaldo no acredita otro cambio: puede ser un reintento o un guardado sin
    modificaciones. No agrupar por objeto, fecha o actor: dos operaciones reales
    sobre el mismo registro deben seguir siendo dos actividades.
    """
    principales = criterio_acciones(ACCIONES_MODULOS)
    exitosas = principales & Q(resultado='exito', codigo_http__isnull=True) & ~Q(objeto_tipo='')
    exitosas &= ~Q(accion='editar', cambios={}, origen__in=('api', 'sistema'))
    intentos = (principales | criterio_acciones(ACCIONES_HTTP_ADICIONALES)) & Q(
        resultado__in=('rechazado', 'error'), metodo__in=('POST', 'PUT', 'PATCH', 'DELETE'),
        codigo_http__gte=400,
    )
    # Descargar un respaldo es una operación explícita, aunque utilice GET.
    descarga_rechazada = Q(
        modulo__in=('respaldos', 'ventas'), accion='descargar', metodo='GET',
        resultado__in=('rechazado', 'error'), codigo_http__gte=400,
    )
    return RegistroActividad.objects.filter(exitosas | intentos | descarga_rechazada)
