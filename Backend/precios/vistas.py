from django.db import IntegrityError
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from config.paginacion import PaginacionDiez
from clientes.models import Cliente
from productos.models import Producto
from entregas.models import Entrega
from .permisos import PermisosPrecios, es_supermercado, clientes_permitidos, acuerdos_permitidos
from .origen_pedidos import ConsultaPedidosPrecio, productos_pedidos, version_productos
from .consultas import acuerdos_con_vigencia
from .serializadores import SerializadorFiltros
from .representaciones import representar, representar_entrega
from . import servicios


class PaginacionPrecios(PaginacionDiez):
    page_query_param = 'pagina'


class VistaPrecios(viewsets.ViewSet):
    permission_classes = [PermisosPrecios]
    modulo_auditoria = 'precios'
    http_method_names = ['get', 'post', 'head', 'options']
    lookup_value_regex = '[1-9][0-9]{0,14}'

    def filtros(self):
        formulario = SerializadorFiltros(data=self.request.query_params)
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def paginar(self, consulta, representar_fila):
        paginador = PaginacionPrecios()
        pagina = paginador.paginate_queryset(consulta, self.request, view=self)
        return paginador.get_paginated_response([representar_fila(fila) for fila in pagina])

    def obtener(self, pk):
        return get_object_or_404(acuerdos_permitidos(acuerdos_con_vigencia(), self.request.user).select_related('anterior'), pk=pk)

    def list(self, request):
        filtros = self.filtros()
        consulta = acuerdos_permitidos(acuerdos_con_vigencia(), request.user)
        if filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
        if filtros.get('cliente'):
            consulta = consulta.filter(cliente_id=filtros['cliente'])
        if filtros.get('fecha'):
            consulta = consulta.filter(Q(alcance='periodo', desde__lte=filtros['fecha'], hasta__gte=filtros['fecha']) |
                Q(alcance='entregas', entregas__entrega__pedido__fecha_requerida=filtros['fecha'])).distinct()
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(cliente_nombre__icontains=buscar) | Q(referencia_propuesta__icontains=buscar) | Q(lineas__producto_nombre__icontains=buscar)
            codigo = buscar.upper().removeprefix('PRE-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio).distinct()
        return self.paginar(consulta.order_by('-creado_en', '-pk'), lambda fila: representar(fila, False))

    def retrieve(self, request, pk=None):
        return Response(representar(self.obtener(pk)))

    def ejecutar(self, funcion, *argumentos):
        try:
            acuerdo = funcion(self.request.user, *argumentos)
        except IntegrityError as error:
            raise servicios.ConflictoPrecio('La operación ya se procesó o sus datos cambiaron. Recarga antes de continuar.') from error
        return Response(representar(self.obtener(acuerdo.pk)))

    def create(self, request):
        return self.ejecutar(servicios.guardar, request.data)

    @action(detail=True, methods=['post'])
    def guardar(self, request, pk=None):
        return self.ejecutar(servicios.guardar, request.data, int(pk))

    @action(detail=True, methods=['post'])
    def presentar(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'presentar', request.data)

    @action(detail=True, methods=['post'])
    def aceptar(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'aceptar', request.data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'rechazar', request.data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'cancelar', request.data)

    @action(detail=True, methods=['post'], url_path='nueva-version')
    def nueva_version(self, request, pk=None):
        return self.ejecutar(servicios.actuar, int(pk), 'nueva_version', request.data)

    @action(detail=True, methods=['get'])
    def historial(self, request, pk=None):
        acuerdo = self.obtener(pk)
        return self.paginar(acuerdos_permitidos(acuerdos_con_vigencia(), request.user).filter(familia=acuerdo.familia).order_by('-creado_en', '-pk'), lambda fila: representar(fila, False))

    @action(detail=False, methods=['get'])
    def clientes(self, request):
        filtros = self.filtros()
        consulta = clientes_permitidos(request.user).filter(activo=True)
        if filtros.get('buscar'):
            consulta = consulta.filter(razon_social__icontains=filtros['buscar'])
        return self.paginar(consulta.order_by('razon_social', 'pk'), lambda c: {'id': c.pk, 'nombre': c.razon_social})

    @action(detail=False, methods=['get'])
    def productos(self, request):
        if es_supermercado(request.user):
            raise PermissionDenied('Consulta los productos de los pedidos del supermercado asignado.')
        filtros = self.filtros()
        consulta = Producto.objects.filter(activo=True, categoria__activo=True).select_related('categoria')
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(nombre__icontains=filtros['buscar']) | Q(categoria__nombre__icontains=filtros['buscar']))
        return self.paginar(consulta.order_by('nombre', 'pk'), lambda p: {'id': p.pk, 'nombre': p.nombre, 'categoria_nombre': p.categoria.nombre,
            'imagen': f'/api/v1/precios-acordados/imagenes/{p.pk}/' if p.imagen else None})

    @action(detail=False, methods=['get'])
    def entregas(self, request):
        filtros = self.filtros()
        if es_supermercado(request.user):
            get_object_or_404(clientes_permitidos(request.user), pk=filtros.get('cliente'))
        consulta = Entrega.objects.filter(estado='confirmada', pedido__sucursal__cliente_id=filtros.get('cliente')).select_related('pedido')
        if 'seleccion' in filtros:
            consulta = consulta.filter(pk__in=filtros['seleccion'])
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = Q(origen__sucursal_nombre__icontains=buscar) | Q(origen__codigo_pedido__icontains=buscar)
            codigo = buscar.upper().removeprefix('ENT-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        return self.paginar(consulta.order_by('-confirmado_en', '-pk'), representar_entrega)

    @action(detail=False, methods=['get'])
    def contexto(self, request):
        propios = es_supermercado(request.user)
        clientes = clientes_permitidos(request.user).filter(activo=True)
        unico = clientes.first() if propios and clientes.count() == 1 else None
        return Response({'supermercado': propios, 'fecha_actual': timezone.localdate(),
            'cliente': {'id': unico.pk, 'nombre': unico.razon_social} if unico else None})

    def origen_pedidos(self, request):
        entrada = ConsultaPedidosPrecio(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        cliente = get_object_or_404(clientes_permitidos(request.user).filter(activo=True), pk=datos['cliente'])
        return datos, cliente, productos_pedidos(cliente, datos['desde'], datos['hasta'])

    @action(detail=False, methods=['get'], url_path='productos-pedidos')
    def productos_del_periodo(self, request):
        datos, cliente, consulta = self.origen_pedidos(request)
        version = version_productos(consulta, cliente, datos['desde'], datos['hasta'])
        if datos.get('buscar'):
            consulta = consulta.filter(Q(nombre__icontains=datos['buscar']) | Q(categoria__nombre__icontains=datos['buscar']))
        respuesta = self.paginar(consulta, lambda p: {'id': p.pk, 'nombre': p.nombre, 'categoria_nombre': p.categoria.nombre,
            'imagen': f'/api/v1/precios-acordados/imagenes/{p.pk}/?cliente={cliente.pk}&desde={datos["desde"]}&hasta={datos["hasta"]}' if p.imagen else None})
        respuesta.data['version_origen'] = version
        respuesta['Cache-Control'] = 'no-store'
        return respuesta

    @action(detail=False, methods=['get'], url_path=r'imagenes/(?P<producto>[1-9][0-9]{0,14})')
    def imagen(self, request, producto=None):
        consulta = Producto.objects.all()
        if request.query_params.get('acuerdo'):
            identificador = request.query_params['acuerdo']
            if not identificador.isascii() or not identificador.isdigit() or len(identificador) > 15:
                raise ValidationError({'acuerdo': 'Indica un acuerdo válido.'})
            acuerdo = self.obtener(identificador)
            consulta = consulta.filter(pk__in=acuerdo.lineas.values('producto_id'))
        elif es_supermercado(request.user):
            _, _, consulta = self.origen_pedidos(request)
        obj = get_object_or_404(consulta, pk=producto)
        if not obj.imagen:
            raise Http404
        try:
            respuesta = FileResponse(obj.imagen.open('rb'), content_type='image/webp')
        except OSError as error:
            raise Http404 from error
        respuesta['Cache-Control'] = 'private, no-store'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta


class VistaPreciosPublica(VistaPrecios):
    def initial(self, request, *args, **kwargs):
        request.user._precios_solo_propios = True
        super().initial(request, *args, **kwargs)
