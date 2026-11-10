"""Previsiones por preparación, producto y destino; sin equivalencias ni movimientos."""
from collections import defaultdict

from rest_framework.exceptions import ValidationError

from cajillas.models import Cajilla
from preparaciones.models import CajillaPrevista
from .models import CajillaDespacho


def previsiones_carga(referencias):
    referencias = set(referencias)
    if not referencias:
        return []
    pares = {(preparacion, sucursal) for preparacion, sucursal, _ in referencias}
    consulta = CajillaPrevista.objects.filter(
        preparacion_id__in={fila[0] for fila in referencias},
        sucursal_id__in={fila[1] for fila in referencias},
    ).order_by('preparacion_id', 'sucursal_id', 'producto_id', 'cajilla_id').values(
        'preparacion_id', 'sucursal_id', 'producto_id', 'cajilla_id', 'color', 'cantidad')
    return [fila for fila in consulta if
            (fila['preparacion_id'], fila['sucursal_id'], fila['producto_id']) in referencias
            or (fila['producto_id'] is None and (fila['preparacion_id'], fila['sucursal_id']) in pares)]


def agrupar_previsiones(previsiones):
    unicas = {(fila['preparacion_id'], fila['sucursal_id'], fila['producto_id'], fila['cajilla_id']): fila
              for fila in previsiones}
    cantidades = defaultdict(int)
    colores = {}
    for fila in unicas.values():
        clave = (fila['sucursal_id'], fila['cajilla_id'])
        cantidades[clave] += fila['cantidad']
        colores[clave] = fila['color']
    return [{'sucursal': sucursal, 'cajilla': cajilla, 'color': colores[sucursal, cajilla], 'cantidad': cantidad}
            for (sucursal, cajilla), cantidad in sorted(cantidades.items())]


def referencias_despacho(despacho):
    return {(fila.contenido['preparacion'], fila.contenido['sucursal'], fila.contenido['producto'])
            for fila in despacho.cargas.all()}


def sugeridas_despacho(despacho):
    if despacho.estado != 'borrador' or despacho.enviado_en is not None:
        return []
    return agrupar_previsiones(previsiones_carga(referencias_despacho(despacho)))


def usa_cajillas_automaticas(despacho):
    if despacho.estado != 'borrador' or despacho.enviado_en is not None:
        return False
    if despacho.cajillas_automaticas is not None:
        return despacho.cajillas_automaticas
    # Recuperación del borrador anterior: una lista guardada se conserva como manual.
    return not despacho.cajillas.all()


def matriz_cajillas(filas):
    return sorted((fila['sucursal'], fila['cajilla'], fila['cantidad']) for fila in filas)


def validar_previsiones(filas):
    if len(filas) > 1000 or any(not 1 <= fila['cantidad'] <= 2147483647 for fila in filas):
        raise ValidationError({'cajillas': 'Las cajillas previstas superan el límite del despacho. Revisa la carga seleccionada.'})


def sincronizar_cajillas_automaticas(despacho):
    """Se invoca dentro de enviar/iniciar; nunca desde una consulta ni tras el envío."""
    if not usa_cajillas_automaticas(despacho):
        return False
    previstas = sugeridas_despacho(despacho)
    validar_previsiones(previstas)
    actuales = [{'sucursal': fila.parada.sucursal_id, 'cajilla': fila.cajilla_id, 'cantidad': fila.cantidad}
                for fila in despacho.cajillas.select_related('parada')]
    if matriz_cajillas(actuales) != matriz_cajillas(previstas):
        paradas = {fila.sucursal_id: fila for fila in despacho.paradas.all()}
        colores = {fila.pk: fila for fila in Cajilla.objects.filter(pk__in=[fila['cajilla'] for fila in previstas])}
        if any(fila['sucursal'] not in paradas or fila['cajilla'] not in colores for fila in previstas):
            raise ValidationError({'cajillas': 'Revisa los colores y destinos de las cajillas previstas.'})
        despacho.cajillas.all().delete()
        CajillaDespacho.objects.bulk_create([
            CajillaDespacho(despacho=despacho, parada=paradas[fila['sucursal']], cajilla=colores[fila['cajilla']],
                            color=colores[fila['cajilla']].color, cantidad=fila['cantidad']) for fila in previstas])
        despacho._prefetched_objects_cache = {}
    despacho.cajillas_automaticas = True
    return True
