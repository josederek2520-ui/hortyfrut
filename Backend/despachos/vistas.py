from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from almacenes.models import Almacen
from cajillas.models import Cajilla
from cajillas.consultas import saldo_almacen
from .cajillas_preparadas import previsiones_carga
from vehiculos.models import Vehiculo
from auditoria.servicios import nombre_responsable
from config.paginacion import PaginacionDiez
from .models import Despacho
from .consultas import asignaciones_disponibles, contenido_asignacion, choferes_habilitados, despachos_con_relaciones
from .permisos import PermisosDespachos
from .serializadores import SerializadorDespacho, SerializadorDetalleDespacho
from .servicios import guardar_despacho, ejecutar_accion, ConflictoDespacho
from .carga_destinos import carga_disponible, destinos_disponibles, pedidos_disponibles, version_carga_disponible
from .vistas_descarga import ConsultaPedidosDescarga
from .vistas_ruta import GestionRutaDespacho
from .vistas_supervision import SupervisionDespacho


class PaginacionDespachos(PaginacionDiez):
    page_query_param = 'pagina'


class SerializadorFiltrosDespacho(serializers.Serializer):
    buscar = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    estado = serializers.ChoiceField(choices=['borrador', 'en_ruta', 'finalizado', 'cancelado'], required=False)
    vista = serializers.ChoiceField(choices=['activos', 'historial'], required=False)
    fecha = serializers.DateField(required=False)
    almacen = serializers.IntegerField(min_value=1, required=False)
    despacho = serializers.IntegerField(min_value=1, required=False)
    sucursal = serializers.IntegerField(min_value=1, required=False)
    pedido = serializers.IntegerField(min_value=1, required=False)


