from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from almacenes.models import Almacen
from entregas.models import Entrega
from .models import Devolucion
from .permisos import PermisosDevoluciones
from .consultas import aportes_origen, representar_aporte
from .representaciones import origen_entrega, representar, representar_linea
from .serializadores import SerializadorFiltros, SerializadorOrigen
from . import servicios


class PaginacionDevoluciones(PaginacionDiez):
    page_query_param = 'pagina'


class VistaDevoluciones(viewsets.ViewSet):
    permission_classes = [PermisosDevoluciones]
    modulo_auditoria = 'devoluciones'
    lookup_value_regex = '[1-9][0-9]{0,14}'
    http_method_names = ['get', 'post', 'head', 'options']

    def paginar(self, consulta, transformar=lambda valor: valor, extras=None):
        paginador = PaginacionDevoluciones()
        pagina = paginador.paginate_queryset(consulta, self.request, view=self)
        respuesta = paginador.get_paginated_response([transformar(fila) for fila in pagina])
        respuesta.data.update(extras or {})
        return respuesta

    def filtros(self, clase=SerializadorFiltros):
        formulario = clase(data=self.request.query_params)
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def obtener(self, identificador):
        return get_object_or_404(Devolucion.objects.select_related('entrega', 'almacen', 'movimiento_ingreso',
            'movimiento_aprovechable', 'movimiento_salida_aprovechable', 'movimiento_merma'), pk=identificador)

    def list(self, request):
        filtros = self.filtros()
        consulta = Devolucion.objects.select_related('entrega')
        if filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
        if filtros.get('entrega'):
            consulta = consulta.filter(entrega_id=filtros['entrega'])
        if filtros.get('fecha'):
            consulta = consulta.filter(fecha_recepcion=filtros['fecha'])
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(cliente_nombre__icontains=buscar) | Q(sucursal_nombre__icontains=buscar) | Q(codigo_pedido__icontains=buscar) | Q(almacen_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('DEV-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        return self.paginar(consulta.order_by('-creado_en', '-pk'), lambda fila: representar(fila, completo=False))

    def retrieve(self, request, pk=None):
        return Response(representar(self.obtener(pk)))

    def ejecutar(self, funcion, *argumentos):
        try:
            devolucion = funcion(self.request.user, *argumentos)
        except IntegrityError as error:
            raise servicios.ConflictoDevolucion('La operación ya fue procesada o sus datos cambiaron. Recarga antes de continuar.') from error
        return Response(representar(self.obtener(devolucion.pk)))

    def create(self, request):
        return self.ejecutar(servicios.guardar_recepcion, request.data)

    @action(detail=True, methods=['post'])
    def guardar(self, request, pk=None):
        return self.ejecutar(servicios.guardar_recepcion, request.data, int(pk))

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        return self.ejecutar(servicios.recibir, int(pk), request.data)

    @action(detail=True, methods=['post'])
    def revision(self, request, pk=None):
        return self.ejecutar(servicios.guardar_revision, int(pk), request.data)

    @action(detail=True, methods=['post'])
    def revisar(self, request, pk=None):
        return self.ejecutar(servicios.revisar, int(pk), request.data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return self.ejecutar(servicios.cancelar, int(pk), request.data)

    @action(detail=False, methods=['get'])
    def entregas(self, request):
        filtros = self.filtros()
        consulta = Entrega.objects.filter(estado='confirmada', aportes__peso_recibido_kg__gt=0).distinct()
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(origen__cliente_nombre__icontains=buscar) | Q(origen__sucursal_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('ENT-').removeprefix('PED-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo)) | Q(pedido_id=int(codigo))
            consulta = consulta.filter(criterio)
        return self.paginar(consulta.order_by('-confirmado_en', '-pk'), origen_entrega)

    @action(detail=False, methods=['get'])
    def almacenes(self, request):
        filtros = self.filtros()
        consulta = Almacen.objects.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.paginar(consulta.order_by('nombre', 'pk'), lambda almacen: {'id': almacen.pk, 'nombre': almacen.nombre})

    @action(detail=False, methods=['get'])
    def origen(self, request):
        filtros = self.filtros(SerializadorOrigen)
        entrega = get_object_or_404(Entrega, pk=filtros['entrega'], estado='confirmada')
        consulta = aportes_origen(entrega)
        orden = list(consulta.values_list('pk', flat=True))
        if filtros.get('solo_anotados'):
            consulta = consulta.filter(pk__in=filtros.get('aportes', []))
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            consulta = consulta.filter(Q(lote__producto_nombre__icontains=buscar) | Q(lote__codigo_lote__icontains=buscar))
        return self.paginar(consulta, representar_aporte, {'entrega': origen_entrega(entrega), 'orden_aportes': orden, 'fecha_maxima': timezone.localdate()})

    @action(detail=True, methods=['get'])
    def lineas(self, request, pk=None):
        devolucion = self.obtener(pk)
        filtros = self.filtros()
        consulta = devolucion.lineas.select_related('aporte__lote__unidad', 'lote_retenido', 'lote_aprovechable').order_by('aporte_id')
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(aporte__lote__producto_nombre__icontains=filtros['buscar']) | Q(aporte__lote__codigo_lote__icontains=filtros['buscar']))
        aportes = {aporte.pk: aporte for aporte in aportes_origen(devolucion.entrega)}
        return self.paginar(consulta, lambda fila: representar_linea(fila, aportes[fila.aporte_id]))
