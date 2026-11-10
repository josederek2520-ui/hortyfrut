from django.db import IntegrityError
from decimal import Decimal
from datetime import datetime
from django.utils import timezone
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from productos.models import Producto
from .models import Entrega
from .consultas import pendientes, origen_entrega, version_entrega, cargas_origen
from .permisos import PermisosEntregas, acciones_recepcion
from .receptores import encargado_pedidos_recepcion, representar_receptor
from .serializadores import SerializadorFiltros
from .servicios import guardar_hoja, ejecutar_accion, ConflictoEntrega, datos_lineas
from .comprobantes import guardar_comprobante, almacenamiento


class PaginacionEntregas(PaginacionDiez):
    page_query_param = 'pagina'


def representar(actor, despacho, pedido):
    origen, sucursal = origen_entrega(actor, despacho, pedido)
    entrega = Entrega.objects.filter(despacho_id=despacho, pedido_id=pedido).first()
    receptor = representar_receptor(encargado_pedidos_recepcion(sucursal))
    return {'id': entrega.pk if entrega else None, 'codigo': entrega.codigo if entrega else '', 'origen': origen,
        'estado': entrega.estado if entrega else 'pendiente', 'version': version_entrega(entrega, origen),
        'fecha_recepcion': entrega.fecha_recepcion if entrega else None,
        'recibido_por': entrega.recibido_por if entrega and entrega.recibido_por else (receptor['nombre'] if receptor else ''),
        'recibido_por_usuario': entrega.recibido_por_usuario_id if entrega else None,
        'receptor_por_registrar': entrega is None or not entrega.recibido_por,
        'receptor_asignado': receptor, 'acciones': acciones_recepcion(actor, sucursal),
        'fecha_minima': timezone.localtime(datetime.fromisoformat(origen['descargada_en'])).date(), 'fecha_maxima': timezone.localdate(),
        'responsable_nombre': entrega.responsable_nombre if entrega else '',
        'confirmado_por_nombre': entrega.confirmado_por_nombre if entrega else '',
        'confirmado_en': entrega.confirmado_en if entrega else None,
        'comprobante': bool(entrega and entrega.comprobante),
        'lineas': [{k: str(v) if isinstance(v, Decimal) else v for k, v in f.items()} for f in datos_lineas(entrega)] if entrega else [],
        'aportes': [{k: str(v) if isinstance(v, Decimal) else v for k, v in f.items()} for f in entrega.aportes.values('carga', 'lote', 'peso_recibido_kg', 'peso_rechazado_kg')] if entrega else []}


class VistaEntregas(viewsets.ViewSet):
    permission_classes = [PermisosEntregas]
    modulo_auditoria = 'entregas'
    http_method_names = ['get', 'post', 'head', 'options']

    def paginar(self, filas):
        paginador = PaginacionEntregas()
        pagina = paginador.paginate_queryset(filas, self.request, view=self)
        return paginador.get_paginated_response(pagina)

    def list(self, request):
        entrada = SerializadorFiltros(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        filtros = entrada.validated_data
        consulta = pendientes(request.user)
        if filtros.get('buscar'):
            buscar = filtros['buscar']
            criterio = (Q(parada__cliente_nombre__icontains=buscar) | Q(parada__sucursal_nombre__icontains=buscar))
            codigo = buscar.upper().removeprefix('PED-').removeprefix('DES-')
            if codigo.isdigit():
                criterio |= Q(asignacion__pedido_id=int(codigo)) | Q(despacho_id=int(codigo))
            consulta = consulta.filter(criterio)
        if filtros.get('pedido'):
            consulta = consulta.filter(asignacion__pedido_id=filtros['pedido'])
        if filtros.get('fecha'):
            consulta = consulta.filter(despacho__fecha_reparto=filtros['fecha'])
        resumen_estados = {estado: consulta.filter(estado=estado).count() for estado in ['pendiente', 'borrador', 'revision', 'confirmada']}
        if filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
        paginador = PaginacionEntregas()
        pagina = paginador.paginate_queryset(consulta, request, view=self)
        from clientes.models import Sucursal
        from despachos.models import ParadaDespacho
        destinos = dict(ParadaDespacho.objects.filter(pk__in=[f['parada_id'] for f in pagina]).values_list('pk', 'sucursal_id'))
        sucursales = {s.pk: s for s in Sucursal.objects.filter(pk__in=destinos.values())}
        respuesta = paginador.get_paginated_response([{'despacho': f['despacho_id'], 'pedido': f['asignacion__pedido_id'],
            'codigo_despacho': f"DES-{f['despacho_id']:06d}", 'codigo_pedido': f"PED-{f['asignacion__pedido_id']:06d}",
            'cliente_nombre': f['parada__cliente_nombre'], 'sucursal_nombre': f['parada__sucursal_nombre'],
            'fecha_reparto': f['despacho__fecha_reparto'],
            'descargada_en': f['descargada_en'], 'estado': f['estado'],
            'acciones': acciones_recepcion(request.user, sucursales[destinos[f['parada_id']]])} for f in pagina])
        respuesta.data['resumen_estados'] = resumen_estados
        return respuesta

    @action(detail=True, methods=['get', 'post'], url_path=r'pedidos/(?P<pedido>[0-9]+)')
    def hoja(self, request, pk=None, pedido=None):
        despacho, pedido = int(pk), int(pedido)
        if request.method == 'POST':
            try:
                guardar_hoja(request.user, despacho, pedido, request.data)
            except IntegrityError as error:
                raise ConflictoEntrega('La operación ya fue procesada o la entrega cambió.') from error
        return Response(representar(request.user, despacho, pedido))

    @action(detail=True, methods=['post'], url_path=r'pedidos/(?P<pedido>[0-9]+)/(?P<accion>enviar|confirmar|devolver)')
    def operar(self, request, pk=None, pedido=None, accion=None):
        try:
            ejecutar_accion(request.user, int(pk), int(pedido), accion, request.data)
        except IntegrityError as error:
            raise ConflictoEntrega() from error
        return Response(representar(request.user, int(pk), int(pedido)))

    @action(detail=True, methods=['get'], url_path=r'pedidos/(?P<pedido>[0-9]+)/productos')
    def productos(self, request, pk=None, pedido=None):
        origen, _ = origen_entrega(request.user, int(pk), int(pedido))
        buscar = request.query_params.get('buscar', '').strip().casefold()
        filas = [f for f in origen['productos'] if not buscar or buscar in f['nombre'].casefold()]
        paginador = PaginacionEntregas()
        pagina = paginador.paginate_queryset(filas, request, view=self)
        catalogo = {p.pk: p for p in Producto.objects.filter(pk__in=[f['producto'] for f in pagina]).select_related('categoria')}
        from pedidos.models import DetallePedido
        solicitados = {}
        for detalle in DetallePedido.objects.filter(pedido_id=pedido, producto_id__in=catalogo):
            solicitados.setdefault(detalle.producto_id, {'cajas': 0, 'unidades': 0})[detalle.columna] += detalle.cantidad
        return paginador.get_paginated_response([{**f, 'pedido_cajas': solicitados.get(f['producto'], {}).get('cajas', 0),
            'pedido_unidades': solicitados.get(f['producto'], {}).get('unidades', 0), 'categoria': catalogo[f['producto']].categoria.nombre,
            'imagen': f'/api/v1/entregas/{pk}/pedidos/{pedido}/imagenes/{f["producto"]}/' if catalogo[f['producto']].imagen else None} for f in pagina])

    @action(detail=True, methods=['get', 'post'], url_path=r'pedidos/(?P<pedido>[0-9]+)/comprobante')
    def comprobante(self, request, pk=None, pedido=None):
        despacho, pedido = int(pk), int(pedido)
        if request.method == 'POST':
            guardar_comprobante(request.user, despacho, pedido, request.data, request.FILES.get('comprobante'))
            return Response(representar(request.user, despacho, pedido))
        origen_entrega(request.user, despacho, pedido)
        entrega = get_object_or_404(Entrega, despacho_id=despacho, pedido_id=pedido)
        if not entrega.comprobante:
            raise Http404
        try:
            extension = entrega.comprobante.rsplit('.', 1)[-1]
            respuesta = FileResponse(almacenamiento().open(entrega.comprobante, 'rb'), as_attachment=True,
                filename=f'{entrega.codigo}-comprobante.{extension}', content_type=entrega.comprobante_tipo)
        except OSError as error:
            raise Http404 from error
        respuesta['Cache-Control'] = 'private, no-store'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Content-Security-Policy'] = 'sandbox'
        return respuesta


    @action(detail=True, methods=['get'], url_path=r'pedidos/(?P<pedido>[0-9]+)/aportes')
    def aportes(self, request, pk=None, pedido=None):
        origen, _ = origen_entrega(request.user, int(pk), int(pedido))
        producto = request.query_params.get('producto', '')
        if not producto.isdigit():
            raise ValidationError({'producto': 'Selecciona un producto de esta entrega.'})
        fila = next((p for p in origen['productos'] if p['producto'] == int(producto)), None)
        if fila is None:
            raise Http404
        return self.paginar(fila['aportes'])

    @action(detail=True, methods=['get'], url_path=r'pedidos/(?P<pedido>[0-9]+)/imagenes/(?P<producto>[0-9]+)')
    def imagen(self, request, pk=None, pedido=None, producto=None):
        origen, _ = origen_entrega(request.user, int(pk), int(pedido))
        if int(producto) not in {f['producto'] for f in origen['productos']}:
            raise Http404
        obj = get_object_or_404(Producto, pk=producto)
        if not obj.imagen:
            raise Http404
        try:
            respuesta = FileResponse(obj.imagen.open('rb'), content_type='image/webp')
        except OSError as error:
            raise Http404 from error
        respuesta['Cache-Control'] = 'private, max-age=300'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta


class VistaEntregasPublica(VistaEntregas):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        request.user._entregas_solo_propias = True


