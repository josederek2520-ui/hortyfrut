import hashlib
import json
import uuid
from collections import defaultdict
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from auditoria.servicios import registrar_actividad, nombre_responsable
from almacenes.models import Almacen
from cajillas.models import Cajilla, MovimientoCajilla
from cajillas.consultas import saldo_almacen
from cajillas.servicios import auditar_movimiento
from clientes.models import Cliente, Sucursal
from preparaciones.models import AsignacionPreparacion
from vehiculos.models import Vehiculo
from .models import Despacho, ParadaDespacho, CargaDespacho, CajillaDespacho, OperacionDespacho
from .consultas import choferes_habilitados, asignaciones_disponibles, contenido_asignacion
from .permisos import exigir_permiso, exigir_permiso_chofer
from .capacidad import validar_capacidad_viaje
from .serializadores import SerializadorEscrituraDespacho, SerializadorAccionDespacho, SerializadorDescargaPedido
from .descargas import anotar_descarga_pedido
from .cajillas_preparadas import agrupar_previsiones, previsiones_carga, matriz_cajillas, validar_previsiones, sincronizar_cajillas_automaticas


class ConflictoDespacho(APIException):
    status_code = 409
    default_detail = 'El despacho o su disponibilidad cambiaron. Recarga los datos antes de continuar.'


def huella_datos(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, default=str).encode()).hexdigest()


def version_despacho(despacho):
    return huella_datos([despacho.pk, despacho.actualizado_en.isoformat(), despacho.estado])


def comprobar_version(despacho, version):
    if version != version_despacho(despacho):
        raise ConflictoDespacho()


def comprobar_transporte(datos, bloquear=False):
    # Permitir las referencias FK de auditoría mientras se serializa la asignación.
    choferes = get_user_model().objects.select_for_update(no_key=True) if bloquear else get_user_model().objects
    chofer = get_object_or_404(choferes, pk=datos['chofer'])
    if not choferes_habilitados().filter(pk=chofer.pk).exists():
        raise ValidationError({'chofer': 'Selecciona un usuario activo autorizado como chofer.'})
    vehiculos = Vehiculo.objects.select_for_update(no_key=True) if bloquear else Vehiculo.objects
    vehiculo = get_object_or_404(vehiculos, pk=datos['vehiculo'])
    if not vehiculo.activo:
        raise ValidationError({'vehiculo': 'Selecciona un vehículo activo.'})
    return chofer, vehiculo


def estado_editor(despacho):
    return {'almacen': despacho.almacen_id, 'vehiculo': despacho.vehiculo_id, 'chofer': despacho.chofer_id,
            'fecha_reparto': str(despacho.fecha_reparto), 'observaciones': despacho.observaciones,
            'asignaciones': list(despacho.cargas.order_by('asignacion_id').values_list('asignacion_id', flat=True)),
            'orden_sucursales': list(despacho.paradas.order_by('orden').values_list('sucursal_id', flat=True)),
            'cajillas': list(despacho.cajillas.order_by('parada__orden', 'cajilla_id').values('parada__sucursal_id', 'cajilla_id', 'cantidad')),
            'cajillas_automaticas': despacho.cajillas_automaticas}


def guardar_despacho(actor, datos, instancia=None):
    exigir_permiso(actor, 'editar' if instancia else 'crear')
    try:
        with transaction.atomic():
            if not instancia:
                # Serializa reintentos de creación de una misma cuenta.
                get_object_or_404(get_user_model().objects.select_for_update(no_key=True), pk=actor.pk)
            despacho = get_object_or_404(Despacho.objects.select_for_update(), pk=instancia.pk) if instancia else None
            formulario = SerializadorEscrituraDespacho(despacho, data=datos)
            formulario.is_valid(raise_exception=True)
            valores = formulario.validated_data
            huella = huella_datos({campo: valor for campo, valor in valores.items() if campo not in ('version', 'clave_operacion')})
            if not instancia:
                anterior = Despacho.objects.filter(clave_operacion=valores['clave_operacion']).first()
                if anterior:
                    if anterior.responsable_id != actor.pk or anterior.huella_creacion != huella:
                        raise ConflictoDespacho('Esta clave ya se utilizó con otros datos o con otra cuenta.')
                    return anterior, False
            else:
                comprobar_version(despacho, valores['version'])
                if despacho.estado != 'borrador':
                    raise ValidationError({'estado': 'Solo se pueden editar los borradores.'})
                if despacho.enviado_en is not None:
                    raise ValidationError({'estado': 'El despacho ya está enviado al chofer y no admite cambios de carga o transporte.'})
            chofer, vehiculo = comprobar_transporte(valores)
            almacen = get_object_or_404(Almacen, pk=valores['almacen'], activo=True)
            # Bloquear únicamente las asignaciones; los aportes confirmados son inmutables.
            list(AsignacionPreparacion.objects.select_for_update().filter(pk__in=valores['asignaciones']).order_by('pk'))
            asignaciones = list(asignaciones_disponibles(despacho.pk if despacho else None).filter(pk__in=valores['asignaciones']))
            if len(asignaciones) != len(valores['asignaciones']):
                raise ConflictoDespacho('Parte de la carga ya está asignada a otro viaje o dejó de estar disponible.')
            if any(fila.preparacion.almacen_id != almacen.pk for fila in asignaciones):
                raise ValidationError({'almacen': 'Toda la carga debe pertenecer al almacén de salida.'})
            destinos = {fila.sucursal_id: fila.sucursal for fila in asignaciones}
            if set(destinos) != set(valores['orden_sucursales']):
                raise ValidationError({'orden_sucursales': 'Revisa las paradas: deben corresponder a las sucursales de la carga.'})
            if valores.get('cajillas_automaticas', False):
                previstas = agrupar_previsiones(previsiones_carga(
                    (fila.preparacion_id, fila.sucursal_id, fila.producto_id) for fila in asignaciones))
                validar_previsiones(previstas)
                if matriz_cajillas(previstas) != matriz_cajillas(valores['cajillas']):
                    raise ConflictoDespacho('Las cajillas previstas cambiaron. Actualiza la carga antes de guardar.')
                valores['cajillas'] = previstas
            colores = {fila.pk: fila for fila in Cajilla.objects.filter(pk__in=[fila['cajilla'] for fila in valores['cajillas']])}
            for fila in valores['cajillas']:
                if fila['sucursal'] not in destinos or fila['cajilla'] not in colores:
                    raise ValidationError({'cajillas': 'Selecciona un color válido y un destino incluido en el viaje.'})
            antes = estado_editor(despacho) if despacho else {}
            if not despacho:
                despacho = Despacho(responsable=actor, responsable_nombre=nombre_responsable(actor), clave_operacion=valores['clave_operacion'], huella_creacion=huella)
            despacho.almacen, despacho.almacen_nombre = almacen, almacen.nombre
            despacho.vehiculo, despacho.vehiculo_placa = vehiculo, vehiculo.placa
            despacho.chofer, despacho.chofer_nombre = chofer, nombre_responsable(chofer)
            despacho.fecha_reparto, despacho.observaciones = valores['fecha_reparto'], valores['observaciones']
            despacho.cajillas_automaticas = valores.get('cajillas_automaticas', False)
            despacho.save()
            despacho.paradas.all().delete()
            paradas = {}
            for orden, sucursal_id in enumerate(valores['orden_sucursales'], 1):
                sucursal = destinos[sucursal_id]
                paradas[sucursal_id] = ParadaDespacho.objects.create(despacho=despacho, sucursal=sucursal, cliente_nombre=sucursal.cliente.razon_social,
                    sucursal_nombre=sucursal.nombre, direccion=sucursal.direccion, orden=orden)
            CargaDespacho.objects.bulk_create([CargaDespacho(despacho=despacho, parada=paradas[fila.sucursal_id], asignacion=fila, contenido=contenido_asignacion(fila)) for fila in asignaciones])
            CajillaDespacho.objects.bulk_create([CajillaDespacho(despacho=despacho, parada=paradas[fila['sucursal']], cajilla=colores[fila['cajilla']],
                color=colores[fila['cajilla']].color, cantidad=fila['cantidad']) for fila in valores['cajillas']])
            registrar_actividad('despachos', 'editar' if instancia else 'crear', actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
                cambios={'antes': antes, 'despues': estado_editor(despacho)})
            return despacho, not instancia
    except IntegrityError as error:
        raise ConflictoDespacho('La carga, el vehículo o el chofer se están utilizando. Recarga para revisar la disponibilidad.') from error


