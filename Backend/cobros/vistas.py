from decimal import Decimal
import hashlib
import io
from django.http import FileResponse
from django.db import IntegrityError
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from config.paginacion import PaginacionDiez
from clientes.models import Cliente
from ventas.models import Venta
from precios.consultas import huella
from .models import Cobro, ComprobanteCobro
from .permisos import PermisosCobros, autorizar
from .comprobantes import extraer_entrada, EXTENSIONES_COMPROBANTE
from .serializadores import FiltrosCobro
from .consultas import ventas_con_saldos, representar_saldo, representar_cobro, representar_aplicacion
from .servicios import registrar_cobro, revisar_cobro, ConflictoCobro


class PaginacionCobros(PaginacionDiez):
    page_query_param = 'pagina'


class VistaCobros(viewsets.ViewSet):
    permission_classes = [PermisosCobros]
    modulo_auditoria = 'cobros'
    http_method_names = ['get', 'post', 'head', 'options']
    lookup_value_regex = '[1-9][0-9]{0,14}'

    def finalize_response(self, request, response, *args, **kwargs):
        respuesta = super().finalize_response(request, response, *args, **kwargs)
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def filtros(self):
        formulario = FiltrosCobro(data=self.request.query_params)
        formulario.is_valid(raise_exception=True)
        return formulario.validated_data

    def paginar(self, consulta, transformar, extra=None):
        paginador = PaginacionCobros()
        filas = paginador.paginate_queryset(consulta, self.request, view=self)
        respuesta = paginador.get_paginated_response([transformar(fila) for fila in filas])
        respuesta.data.update(extra or {})
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

    def list(self, request):
        filtros = self.filtros()
        consulta = Cobro.objects.all()
        if filtros.get('cliente'):
            consulta = consulta.filter(cliente_id=filtros['cliente'])
        if filtros.get('venta'):
            consulta = consulta.filter(aplicaciones__venta_id=filtros['venta'])
        for campo, operador in [('desde', 'gte'), ('hasta', 'lte')]:
            if filtros.get(campo):
                consulta = consulta.filter(**{f'fecha_cobro__{operador}': filtros[campo]})
        if filtros.get('buscar'):
            texto = filtros['buscar']
            criterio = Q(cliente_nombre__icontains=texto) | Q(referencia__icontains=texto)
            codigo = texto.upper().removeprefix('COB-')
            if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15:
                criterio |= Q(pk=int(codigo))
            consulta = consulta.filter(criterio)
        total = consulta.aggregate(total=Sum('importe'))['total'] or Decimal('0.00')
        return self.paginar(consulta, representar_cobro, {'total_cobrado': format(total, '.2f')})

    def retrieve(self, request, pk=None):
        return Response(representar_cobro(get_object_or_404(Cobro, pk=pk)))

    def create(self, request):
        try:
            datos, archivo = extraer_entrada(request)
            cobro = registrar_cobro(request.user, datos, archivo)
        except IntegrityError as error:
            raise ConflictoCobro('La clave ya se utilizó o el cobro cambió. Revisa el registro antes de continuar.') from error
        return Response(representar_cobro(cobro))

    @action(detail=False, methods=['post'])
    def revisar(self, request):
        datos, archivo = extraer_entrada(request)
        return Response(revisar_cobro(request.user, datos, archivo))

    @action(detail=True, methods=['get'])
    def comprobante(self, request, pk=None):
        cobro = get_object_or_404(Cobro, pk=pk)
        archivo = get_object_or_404(ComprobanteCobro, cobro=cobro)
        contenido = bytes(archivo.contenido)
        if len(contenido) != archivo.tamano or hashlib.sha256(contenido).hexdigest() != archivo.sha256:
            raise ValidationError({'comprobante': 'No se pudo comprobar la integridad del comprobante.'})
        autorizar(request.user)
        respuesta = FileResponse(io.BytesIO(contenido), as_attachment=True,
            filename=f'{cobro.codigo}-comprobante.{EXTENSIONES_COMPROBANTE[archivo.tipo]}', content_type=archivo.tipo)
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Content-Security-Policy'] = "default-src 'none'; sandbox"
        return respuesta

    @action(detail=True, methods=['get'])
    def aplicaciones(self, request, pk=None):
        cobro = get_object_or_404(Cobro, pk=pk)
        return self.paginar(cobro.aplicaciones.all(), representar_aplicacion)

    @action(detail=False, methods=['get'])
    def clientes(self, request):
        filtros = self.filtros()
        # Un cliente inactivo puede seguir teniendo deuda por cobrar.
        pendientes = ventas_con_saldos(Venta.objects.filter(estado='emitida')).filter(saldo_calculado__gt=0)
        consulta = Cliente.objects.filter(pk__in=pendientes.values('cliente_id'))
        if filtros.get('buscar'):
            consulta = consulta.filter(Q(razon_social__icontains=filtros['buscar']) | Q(nit__icontains=filtros['buscar']))
        return self.paginar(consulta.order_by('razon_social', 'pk'), lambda c: {'id': c.pk, 'nombre': c.razon_social, 'nit': c.nit})

    @action(detail=False, methods=['get'])
    def ventas(self, request):
        filtros = self.filtros()
        if not filtros.get('cliente'):
            raise ValidationError({'cliente': 'Elige un supermercado.'})
        consulta = ventas_con_saldos(Venta.objects.filter(estado='emitida', cliente_id=filtros['cliente']))
        if filtros.get('seleccion'):
            consulta = consulta.filter(pk__in=filtros['seleccion'])
        else:
            consulta = consulta.filter(saldo_calculado__gt=0)
        if filtros.get('buscar'):
            codigo = filtros['buscar'].upper().removeprefix('VEN-')
            consulta = consulta.filter(pk=int(codigo)) if codigo.isascii() and codigo.isdigit() and len(codigo) <= 15 else consulta.none()
        consulta = consulta.order_by('fecha_emision', 'pk')
        version = huella(list(consulta.values_list('pk', 'total', 'cobrado_calculado')))
        return self.paginar(consulta, representar_saldo, {'version_origen': version})
