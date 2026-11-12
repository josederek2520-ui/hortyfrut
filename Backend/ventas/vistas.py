from decimal import Decimal
from io import BytesIO
from django.db import IntegrityError
from django.db.models import Q, Sum, Count
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from clientes.models import Cliente
from auditoria.servicios import registrar_actividad
from .models import Venta
from .permisos import PermisosVentas, autorizar
from .serializadores import SerializadorFiltros
from .consultas import entregas_pendientes, calcular_entrega, revisar_venta
from .representaciones import representar, lineas_emitidas
from . import servicios


class PaginacionVentas(PaginacionDiez):
    page_query_param = 'pagina'


class VistaVentas(viewsets.ViewSet):
    permission_classes = [PermisosVentas]
    modulo_auditoria = 'ventas'
    http_method_names = ['get', 'post', 'head', 'options']
    lookup_value_regex = '[1-9][0-9]{0,14}'

    def filtros(self):
        formulario = SerializadorFiltros(data=self.request.query_params)
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def paginar(self, consulta, transformar=lambda fila: fila, extra=None):
        paginador = PaginacionVentas()
        filas = paginador.paginate_queryset(consulta, self.request, view=self)
        respuesta = paginador.get_paginated_response([transformar(fila) for fila in filas])
        if extra:
            respuesta.data.update(extra)
        return respuesta

    def obtener(self, pk):
        return get_object_or_404(Venta.objects.select_related('cliente'), pk=pk)

    def list(self, request):
        filtros = self.filtros()
        consulta = Venta.objects.all()
        for campo in ['estado', 'cliente']:
            if filtros.get(campo):
                consulta = consulta.filter(**{campo: filtros[campo]})
        if filtros.get('desde'):
            consulta = consulta.filter(hasta__gte=filtros['desde'])
        if filtros.get('hasta'):
            consulta = consulta.filter(desde__lte=filtros['hasta'])
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(cliente_nombre__icontains=buscar) | Q(cliente_nit__icontains=buscar)
            codigo = buscar.upper().removeprefix('VEN-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        resumen = consulta.aggregate(emitidas=Count('pk', filter=Q(estado='emitida')), borradores=Count('pk', filter=Q(estado='borrador')),
            total=Sum('total', filter=Q(estado='emitida')))
        resumen['total'] = str(resumen['total'] or Decimal('0.00'))
        return self.paginar(consulta, lambda v: representar(v, False), {'resumen': resumen})

    def retrieve(self, request, pk=None):
        return Response(representar(self.obtener(pk)))

    def ejecutar(self, funcion, *argumentos):
        try:
            venta = funcion(self.request.user, *argumentos)
        except IntegrityError as error:
            raise servicios.ConflictoVenta('La entrega o la operación ya se registró. Recarga antes de continuar.') from error
        return Response(representar(self.obtener(venta.pk)))

    def create(self, request):
        return self.ejecutar(servicios.guardar, request.data)

    @action(detail=True, methods=['post'])
    def guardar(self, request, pk=None):
        return self.ejecutar(servicios.guardar, request.data, int(pk))

    @action(detail=True, methods=['post'])
    def emitir(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'emitir', request.data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'cancelar', request.data)

    @action(detail=False, methods=['get'])
    def clientes(self, request):
        filtros = self.filtros()
        consulta = Cliente.objects.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(razon_social__icontains=filtros['buscar']) | Q(nit__icontains=filtros['buscar']))
        return self.paginar(consulta.order_by('razon_social', 'pk'), lambda c: {'id': c.pk, 'nombre': c.razon_social, 'nit': c.nit})

    @action(detail=False, methods=['get'])
    def entregas(self, request):
        filtros = self.filtros()
        consulta = entregas_pendientes(filtros.get('cliente'))
        if filtros.get('desde'):
            consulta = consulta.filter(fecha_recepcion__gte=filtros['desde'])
        if filtros.get('hasta'):
            consulta = consulta.filter(fecha_recepcion__lte=filtros['hasta'])
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(origen__sucursal_nombre__icontains=buscar) | Q(origen__codigo_pedido__icontains=buscar)
            codigo = buscar.upper().removeprefix('ENT-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        return self.paginar(consulta.order_by('fecha_recepcion', 'pk'), lambda e: calcular_entrega(e, False))

    @action(detail=True, methods=['get'])
    def lineas(self, request, pk=None):
        venta = self.obtener(pk)
        revision = None if venta.estado == 'emitida' else revisar_venta(venta)
        filas = lineas_emitidas(venta) if revision is None else revision['lineas']
        return self.paginar(filas, extra={'revision': revision['revision'] if revision else ''})

    @action(detail=True, methods=['get'])
    def descargar(self, request, pk=None):
        from .documentos import generar_resumen_pdf
        venta = self.obtener(pk)
        if venta.estado != 'emitida':
            raise ValidationError('Emite la venta antes de descargar el resumen.')
        idioma = request.query_params.get('idioma', 'es')
        if idioma not in ['es', 'en']:
            raise ValidationError('Idioma de documento no admitido.')
        contenido = generar_resumen_pdf(representar(venta), lineas_emitidas(venta), idioma)
        actor = autorizar(request.user, 'descargar')
        registrar_actividad('ventas', 'descargar', actor=actor, objeto=venta, objeto_nombre=venta.codigo,
            cambios={}, descripcion='Descargar resumen de venta sin valor fiscal')
        respuesta = FileResponse(BytesIO(contenido), as_attachment=True, filename=f'{venta.codigo}.pdf', content_type='application/pdf')
        respuesta['Cache-Control'] = 'private, no-store'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta
