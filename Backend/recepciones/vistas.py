from decimal import Decimal
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from almacenes.models import Almacen
from productos.models import Producto
from inventario.consultas import unidades_habilitadas, es_kilogramo
from .consultas import avance_compra, compras_pendientes, detalles_con_pendiente
from .models import Recepcion
from .permisos import PermisosRecepciones
from .serializadores import (SerializadorRecepcion, SerializadorRecepcionCompleta,
                            SerializadorFiltrosRecepciones, SerializadorOpcionesRecepciones)
from .servicios import guardar_recepcion, confirmar_recepcion, cancelar_recepcion


class PaginacionRecepciones(PaginacionDiez):
    page_query_param = 'pagina'


def datos_unidad(unidad):
    return {'id': unidad.pk, 'nombre': unidad.nombre, 'abreviatura': unidad.abreviatura, 'es_kg': es_kilogramo(unidad)}


class VistaRecepciones(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosRecepciones]
    pagination_class = PaginacionRecepciones
    modulo_auditoria = 'recepciones'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_serializer_class(self):
        return SerializadorRecepcion if self.action == 'list' else SerializadorRecepcionCompleta

    def get_queryset(self):
        consulta = Recepcion.objects.select_related('compra', 'movimiento').prefetch_related('detalles__lote', 'detalles__detalle_compra')
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = SerializadorFiltrosRecepciones(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(almacen_nombre__icontains=buscar) | Q(detalles__producto_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('REC-')
            if codigo.isdigit():
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio).distinct()
        for campo in ('compra', 'almacen'):
            if campo in filtros:
                consulta = consulta.filter(**{f'{campo}_id': filtros[campo]})
        if filtros.get('fecha'):
            consulta = consulta.filter(fecha_recepcion=filtros['fecha'])
        if self.action != 'resumen' and filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
        return consulta.order_by('-creado_en', '-pk')

    def create(self, request):
        recepcion, creada = guardar_recepcion(request.user, request.data)
        return Response(SerializadorRecepcionCompleta(recepcion).data, status=201 if creada else 200)

    def partial_update(self, request, pk=None):
        recepcion, _ = guardar_recepcion(request.user, request.data, self.get_object())
        return Response(SerializadorRecepcionCompleta(recepcion).data)

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        return Response(SerializadorRecepcionCompleta(confirmar_recepcion(request.user, self.get_object(), request.data)).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return Response(SerializadorRecepcionCompleta(cancelar_recepcion(request.user, self.get_object(), request.data)).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk', distinct=True),
            borradores=Count('pk', filter=Q(estado='borrador'), distinct=True),
            confirmadas=Count('pk', filter=Q(estado='confirmada'), distinct=True),
            canceladas=Count('pk', filter=Q(estado='cancelada'), distinct=True)))

    def filtros_opciones(self):
        formulario = SerializadorOpcionesRecepciones(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    @action(detail=False, methods=['get'])
    def compras(self, request):
        filtros = self.filtros_opciones()
        consulta = compras_pendientes().filter(tiene_pendientes=True)
        if filtros.get('buscar'):
            codigo = filtros['buscar'].upper().removeprefix('COM-')
            consulta = consulta.filter(pk=int(codigo)) if codigo.isdigit() else consulta.filter(responsable_nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': compra.pk, 'nombre': compra.codigo, 'subtitulo': compra.fecha_compra.isoformat(),
            'fecha_compra': compra.fecha_compra.isoformat()} for compra in self.paginate_queryset(consulta.order_by('-fecha_compra', '-pk'))])

    def compra_origen_objeto(self):
        filtros = self.filtros_opciones()
        if not filtros.get('compra'):
            raise ValidationError({'compra': 'Selecciona una compra registrada.'})
        return get_object_or_404(compras_pendientes(), pk=filtros['compra'])

    @action(detail=False, methods=['get'], url_path='compra-origen')
    def compra_origen(self, request):
        compra = self.compra_origen_objeto()
        return Response({'id': compra.pk, 'nombre': compra.codigo, 'fecha_compra': compra.fecha_compra,
                         'tiene_pendientes': compra.tiene_pendientes})

    @action(detail=False, methods=['get'], url_path='compra-detalles')
    def compra_detalles(self, request):
        compra = self.compra_origen_objeto()
        consulta = compra.detalles.select_related('producto__categoria', 'producto__unidad_medida').order_by('producto_nombre', 'pk')
        filtros = self.filtros_opciones()
        buscar = filtros.get('buscar')
        if filtros['solo_pendientes']:
            consulta = detalles_con_pendiente(consulta)
        if buscar:
            consulta = consulta.filter(producto_nombre__icontains=buscar)
        recibidos = avance_compra(compra.pk)
        datos = []
        for linea in self.paginate_queryset(consulta):
            producto = linea.producto
            recibido = recibidos.get(linea.pk, Decimal('0'))
            pendiente = max(Decimal('0'), linea.cantidad - recibido)
            datos.append({'id': linea.pk, 'nombre': linea.producto_nombre, 'producto': linea.producto_id,
                'proveedor_nombre': linea.proveedor_nombre,
                'unidad_compra': linea.unidad_medida_id if linea.presentacion_id is None else None,
                'medida_compra': linea.presentacion_nombre or linea.unidad_nombre, 'cantidad_comprada': str(linea.cantidad),
                'cantidad_recibida': str(recibido), 'cantidad_pendiente': str(pendiente), 'unidad': datos_unidad(producto.unidad_medida),
                'disponible': pendiente > 0 and producto.activo and producto.categoria.activo and producto.unidad_medida.activo})
        return self.get_paginated_response(datos)

    @action(detail=False, methods=['get'])
    def almacenes(self, request):
        filtros = self.filtros_opciones()
        consulta = Almacen.objects.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre, 'subtitulo': obj.direccion}
            for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    @action(detail=False, methods=['get'])
    def productos(self, request):
        filtros = self.filtros_opciones()
        consulta = Producto.objects.select_related('unidad_medida', 'categoria').filter(activo=True, categoria__activo=True, unidad_medida__activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'producto': obj.pk, 'nombre': obj.nombre, 'subtitulo': obj.categoria.nombre,
            'unidad': datos_unidad(obj.unidad_medida), 'disponible': True}
            for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    @action(detail=False, methods=['get'])
    def unidades(self, request):
        filtros = self.filtros_opciones()
        producto = get_object_or_404(Producto, pk=filtros.get('producto'))
        consulta = unidades_habilitadas(producto)
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(nombre__icontains=filtros['buscar']) | Q(abreviatura__icontains=filtros['buscar']))
        return self.get_paginated_response([datos_unidad(obj) for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])
