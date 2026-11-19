import hashlib
import io
from decimal import Decimal
from django.db import IntegrityError
from django.db.models import Q, Count, Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from config.paginacion import PaginacionDiez
from cobros.comprobantes import extraer_entrada, EXTENSIONES_COMPROBANTE
from cobros.servicios import ConflictoCobro
from precios.consultas import huella
from .models import AvisoPago, ComprobanteAvisoPago
from .permisos import PermisoPropios, PermisoOficina, autorizar_propios, autorizar_oficina, clientes_propios
from .serializadores import FiltrosPagos
from .consultas import representar_aviso, representar_aplicacion, ventas_propias_con_saldos, representar_venta
from . import servicios


class PaginacionPagos(PaginacionDiez):
    page_query_param = 'pagina'


class VistaBasePagos(viewsets.ViewSet):
    modulo_auditoria = 'pagos'
    http_method_names = ['get', 'post', 'head', 'options']
    lookup_value_regex = '[1-9][0-9]{0,14}'
    propios = False

    def finalize_response(self, request, response, *args, **kwargs):
        respuesta = super().finalize_response(request, response, *args, **kwargs)
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def filtros(self):
        formulario = FiltrosPagos(data=self.request.query_params)
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def consulta(self):
        consulta = AvisoPago.objects.select_related('cobro')
        if self.propios:
            actor = autorizar_propios(self.request.user)
            return consulta.filter(cliente_id__in=clientes_propios(actor).values('pk'))
        autorizar_oficina(self.request.user)
        return consulta

    def obtener(self, pk):
        return get_object_or_404(self.consulta(), pk=pk)

    def paginar(self, consulta, transformar, extra=None):
        paginador = PaginacionPagos()
        filas = paginador.paginate_queryset(consulta, self.request, view=self)
        respuesta = paginador.get_paginated_response([transformar(fila) for fila in filas])
        respuesta.data.update(extra or {})
        return respuesta

    def list(self, request):
        filtros = self.filtros()
        consulta = self.consulta()
        if filtros.get('cliente'):
            consulta = consulta.filter(cliente_id=filtros['cliente'])
        if filtros.get('estado'):
            consulta = consulta.filter(estado=filtros['estado'])
        for campo, operador in [('desde', 'gte'), ('hasta', 'lte')]:
            if filtros.get(campo):
                consulta = consulta.filter(**{f'fecha_pago__{operador}': filtros[campo]})
        if filtros.get('buscar'):
            texto = filtros['buscar']
            criterio = Q(cliente_nombre__icontains=texto)
            codigo = texto.upper().removeprefix('PAG-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        resumen = consulta.aggregate(por_verificar=Count('pk', filter=Q(estado='por_verificar')),
            confirmado=Count('pk', filter=Q(estado='confirmado')), observado=Count('pk', filter=Q(estado='observado')))
        return self.paginar(consulta, representar_aviso, {'resumen': resumen})

    def retrieve(self, request, pk=None):
        return Response(representar_aviso(self.obtener(pk)))

    @action(detail=True, methods=['get'])
    def aplicaciones(self, request, pk=None):
        aviso = self.obtener(pk)
        return self.paginar(aviso.aplicaciones.select_related('venta'), representar_aplicacion)

    @action(detail=True, methods=['get'])
    def comprobante(self, request, pk=None):
        aviso = self.obtener(pk)
        archivo = get_object_or_404(ComprobanteAvisoPago, aviso=aviso)
        contenido = bytes(archivo.contenido)
        if len(contenido) != archivo.tamano or hashlib.sha256(contenido).hexdigest() != archivo.sha256:
            raise ValidationError({'comprobante': 'No se pudo comprobar la integridad del comprobante.'})
        if self.propios:
            autorizar_propios(request.user, cliente_id=aviso.cliente_id)
        else:
            autorizar_oficina(request.user)
        respuesta = FileResponse(io.BytesIO(contenido), as_attachment=True,
            filename=f'{aviso.codigo}-comprobante.{EXTENSIONES_COMPROBANTE[archivo.tipo]}', content_type=archivo.tipo)
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Content-Security-Policy'] = "default-src 'none'; sandbox"
        return respuesta


class VistaMisPagos(VistaBasePagos):
    propios = True
    permission_classes = [PermisoPropios]

    def create(self, request):
        datos, archivo = extraer_entrada(request)
        try:
            aviso = servicios.informar_pago(request.user, datos, archivo)
        except IntegrityError as error:
            raise ConflictoCobro('La clave ya se utilizó para otro informe de pago.') from error
        return Response(representar_aviso(aviso))

    @action(detail=False, methods=['post'])
    def revisar(self, request):
        datos, archivo = extraer_entrada(request)
        return Response(servicios.revisar_informe(request.user, datos, archivo))

    @action(detail=False, methods=['get'])
    def clientes(self, request):
        actor = autorizar_propios(request.user)
        filtros = self.filtros()
        consulta = clientes_propios(actor)
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(razon_social__icontains=filtros['buscar']) | Q(nit__icontains=filtros['buscar']))
        return self.paginar(consulta.order_by('razon_social', 'pk'), lambda c: {'id': c.pk, 'nombre': c.razon_social, 'nit': c.nit})

    @action(detail=False, methods=['get'])
    def ventas(self, request):
        actor = autorizar_propios(request.user)
        filtros = self.filtros()
        propios = clientes_propios(actor)
        consulta = ventas_propias_con_saldos(propios)
        if filtros.get('cliente'):
            autorizar_propios(actor, cliente_id=filtros['cliente'])
            consulta = consulta.filter(cliente_id=filtros['cliente'])
        if filtros.get('seleccion'):
            consulta = consulta.filter(pk__in=filtros['seleccion'])
        elif self.request.query_params.get('historial') != '1':
            consulta = consulta.filter(saldo_calculado__gt=0)
        if filtros.get('buscar'):
            codigo = filtros['buscar'].upper().removeprefix('VEN-')
            consulta = consulta.filter(pk=int(codigo)) if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15 else consulta.none()
        for campo, operador in [('desde', 'gte'), ('hasta', 'lte')]:
            if filtros.get(campo):
                consulta = consulta.filter(**{f'fecha_emision__{operador}': filtros[campo]})
        consulta = consulta.order_by('fecha_emision', 'pk')
        resumen = consulta.aggregate(total=Sum('total'), cobrado=Sum('cobrado_calculado'), saldo=Sum('saldo_calculado'), total_por_verificar=Sum('por_verificar'))
        resumen['por_verificar'] = resumen.pop('total_por_verificar')
        resumen = {campo: format(valor or Decimal('0.00'), '.2f') for campo, valor in resumen.items()}
        version = huella(list(consulta.values_list('pk', 'total', 'cobrado_calculado', 'por_verificar')))
        return self.paginar(consulta, representar_venta, {'version_origen': version, 'resumen': resumen})


class VistaPagosOficina(VistaBasePagos):
    permission_classes = [PermisoOficina]

    @action(detail=True, methods=['post'])
    def revisar(self, request, pk=None):
        return Response(servicios.revisar_verificacion(request.user, int(pk), request.data))

    def decidir(self, request, pk, accion):
        try:
            aviso = servicios.decidir_pago(request.user, int(pk), accion, request.data)
        except IntegrityError as error:
            raise ConflictoCobro('La decisión ya fue registrada. Actualiza el pago.') from error
        return Response(representar_aviso(aviso))

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        return self.decidir(request, pk, 'confirmar')

    @action(detail=True, methods=['post'])
    def observar(self, request, pk=None):
        return self.decidir(request, pk, 'observar')