def registrar_cajillas(actor, despacho, tipo, cajilla, cantidad, parada=None):
    clave = uuid.uuid5(despacho.clave_operacion, f'{tipo}:{cajilla.pk}:{parada.pk if parada else 0}')
    movimiento = MovimientoCajilla.objects.create(cajilla=cajilla, color=cajilla.color, tipo=tipo, cantidad=cantidad,
        almacen=despacho.almacen, almacen_nombre=despacho.almacen_nombre, despacho=despacho,
        sucursal_id=parada.sucursal_id if parada else None, sucursal_nombre=parada.sucursal_nombre if parada else '',
        cliente_nombre=parada.cliente_nombre if parada else '', responsable=actor, responsable_nombre=nombre_responsable(actor),
        observaciones=despacho.codigo, clave_operacion=clave, huella_operacion=huella_datos([despacho.pk, tipo, cajilla.pk, cantidad, parada.pk if parada else None]))
    auditar_movimiento(actor, movimiento)


def ejecutar_accion(actor, instancia, accion, datos, *, como_chofer=False):
    try:
        return _ejecutar_accion(actor, instancia, accion, datos, como_chofer=como_chofer)
    except IntegrityError as error:
        restriccion = getattr(getattr(error.__cause__, 'diag', None), 'constraint_name', '')
        if 'clave_operacion' in restriccion or restriccion in ('despacho_vehiculo_en_ruta_unico', 'despacho_chofer_en_ruta_unico'):
            raise ConflictoDespacho() from error
        raise


