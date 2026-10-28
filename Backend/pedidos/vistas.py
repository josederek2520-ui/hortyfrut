from django.db.models import Count, Q, Prefetch
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from clientes.models import Sucursal
from productos.models import Producto
from catalogos.models import CategoriaProducto
from auditoria.servicios import nombre_responsable
from .models import Pedido, DetallePedido
from .permisos import PermisosPedidos, alcance_pedidos
from .serializadores import SerializadorPedido, SerializadorPedidoCompleto
from .servicios import guardar_pedido, cancelar_pedido


class PaginacionPedidos(PaginacionDiez):
    page_query_param = 'pagina'


class FiltrosPedidos(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, allow_blank=True, required=False)
    estado = serializers.ChoiceField(choices=Pedido.Estado.choices, required=False)
    fecha = serializers.DateField(required=False)


class VistaPedidos(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosPedidos]
    pagination_class = PaginacionPedidos
    modulo_auditoria = 'pedidos'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        consulta = alcance_pedidos(Pedido.objects.select_related('sucursal').prefetch_related(Prefetch('detalles', queryset=DetallePedido.objects.select_related('producto'))), self.request.user)
        if self.action not in ('list', 'resumen'):
            return consulta
        formulario = FiltrosPedidos(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        filtros = formulario.validated_data
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            consulta = consulta.filter(Q(cliente_nombre__icontains=buscar) | Q(sucursal_nombre__icontains=buscar) | Q(responsable_nombre__icontains=buscar) | (Q(pk=int(buscar.removeprefix('PED-'))) if buscar.removeprefix('PED-').isdigit() else Q(pk__in=[])))
        if filtros.get('fecha'):
            consulta = consulta.filter(fecha_requerida=filtros['fecha'])
        if filtros.get('estado') and self.action != 'resumen':
            consulta = consulta.filter(estado=filtros['estado'])
        return consulta

    def get_serializer_class(self):
        return SerializadorPedido if self.action == 'list' else SerializadorPedidoCompleto

    def create(self, request):
        pedido, creado = guardar_pedido(request.user, request.data)
        return Response(self.get_serializer(pedido).data, status=201 if creado else 200)

    def partial_update(self, request, pk=None):
        pedido, _ = guardar_pedido(request.user, request.data, self.get_object())
        return Response(self.get_serializer(pedido).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return Response(self.get_serializer(cancelar_pedido(request.user, self.get_object(), request.data)).data)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        return Response(self.get_queryset().aggregate(total=Count('pk'), pendientes=Count('pk', filter=Q(estado='pendiente')), preparados=Count('pk', filter=Q(estado='preparado')), cancelados=Count('pk', filter=Q(estado='cancelado'))))

    @action(detail=False, methods=['get'])
    def sucursales(self, request):
        consulta = Sucursal.objects.filter(activo=True, cliente__activo=True).select_related('cliente', 'encargado_pedidos')
        asignadas = list(consulta.filter(encargado_pedidos=request.user).order_by('pk')[:2])
        if not request.user.has_perm('pedidos.gestionar_todos_pedidos'):
            consulta = consulta.filter(encargado_pedidos=request.user)
        buscar = request.query_params.get('buscar', '')[:150]
        consulta = consulta.filter(Q(nombre__icontains=buscar) | Q(cliente__razon_social__icontains=buscar)).order_by('cliente__razon_social', 'nombre', 'pk')
        pagina = self.paginate_queryset(consulta)
        def datos_sucursal(sucursal):
            responsable = sucursal.encargado_pedidos if sucursal.encargado_pedidos_id and sucursal.encargado_pedidos.is_active else request.user
            return {'id': sucursal.pk, 'nombre': sucursal.nombre, 'cliente': sucursal.cliente.razon_social,
                    'responsable': nombre_responsable(responsable)}
        respuesta = self.get_paginated_response([datos_sucursal(sucursal) for sucursal in pagina])
        # La asignación se resuelve fuera de la página y de los filtros de búsqueda.
        respuesta.data['sucursal_asignada'] = datos_sucursal(asignadas[0]) if len(asignadas) == 1 else None
        return respuesta

    def pedido_edicion(self):
        identificador = self.request.query_params.get('pedido')
        if not identificador:
            return None
        if not identificador.isdigit():
            raise serializers.ValidationError({'pedido': 'Pedido inválido.'})
        return get_object_or_404(alcance_pedidos(Pedido.objects.all(), self.request.user), pk=identificador)

    @action(detail=False, methods=['get'])
    def categorias(self, request):
        consulta = CategoriaProducto.objects.filter(activo=True, nombre__icontains=request.query_params.get('buscar', '')[:100]).order_by('nombre', 'pk')
        return self.get_paginated_response([{'id': categoria.pk, 'nombre': categoria.nombre} for categoria in self.paginate_queryset(consulta)])

    @action(detail=False, methods=['get'])
    def catalogo(self, request):
        pedido = self.pedido_edicion()
        consulta = Producto.objects.select_related('categoria', 'unidad_medida').prefetch_related('presentaciones')
        criterio = Q(activo=True, categoria__activo=True, unidad_medida__activo=True)
        if pedido:
            criterio |= Q(pk__in=pedido.detalles.values('producto_id'))
        consulta = consulta.filter(criterio)
        consulta = consulta.filter(nombre__icontains=request.query_params.get('buscar', '')[:100])
        categoria = request.query_params.get('categoria')
        if categoria:
            if not categoria.isdigit():
                raise serializers.ValidationError({'categoria': 'Categoría inválida.'})
            consulta = consulta.filter(categoria_id=categoria)
        seleccionados = request.query_params.get('seleccionados')
        if seleccionados is not None:
            valores = seleccionados.split(',') if seleccionados else []
            if len(valores) > 500 or any(not valor.isdigit() for valor in valores):
                raise serializers.ValidationError({'seleccionados': 'Productos inválidos.'})
            consulta = consulta.filter(pk__in=valores)
        return self.get_paginated_response([self.datos_producto(producto) for producto in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    def datos_producto(self, producto):
        disponible = producto.activo and producto.categoria.activo and producto.unidad_medida.activo
        datos = {'id': producto.pk, 'nombre': producto.nombre, 'categoria': {'id': producto.categoria_id, 'nombre': producto.categoria.nombre},
                 'imagen': f'/api/v1/pedidos/imagenes/{producto.pk}/' if producto.imagen else None, 'cajas': None, 'unidades': None}
        for presentacion in producto.presentaciones.all():
            if presentacion.columna_pedido in ('cajas', 'unidades'):
                datos[presentacion.columna_pedido] = {'id': presentacion.pk, 'nombre': presentacion.nombre,
                    'disponible': disponible and presentacion.activo and presentacion.uso in ('pedido', 'ambos')}
        return datos

    @action(detail=False, methods=['get'], url_path=r'imagenes/(?P<producto_pk>[0-9]+)')
    def imagen(self, request, producto_pk=None):
        producto = get_object_or_404(Producto, pk=producto_pk)
        activo = producto.activo and producto.categoria.activo and producto.unidad_medida.activo
        historico = alcance_pedidos(Pedido.objects.filter(detalles__producto=producto), request.user).exists()
        if not producto.imagen or not (activo or historico):
            raise Http404
        try:
            respuesta = FileResponse(producto.imagen.open('rb'), content_type='image/webp')
        except FileNotFoundError:
            raise Http404
        respuesta['Cache-Control'] = 'private, no-store'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta
