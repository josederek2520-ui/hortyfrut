from decimal import Decimal
from django.http import FileResponse, Http404
from django.db.models import Q, Sum, Exists, OuterRef, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from clientes.models import Cliente, Sucursal
from pedidos.models import Pedido
from catalogos.models import CategoriaProducto
from productos.models import Producto
from almacenes.models import Almacen
from inventario.consultas import lotes_con_saldo, criterio_busqueda_lotes
from cajillas.models import Cajilla, MovimientoCajilla
from cajillas.consultas import sumar_cantidad
from .models import Preparacion, AsignacionPreparacion
from .consultas import detalles_con_avance, resumen_productos, version_hoja, datos_necesidad, ruta_imagen_preparacion
from .serializadores import SerializadorPreparacion, SerializadorPreparacionCompleta, SerializadorFiltrosPreparaciones
from .permisos import PermisosPreparaciones
from .servicios import guardar_preparacion, confirmar_preparacion, cancelar_preparacion, ConflictoPreparacion


class PaginacionPreparaciones(PaginacionDiez):
    page_query_param = 'pagina'


class PaginacionSucursales(PaginacionDiez):
    page_query_param = 'pagina_sucursales'


class VistaPreparaciones(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [PermisosPreparaciones]
    pagination_class = PaginacionPreparaciones
    modulo_auditoria = 'preparaciones'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def filtros(self):
        formulario = SerializadorFiltrosPreparaciones(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def contexto(self):
        filtros = self.filtros()
        if not filtros.get('cliente') or not filtros.get('fecha_pedidos'):
            raise ValidationError({'cliente': 'Selecciona un cliente y la fecha requerida de los pedidos.'})
        cliente = get_object_or_404(Cliente, pk=filtros['cliente'])
        return filtros, cliente, detalles_con_avance(filtros['fecha_pedidos'], cliente.pk)

    def get_queryset(self):
        consulta = Preparacion.objects.select_related('movimiento_salida', 'movimiento_aprovechable').prefetch_related('lineas__lote', 'lineas__lote_aprovechable', 'lineas__producto__categoria', 'cajillas',
            Prefetch('asignaciones', queryset=AsignacionPreparacion.objects.select_related('pedido', 'detalle_pedido', 'sucursal', 'producto__categoria').prefetch_related('aportes__linea__lote')))
        if self.action != 'list':
            return consulta
        filtros = self.filtros()
        for campo in ('cliente', 'fecha_pedidos', 'estado', 'almacen'):
            if campo in filtros:
                consulta = consulta.filter(**{campo: filtros[campo]})
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(cliente_nombre__icontains=buscar) | Q(almacen_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('PRE-')
            if codigo.isdigit():
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        return consulta

    def get_serializer_class(self):
        return SerializadorPreparacion if self.action == 'list' else SerializadorPreparacionCompleta

    def create(self, request):
        preparacion, creada = guardar_preparacion(request.user, request.data)
        return Response(SerializadorPreparacionCompleta(self.get_queryset().get(pk=preparacion.pk)).data, status=201 if creada else 200)

    def partial_update(self, request, pk=None):
        preparacion, _ = guardar_preparacion(request.user, request.data, self.get_object())
        return Response(SerializadorPreparacionCompleta(self.get_queryset().get(pk=preparacion.pk)).data)

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        preparacion = confirmar_preparacion(request.user, self.get_object(), request.data)
        return Response(SerializadorPreparacionCompleta(self.get_queryset().get(pk=preparacion.pk)).data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        preparacion = cancelar_preparacion(request.user, self.get_object(), request.data)
        return Response(SerializadorPreparacionCompleta(self.get_queryset().get(pk=preparacion.pk)).data)

    @action(detail=False, methods=['get'])
    def consolidado(self, request):
        filtros, cliente, base = self.contexto()
        version = version_hoja(base, cliente)
        if filtros.get('version_hoja') and filtros['version_hoja'] != version:
            raise ConflictoPreparacion('Los pedidos de la hoja cambiaron. Recarga la hoja completa.')
        consulta = base
        if filtros.get('categoria'):
            consulta = consulta.filter(producto__categoria_id=filtros['categoria'])
        if filtros.get('buscar'):
            consulta = consulta.filter(producto_nombre__icontains=filtros['buscar'])
        if filtros['vista'] == 'pendiente':
            consulta = consulta.filter(pendiente__gt=0)
        productos = self.paginate_queryset(resumen_productos(consulta))
        sucursales = Sucursal.objects.filter(pk__in=base.values('pedido__sucursal_id')).order_by('nombre', 'pk')
        paginador = PaginacionSucursales()
        columnas = paginador.paginate_queryset(sucursales, request, view=self)
        filas_celdas = consulta.filter(producto_id__in=[fila['producto_id'] for fila in productos], pedido__sucursal_id__in=[obj.pk for obj in columnas])
        celdas = {}
        for dato in filas_celdas.values('producto_id', 'pedido__sucursal_id', 'columna').annotate(solicitada=Sum('cantidad'), preparada=Sum('preparada'), restante=Sum('pendiente')):
            celdas.setdefault(dato['producto_id'], {}).setdefault(str(dato['pedido__sucursal_id']), {})[dato['columna']] = {
                'solicitada': dato['solicitada'], 'preparada': dato['preparada'], 'pendiente': dato['restante']}
        datos = [{'id': fila['producto_id'], 'nombre': fila['producto__nombre'], 'categoria': fila['producto__categoria__nombre'],
            'imagen': ruta_imagen_preparacion(fila['producto_id'], fila['producto__imagen'], cliente.pk, filtros['fecha_pedidos']),
            **{campo: fila[campo] for campo in ('cajas', 'unidades', 'preparadas_cajas', 'preparadas_unidades', 'pendientes_cajas', 'pendientes_unidades')},
            'sucursales': celdas.get(fila['producto_id'], {})} for fila in productos]
        pendientes = base.filter(pendiente__gt=0, pedido__estado='pendiente')
        respuesta = self.get_paginated_response(datos)
        respuesta.data.update({'cliente': {'id': cliente.pk, 'nombre': cliente.razon_social, 'activo': cliente.activo},
            'fecha_pedidos': str(filtros['fecha_pedidos']), 'version_hoja': version,
            'sucursales': {'count': sucursales.count(), 'results': [{'id': obj.pk, 'nombre': obj.nombre, 'activo': obj.activo} for obj in columnas]},
            'resumen': {'pedidos': base.values('pedido_id').distinct().count(), 'productos': base.values('producto_id').distinct().count(),
                'pedidos_pendientes': pendientes.values('pedido_id').distinct().count(), 'lineas_pendientes': pendientes.count()}})
        if version_hoja(detalles_con_avance(filtros['fecha_pedidos'], cliente.pk), cliente) != version:
            raise ConflictoPreparacion('Los pedidos cambiaron durante la consulta. Recarga la hoja.')
        return respuesta

    @action(detail=False, methods=['get'])
    def clientes(self, request):
        filtros = self.filtros()
        pedidos = Pedido.objects.filter(sucursal__cliente_id=OuterRef('pk')).exclude(estado='cancelado')
        if filtros.get('fecha_pedidos'):
            pedidos = pedidos.filter(fecha_requerida=filtros['fecha_pedidos'])
        consulta = Cliente.objects.annotate(tiene_pedidos=Exists(pedidos)).filter(tiene_pedidos=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(razon_social__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.razon_social, 'activo': obj.activo} for obj in self.paginate_queryset(consulta.order_by('razon_social', 'pk'))])

    @action(detail=False, methods=['get'])
    def categorias(self, request):
        filtros, _, base = self.contexto()
        consulta = CategoriaProducto.objects.filter(pk__in=base.values('producto__categoria_id'))
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre} for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    @action(detail=False, methods=['get'])
    def productos(self, request):
        filtros, cliente, base = self.contexto()
        consulta = base.filter(pendiente__gt=0, pedido__estado='pendiente')
        if filtros.get('categoria'):
            consulta = consulta.filter(producto__categoria_id=filtros['categoria'])
        if filtros.get('buscar'):
            consulta = consulta.filter(producto_nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': fila['producto_id'], 'nombre': fila['producto__nombre'], 'subtitulo': fila['producto__categoria__nombre'],
            'categoria': {'id': fila['producto__categoria_id'], 'nombre': fila['producto__categoria__nombre']},
            'imagen': ruta_imagen_preparacion(fila['producto_id'], fila['producto__imagen'], cliente.pk, filtros['fecha_pedidos']),
            'pendientes_cajas': fila['pendientes_cajas'], 'pendientes_unidades': fila['pendientes_unidades']}
            for fila in self.paginate_queryset(resumen_productos(consulta))])

    @action(detail=False, methods=['get'], url_path=r'imagenes/(?P<producto_pk>[0-9]+)')
    def imagen(self, request, producto_pk=None):
        filtros, cliente, base = self.contexto()
        historico = Preparacion.objects.filter(cliente=cliente, fecha_pedidos=filtros['fecha_pedidos']).filter(
            Q(lineas__producto_id=producto_pk) | Q(asignaciones__producto_id=producto_pk)).exists()
        if not base.filter(producto_id=producto_pk).exists() and not historico:
            raise Http404
        producto = get_object_or_404(Producto, pk=producto_pk)
        if not producto.imagen:
            raise Http404
        try:
            respuesta = FileResponse(producto.imagen.open('rb'), content_type='image/webp')
        except OSError as error:
            raise Http404 from error
        respuesta['Cache-Control'] = 'private, max-age=300'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta

    @action(detail=False, methods=['get'])
    def necesidades(self, request):
        filtros, _, base = self.contexto()
        consulta = base.filter(pendiente__gt=0, pedido__estado='pendiente').select_related('pedido__sucursal__cliente', 'producto__categoria')
        if filtros.get('producto'):
            consulta = consulta.filter(producto_id=filtros['producto'])
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(producto_nombre__icontains=filtros['buscar']) | Q(pedido__sucursal_nombre__icontains=filtros['buscar']))
        return self.get_paginated_response([datos_necesidad(obj) for obj in self.paginate_queryset(consulta.order_by('producto_nombre', 'pedido__sucursal_nombre', 'pedido_id', 'columna', 'pk'))])

    @action(detail=False, methods=['get'])
    def lotes(self, request):
        filtros, _, base = self.contexto()
        if not filtros.get('almacen') or not filtros.get('producto'):
            raise ValidationError({'almacen': 'Selecciona almacén y producto para consultar sus lotes.'})
        consulta = lotes_con_saldo(filtros['almacen']).filter(producto_id=filtros['producto'], producto_id__in=base.values('producto_id'), saldo__gt=0,
            estado='disponible', calidad='apto', producto__activo=True, producto__categoria__activo=True, unidad__activo=True,
            almacen_origen__activo=True, fecha_ingreso__lte=timezone.localdate()).filter(
                Q(fecha_vencimiento__isnull=True) | Q(fecha_vencimiento__gte=max(timezone.localdate(), filtros['fecha_pedidos'])))
        if filtros.get('buscar'):
            consulta = consulta.filter(criterio_busqueda_lotes(filtros['buscar']))
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.codigo, 'producto': obj.producto_id, 'producto_nombre': obj.producto_nombre,
            'unidad': obj.unidad_id, 'unidad_nombre': obj.unidad_nombre, 'unidad_abreviatura': obj.unidad_abreviatura,
            'saldo': format(obj.saldo, '.3f'), 'fecha_vencimiento': obj.fecha_vencimiento, 'es_kg': obj.unidad_abreviatura.casefold().strip() == 'kg'}
            for obj in self.paginate_queryset(consulta.order_by('fecha_vencimiento', 'fecha_ingreso', 'pk'))])

    @action(detail=False, methods=['get'])
    def almacenes(self, request):
        filtros = self.filtros()
        consulta = Almacen.objects.filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre} for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    @action(detail=False, methods=['get'])
    def sucursales(self, request):
        filtros, _, base = self.contexto()
        consulta = Sucursal.objects.filter(pk__in=base.values('pedido__sucursal_id'), activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(nombre__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.nombre} for obj in self.paginate_queryset(consulta.order_by('nombre', 'pk'))])

    @action(detail=False, methods=['get'])
    def colores(self, request):
        filtros = self.filtros()
        consulta = Cajilla.objects.all()
        if filtros.get('buscar'):
            consulta = consulta.filter(color__icontains=filtros['buscar'])
        pagina = self.paginate_queryset(consulta.order_by('color', 'pk'))
        cantidades = MovimientoCajilla.objects.filter(cajilla_id__in=[obj.pk for obj in pagina], almacen_id=filtros.get('almacen')).values('cajilla_id').annotate(
            saldo=sumar_cantidad(Q(tipo__in=['inicial', 'ingreso', 'devolucion'])) - sumar_cantidad(Q(tipo='salida')))
        saldos = {fila['cajilla_id']: fila['saldo'] for fila in cantidades}
        return self.get_paginated_response([{'id': obj.pk, 'nombre': obj.color, 'saldo': saldos.get(obj.pk, 0)} for obj in pagina])
