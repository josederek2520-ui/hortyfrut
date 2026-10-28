from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from catalogos.models import CategoriaProducto
from productos.models import Producto, PresentacionProducto
from proveedores.models import Proveedor
from .consultas import necesidades_fecha, resumen_productos, datos_necesidad
from .models import Compra
from .permisos import PermisosCompras
from .serializadores import (SerializadorCompra, SerializadorCompraCompleta, SerializadorFiltrosCompras,
                            SerializadorNecesidades, SerializadorOpcionesCompras)
from .servicios import guardar_compra, registrar_compra, cancelar_compra


class PaginacionCompras(PaginacionDiez):
    page_query_param = 'pagina'


class VistaCompras(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosCompras]
    pagination_class = PaginacionCompras
    modulo_auditoria = 'compras'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = Compra.objects.prefetch_related('detalles', 'pedidos_referencia')
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = SerializadorFiltrosCompras(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(responsable_nombre__icontains=buscar) | Q(detalles__producto_nombre__icontains=buscar) | Q(detalles__proveedor_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('COM-')
            if codigo.isdigit():
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio).distinct()
        for campo in ('fecha_pedidos', 'fecha_compra'):
            if campo in filtros:
                consulta = consulta.filter(**{campo: filtros[campo]})
        if self.action != 'resumen' and 'estado' in filtros:
            consulta = consulta.filter(estado=filtros['estado'])
        return consulta.order_by('-creado_en', '-pk')

    def get_serializer_class(self):
        return SerializadorCompra if self.action == 'list' else SerializadorCompraCompleta

    def create(self, request):
        compra, creada = guardar_compra(request.user, request.data)
        return Response(SerializadorCompraCompleta(compra).data, status=201 if creada else 200)

    def partial_update(self, request, pk=None):
        compra, _ = guardar_compra(request.user, request.data, self.get_object())
        return Response(SerializadorCompraCompleta(compra).data)

    @action(detail=True, methods=['post'])
    def registrar(self, request, pk=None):
        return Response(SerializadorCompraCompleta(registrar_compra(request.user, self.get_object(), request.data)).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return Response(SerializadorCompraCompleta(cancelar_compra(request.user, self.get_object(), request.data)).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk', distinct=True),
                        borradores=Count('pk', filter=Q(estado='borrador'), distinct=True),
                        registradas=Count('pk', filter=Q(estado='registrada'), distinct=True),
                        canceladas=Count('pk', filter=Q(estado='cancelada'), distinct=True)))

    @action(detail=False, methods=['get'])
    def necesidades(self, request):
        formulario = SerializadorNecesidades(data=request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        consulta = necesidades_fecha(filtros['fecha_pedidos'])
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(producto_nombre__icontains=filtros['buscar']) | Q(producto__nombre__icontains=filtros['buscar']))
        resumen = consulta.aggregate(pedidos=Count('pedido_id', distinct=True), sucursales=Count('pedido__sucursal_id', distinct=True), productos=Count('producto_id', distinct=True))
        if filtros['vista'] == 'resumen':
            pagina = self.paginate_queryset(resumen_productos(consulta))
            datos = [{'id': fila['producto_id'], 'nombre': fila['producto__nombre'], 'unidad_nombre': fila['producto__unidad_medida__nombre'],
                      'disponible': fila['producto__activo'] and fila['producto__categoria__activo'] and fila['producto__unidad_medida__activo'],
                      'cajas': fila['cajas'], 'unidades': fila['unidades'], 'pedidos': fila['pedidos']} for fila in pagina]
        else:
            pagina = self.paginate_queryset(consulta.select_related('pedido').order_by('pedido__cliente_nombre', 'pedido__sucursal_nombre', 'pedido_id', 'producto_nombre', 'columna', 'pk'))
            datos = [datos_necesidad(linea) for linea in pagina]
        respuesta = self.get_paginated_response(datos)
        respuesta.data.update({'fecha_pedidos': filtros['fecha_pedidos'].isoformat(), 'resumen': resumen,
                               'compras_registradas': Compra.objects.filter(fecha_pedidos=filtros['fecha_pedidos'], estado='registrada').count()})
        return respuesta

    def filtros_opciones(self):
        formulario = SerializadorOpcionesCompras(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    @action(detail=False, methods=['get'])
    def productos(self, request):
        filtros = self.filtros_opciones()
        consulta = Producto.objects.select_related('categoria', 'unidad_medida').filter(activo=True, categoria__activo=True, unidad_medida__activo=True)
        if 'categoria' in filtros:
            consulta = consulta.filter(categoria_id=filtros['categoria'])
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        pagina = self.paginate_queryset(consulta.order_by('nombre', 'pk'))
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre, 'unidad_nombre': obj.unidad_medida.nombre,
                                           'subtitulo': obj.categoria.nombre,
                                           'categoria': {'id': obj.categoria_id, 'nombre': obj.categoria.nombre}} for obj in pagina])

    @action(detail=False, methods=['get'])
    def categorias(self, request):
        filtros = self.filtros_opciones()
        consulta = CategoriaProducto.objects.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        pagina = self.paginate_queryset(consulta.order_by('nombre', 'pk'))
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre} for obj in pagina])

    @action(detail=False, methods=['get'])
    def proveedores(self, request):
        filtros = self.filtros_opciones()
        consulta = Proveedor.objects.select_related('categoria').filter(activo=True)
        categoria_producto = None
        if 'producto' in filtros:
            producto = Producto.objects.select_related('categoria').filter(pk=filtros['producto']).first()
            if producto is None:
                raise ValidationError({'producto': 'El producto seleccionado no existe.'})
            categoria_producto = {'id': producto.categoria_id, 'nombre': producto.categoria.nombre}
            if not filtros['todos'] and 'categoria' not in filtros:
                consulta = consulta.filter(categoria_id=producto.categoria_id)
        if 'categoria' in filtros:
            consulta = consulta.filter(categoria_id=filtros['categoria'])
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(nombre__icontains=filtros['buscar']) | Q(telefono__icontains=filtros['buscar']))
        pagina = self.paginate_queryset(consulta.order_by('nombre', 'pk'))
        respuesta = self.get_paginated_response([
            {'id': obj.pk, 'nombre': obj.nombre, 'subtitulo': obj.telefono,
             'categoria': {'id': obj.categoria_id, 'nombre': obj.categoria.nombre} if obj.categoria_id else None}
            for obj in pagina
        ])
        respuesta.data['categoria_producto'] = categoria_producto
        return respuesta

    @action(detail=False, methods=['get'])
    def presentaciones(self, request):
        filtros = self.filtros_opciones()
        if 'producto' not in filtros:
            raise ValidationError({'producto': 'Selecciona primero un producto.'})
        consulta = PresentacionProducto.objects.filter(producto_id=filtros['producto'], activo=True, uso__in=['compra', 'ambos'])
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        pagina = self.paginate_queryset(consulta.order_by('nombre', 'pk'))
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre} for obj in pagina])