@transaction.atomic
def _ejecutar_accion(actor, instancia, accion, datos, *, como_chofer=False):
    if como_chofer:
        from rest_framework.exceptions import PermissionDenied
        exigir_permiso_chofer(actor, operar=True)
        if accion not in ('iniciar', 'llegar', 'descargar', 'descargar_pedido', 'finalizar'):
            raise PermissionDenied('Esta operación corresponde al administrador de despachos.')
    else:
        exigir_permiso(actor, 'recorrido' if accion in ('llegar', 'descargar', 'descargar_pedido') else accion)
    formulario = (SerializadorDescargaPedido if accion == 'descargar_pedido' else SerializadorAccionDespacho)(data=datos)
    formulario.is_valid(raise_exception=True)
    valores = formulario.validated_data
    if (accion in ('llegar', 'descargar', 'descargar_pedido')) != ('parada' in valores):
        raise ValidationError({'parada': 'Selecciona una parada únicamente para registrar llegada o descarga.'})
    consulta = Despacho.objects.select_for_update()
    if como_chofer:
        from django.db.models import Q
        consulta = consulta.filter(chofer=actor).filter(Q(enviado_en__isnull=False) | Q(estado__in=['en_ruta', 'finalizado']))
    despacho = get_object_or_404(consulta, pk=instancia.pk)
    referencia_operacion = [despacho.pk, accion, valores.get('parada')]
    if accion == 'descargar_pedido':
        referencia_operacion.extend([valores['pedido'], sorted(valores['cargas_comprobadas'])])
    huella = huella_datos(referencia_operacion)
    anterior = OperacionDespacho.objects.filter(clave_operacion=valores['clave_operacion']).first()
    if anterior:
        if anterior.responsable_id != actor.pk or anterior.huella != huella:
            raise ConflictoDespacho('Esta clave ya se utilizó para otra operación o cuenta.')
        return despacho
    comprobar_version(despacho, valores['version'])
    antes = despacho.estado
    datos_envio = None
    descarga = None
    if accion in ('iniciar', 'cancelar', 'enviar') and despacho.estado != 'borrador':
        raise ValidationError({'estado': 'Esta operación requiere un despacho en borrador.'})
    if accion in ('llegar', 'descargar', 'descargar_pedido', 'finalizar') and despacho.estado != 'en_ruta':
        raise ValidationError({'estado': 'Esta operación requiere un despacho en ruta.'})
    if accion == 'cancelar':
        despacho.estado = 'cancelado'
        despacho.cargas.update(activa=False)
    elif accion == 'iniciar':
        # Mantener Cliente -> Sucursal -> Color -> Almacén antes de fijar el plan.
        # Si el plan dejó de ser válido, la transacción revierte también las cajillas.
        iniciar_viaje(actor, despacho)
        from .rutas_carretera import fijar_ruta_vigente
        fijar_ruta_vigente(actor, despacho, exigir_aprobada=como_chofer)
    elif accion == 'enviar':
        if despacho.enviado_en is not None:
            raise ValidationError({'estado': 'El despacho ya está disponible para el chofer.'})
        _, _, datos_envio = comprobar_carga_viaje(despacho)
        get_object_or_404(Almacen, pk=despacho.almacen_id, activo=True)
        sincronizar_cajillas_automaticas(despacho)
        despacho.enviado_en = timezone.now()
        despacho.enviado_por = actor
        despacho.enviado_por_nombre = nombre_responsable(actor)
    elif accion in ('llegar', 'descargar', 'descargar_pedido'):
        parada = get_object_or_404(ParadaDespacho, pk=valores['parada'], despacho=despacho)
        siguiente = despacho.paradas.filter(descargada_en__isnull=True).order_by('orden').first()
        if not siguiente or siguiente.pk != parada.pk:
            raise ValidationError({'parada': 'Completa primero la siguiente parada del recorrido.'})
        if accion == 'llegar':
            if parada.llegada_en:
                raise ValidationError({'parada': 'La llegada ya está registrada.'})
            parada.llegada_en = timezone.now()
        else:
            if not parada.llegada_en:
                raise ValidationError({'parada': 'Registra la llegada antes de confirmar la descarga.'})
            descarga = anotar_descarga_pedido(parada, actor, valores.get('pedido'), valores.get('cargas_comprobadas'), como_chofer)
            if descarga['parada_completa']:
                filas = list(parada.cajillas.select_related('cajilla').order_by('cajilla_id'))
                # Mismo orden que las operaciones manuales: Cliente -> Sucursal -> Color.
                referencia = Sucursal.objects.get(pk=parada.sucursal_id)
                Cliente.objects.select_for_update().get(pk=referencia.cliente_id)
                Sucursal.objects.select_for_update().get(pk=referencia.pk)
                list(Cajilla.objects.select_for_update().filter(pk__in=[fila.cajilla_id for fila in filas]).order_by('pk'))
                for fila in filas:
                    registrar_cajillas(actor, despacho, 'entrega', fila.cajilla, fila.cantidad, parada)
                parada.descargada_en = descarga['momento']
        parada.save()
    elif accion == 'finalizar':
        if not despacho.paradas.exists() or despacho.paradas.filter(descargada_en__isnull=True).exists():
            raise ValidationError({'estado': 'Completa las descargas de todas las paradas antes de finalizar.'})
        despacho.estado, despacho.retorno_en = 'finalizado', timezone.now()
    despacho.save()
    if accion == 'finalizar':
        from .seguimiento import cerrar_seguimientos_viaje
        cerrar_seguimientos_viaje(despacho, actor)
    OperacionDespacho.objects.create(despacho=despacho, accion=accion, clave_operacion=valores['clave_operacion'], huella=huella,
        responsable=actor, responsable_nombre=nombre_responsable(actor))
    registrar_actividad('despachos', 'cancelar_despacho' if accion == 'cancelar' else accion, actor=actor, objeto=despacho, objeto_nombre=despacho.codigo,
        cambios={'estado': {'antes': antes, 'despues': despacho.estado}, 'parada': valores.get('parada'),
                 **({'cajillas': {'automaticas': despacho.cajillas_automaticas,
                                 'asignadas': list(despacho.cajillas.order_by('parada__sucursal_id', 'cajilla_id').values('parada__sucursal_id', 'cajilla_id', 'cantidad'))}}
                    if accion in ('enviar', 'iniciar') else {}),
                 **({'descarga': {'pedido': valores.get('pedido'), 'pedidos_descargados': descarga['pedidos_descargados'],
                                  'cargas_descargadas': descarga['cargas_descargadas'], 'parada_completa': descarga['parada_completa']}} if descarga else {}),
                 **({'envio': {'version_origen': valores['version'], 'version_resultante': version_despacho(despacho),
                               'chofer': despacho.chofer_id, 'vehiculo': despacho.vehiculo_id, **datos_envio}} if datos_envio else {})})
    from .eventos_supervision import avisar_cambio_despacho
    avisar_cambio_despacho(despacho.pk)
    return despacho


def comprobar_carga_viaje(despacho):
    chofer, vehiculo = comprobar_transporte({'chofer': despacho.chofer_id, 'vehiculo': despacho.vehiculo_id}, bloquear=True)
    if Despacho.objects.filter(estado='en_ruta').filter(criterio_transporte(chofer.pk, vehiculo.pk)).exists():
        raise ConflictoDespacho('El vehículo o el chofer ya tiene un viaje en ruta.')
    cargas = list(despacho.cargas.all())
    if not cargas:
        raise ValidationError({'asignaciones': 'Selecciona al menos una carga preparada antes de iniciar.'})
    destinos = list(despacho.paradas.values_list('sucursal_id', flat=True))
    list(Cliente.objects.select_for_update().filter(sucursales__pk__in=destinos).order_by('pk'))
    sucursales = list(Sucursal.objects.select_for_update().filter(pk__in=destinos).select_related('cliente').order_by('pk'))
    if any(not fila.activo or not fila.cliente.activo for fila in sucursales):
        raise ValidationError({'asignaciones': 'Hay destinos inactivos. Revisa la carga antes de salir.'})
    actuales = {fila.pk: fila for fila in asignaciones_disponibles(despacho.pk).filter(pk__in=[fila.asignacion_id for fila in cargas])}
    if len(actuales) != len(cargas) or any(contenido_asignacion(actuales[fila.asignacion_id]) != fila.contenido for fila in cargas):
        raise ConflictoDespacho('La carga preparada cambió. Revisa el borrador antes de salir.')
    resultado_capacidad = validar_capacidad_viaje(vehiculo, (fila.contenido for fila in cargas))
    return chofer, vehiculo, resultado_capacidad


def iniciar_viaje(actor, despacho):
    from .optimizacion.servicios import comprobar_calculo_activo
    comprobar_calculo_activo(despacho)
    chofer, vehiculo, _ = comprobar_carga_viaje(despacho)
    sincronizar_cajillas_automaticas(despacho)
    cantidades = defaultdict(int)
    for fila in despacho.cajillas.all():
        cantidades[fila.cajilla_id] += fila.cantidad
        if cantidades[fila.cajilla_id] > 2147483647:
            raise ValidationError({'cajillas': 'La carga total de un color supera el máximo admitido por movimiento.'})
    colores = list(Cajilla.objects.select_for_update().filter(pk__in=cantidades).order_by('pk'))
    almacen = get_object_or_404(Almacen.objects.select_for_update(), pk=despacho.almacen_id)
    if not almacen.activo:
        raise ValidationError({'almacen': 'El almacén de salida está inactivo.'})
    for color in colores:
        disponible = saldo_almacen(color.pk, almacen.pk)
        if cantidades[color.pk] > disponible:
            raise ValidationError({'cajillas': f'Solo hay {disponible} cajillas de color {color.color} disponibles en el almacén.'})
        registrar_cajillas(actor, despacho, 'carga', color, cantidades[color.pk])
    despacho.vehiculo_placa, despacho.chofer_nombre = vehiculo.placa, nombre_responsable(chofer)
    despacho.almacen_nombre = almacen.nombre
    despacho.estado, despacho.salida_en = 'en_ruta', timezone.now()


def criterio_transporte(chofer_id, vehiculo_id):
    from django.db.models import Q
    return Q(chofer_id=chofer_id) | Q(vehiculo_id=vehiculo_id)