class VistaDespachos(SupervisionDespacho, GestionRutaDespacho, ConsultaPedidosDescarga, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = SerializadorDespacho
    permission_classes = [PermisosDespachos]
    pagination_class = PaginacionDespachos
    modulo_auditoria = 'despachos'
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def filtros(self):
        formulario = SerializadorFiltrosDespacho(data=self.request.query_params.dict())
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def get_queryset(self):
        consulta = despachos_con_relaciones()
        if self.action in ('list', 'resumen'):
            filtros = self.filtros()
            buscar = filtros['buscar']
            criterio = Q(vehiculo_placa__icontains=buscar) | Q(chofer_nombre__icontains=buscar) | Q(almacen_nombre__icontains=buscar)
            numero = buscar.upper().removeprefix('DES-')
            if numero.isdigit():
                criterio |= Q(pk=int(numero))
            consulta = consulta.filter(criterio)
            if filtros.get('fecha'):
                consulta = consulta.filter(fecha_reparto=filtros['fecha'])
            if self.action == 'list':
                if filtros.get('vista') == 'activos':
                    consulta = consulta.filter(estado__in=['borrador', 'en_ruta']).order_by(
                        Case(When(estado='en_ruta', then=Value(0)), default=Value(1), output_field=IntegerField()),
                        'fecha_reparto', 'pk')
                elif filtros.get('vista') == 'historial':
                    consulta = consulta.filter(estado__in=['finalizado', 'cancelado'])
                if filtros.get('estado'):
                    consulta = consulta.filter(estado=filtros['estado'])
        return consulta

    def retrieve(self, request, pk=None):
        return Response(SerializadorDetalleDespacho(self.get_object()).data)

    def respuesta(self, instancia, estado=200):
        return Response(SerializadorDetalleDespacho(despachos_con_relaciones().get(pk=instancia.pk)).data, status=estado)

    def create(self, request):
        despacho, creado = guardar_despacho(request.user, request.data)
        return self.respuesta(despacho, 201 if creado else 200)

    def partial_update(self, request, pk=None):
        despacho, _ = guardar_despacho(request.user, request.data, self.get_object())
        return self.respuesta(despacho)

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        resumen = self.get_queryset().aggregate(total=Count('pk'), **{estado: Count('pk', filter=Q(estado=estado)) for estado in ('borrador', 'en_ruta', 'finalizado', 'cancelado')})
        resumen['hay_carga_disponible'] = asignaciones_disponibles().exists()
        return Response(resumen)

    @action(detail=False, methods=['get'])
    def almacenes(self, request):
        consulta = Almacen.objects.filter(activo=True, nombre__icontains=self.filtros()['buscar'])
        return self.get_paginated_response([{'id': fila.pk, 'nombre': fila.nombre} for fila in self.paginate_queryset(consulta)])

    @action(detail=False, methods=['get'])
    def vehiculos(self, request):
        buscar = self.filtros()['buscar']
        consulta = Vehiculo.objects.filter(activo=True).filter(Q(placa__icontains=buscar) | Q(marca__icontains=buscar))
        return self.get_paginated_response([{'id': fila.pk, 'nombre': fila.placa, 'detalle': f'{fila.tipo} · {fila.marca}'.strip(' ·'),
            'capacidad_kg': str(fila.capacidad_kg) if fila.capacidad_kg else None,
            'ocupado': fila.despachos.filter(estado='en_ruta').exists()} for fila in self.paginate_queryset(consulta)])

    @action(detail=False, methods=['get'])
    def choferes(self, request):
        buscar = self.filtros()['buscar']
        consulta = choferes_habilitados().filter(Q(first_name__icontains=buscar) | Q(last_name__icontains=buscar)).order_by('first_name', 'last_name', 'pk')
        return self.get_paginated_response([{'id': fila.pk, 'nombre': nombre_responsable(fila),
            'ocupado': fila.despachos_asignados.filter(estado='en_ruta').exists()} for fila in self.paginate_queryset(consulta)])

    @action(detail=False, methods=['get'])
    def cajillas(self, request):
        filtros = self.filtros()
        consulta = Cajilla.objects.filter(color__icontains=filtros['buscar'])
        return self.get_paginated_response([{'id': fila.pk, 'nombre': fila.color,
            'disponible': saldo_almacen(fila.pk, filtros['almacen']) if filtros.get('almacen') else None} for fila in self.paginate_queryset(consulta)])

    @action(detail=False, methods=['get'])
    def disponibles(self, request):
        filtros = self.filtros()
        if not filtros.get('almacen'):
            raise serializers.ValidationError({'almacen': 'Selecciona el almacén de salida.'})
        if filtros.get('despacho'):
            get_object_or_404(Despacho, pk=filtros['despacho'], estado='borrador')
        consulta = carga_disponible(filtros)
        buscar = filtros['buscar']
        consulta = consulta.filter(Q(producto_nombre__icontains=buscar) | Q(sucursal_nombre__icontains=buscar) | Q(preparacion__cliente_nombre__icontains=buscar))
        version = version_carga_disponible(consulta) if filtros.get('sucursal') else None
        filas = self.paginate_queryset(consulta.order_by('preparacion__cliente_nombre', 'sucursal_nombre', 'producto_nombre', 'pk'))
        previstas = previsiones_carga((fila.preparacion_id, fila.sucursal_id, fila.producto_id) for fila in filas)
        respuesta = self.get_paginated_response([{'id': fila.pk, 'direccion': fila.sucursal.direccion, **contenido_asignacion(fila),
            'cajillas_previstas': [cajilla for cajilla in previstas if cajilla['preparacion_id'] == fila.preparacion_id and cajilla['sucursal_id'] == fila.sucursal_id
                and cajilla['producto_id'] in (None, fila.producto_id)]} for fila in filas])
        if filtros.get('sucursal'):
            if version != version_carga_disponible(consulta):
                raise ConflictoDespacho('La carga disponible cambió durante la consulta. Actualiza para seleccionar la sucursal completa.')
            respuesta.data['version_carga'] = version
        return respuesta

    @action(detail=False, methods=['get'], url_path='destinos-disponibles')
    def destinos_disponibles(self, request):
        filtros = self.filtros()
        if not filtros.get('almacen'):
            raise serializers.ValidationError({'almacen': 'Selecciona el almacén de salida.'})
        if filtros.get('despacho'):
            get_object_or_404(Despacho, pk=filtros['despacho'], estado='borrador')
        filas = self.paginate_queryset(destinos_disponibles(filtros))
        return self.get_paginated_response([{'sucursal': fila['sucursal_id'], 'sucursal_nombre': fila['sucursal__nombre'],
            'cliente_nombre': fila['sucursal__cliente__razon_social'], 'direccion': fila['sucursal__direccion'],
            'asignaciones': fila['asignaciones'], 'pedidos': fila['pedidos'], 'productos': fila['productos'], 'cajas': fila['cajas'], 'unidades': fila['unidades'],
            'peso_kg': format(fila['peso_kg'], '.3f')} for fila in filas])

    @action(detail=False, methods=['get'], url_path='pedidos-disponibles')
    def pedidos_disponibles(self, request):
        filtros = self.filtros()
        for campo in ('almacen', 'sucursal'):
            if not filtros.get(campo):
                raise serializers.ValidationError({campo: 'Selecciona el origen y la sucursal de la carga.'})
        if filtros.get('despacho'):
            get_object_or_404(Despacho, pk=filtros['despacho'], estado='borrador')
        filas = self.paginate_queryset(pedidos_disponibles(filtros))
        return self.get_paginated_response([{'pedido': fila['pedido_id'], 'codigo_pedido': f"PED-{fila['pedido_id']:06d}",
            'fecha_requerida': str(fila['pedido__fecha_requerida']), 'asignaciones': fila['asignaciones'],
            'productos': fila['productos'], 'cajas': fila['cajas'], 'unidades': fila['unidades'],
            'peso_kg': format(fila['peso_kg'], '.3f')} for fila in filas])

    @action(detail=True, methods=['post'])
    def iniciar(self, request, pk=None):
        return self.respuesta(ejecutar_accion(request.user, self.get_object(), 'iniciar', request.data))

    @action(detail=True, methods=['post'])
    def enviar(self, request, pk=None):
        return self.respuesta(ejecutar_accion(request.user, self.get_object(), 'enviar', request.data))

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        return self.respuesta(ejecutar_accion(request.user, self.get_object(), 'cancelar', request.data))

    @action(detail=True, methods=['post'])
    def llegar(self, request, pk=None):
        return self.respuesta(ejecutar_accion(request.user, self.get_object(), 'llegar', request.data))

    @action(detail=True, methods=['post'])
    def descargar(self, request, pk=None):
        return self.respuesta(ejecutar_accion(request.user, self.get_object(), 'descargar', request.data))

    @action(detail=True, methods=['post'])
    def finalizar(self, request, pk=None):
        return self.respuesta(ejecutar_accion(request.user, self.get_object(), 'finalizar', request.data))
