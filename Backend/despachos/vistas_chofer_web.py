"""La web del chofer utiliza los mismos servicios y contratos que Android."""
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from productos.models import Producto
from usuarios.acceso_chofer_web import AutenticacionChoferWeb
from .vistas_chofer import VistaMisDespachos
from .cajillas_preparadas import previsiones_carga


class VistaViajesChoferWeb(VistaMisDespachos):
    authentication_classes = [AutenticacionChoferWeb]

    @action(detail=True, methods=['post'], url_path='guia-destino')
    def guia_destino(self, request, pk=None):
        from .guia_chofer import consultar_guia
        return Response(consultar_guia(request.user, request.auth, self.get_object().pk, request.data))

    def completar_productos_descarga(self, despacho, filas):
        imagenes = dict(Producto.objects.filter(pk__in={fila['producto'] for fila in filas}).values_list('pk', 'imagen'))
        previstas = previsiones_carga({(fila['preparacion'], fila['sucursal'], fila['producto']) for fila in filas})
        for fila in filas:
            fila['producto_imagen'] = (f'/api/v1/chofer/mis-viajes/{despacho.pk}/imagenes/{fila["producto"]}/'
                                       if imagenes.get(fila['producto']) else None)
            # La prevision es compartida por producto/destino, no se reparte por pedido.
            # Las previsiones historicas sin producto no se atribuyen a uno supuesto.
            fila['cajillas_preparacion'] = [
                {'cajilla': valor['cajilla_id'], 'color': valor['color'], 'cantidad': valor['cantidad']}
                for valor in previstas if (valor['preparacion_id'], valor['sucursal_id'], valor['producto_id'])
                == (fila['preparacion'], fila['sucursal'], fila['producto'])]
        return filas

    @action(detail=True, methods=['get'], url_path=r'imagenes/(?P<producto_pk>[1-9]\d{0,14})')
    def imagen_producto(self, request, pk=None, producto_pk=None):
        despacho = self.get_object()
        if not despacho.cargas.filter(contenido__producto=int(producto_pk)).exists():
            raise Http404
        producto = get_object_or_404(Producto, pk=producto_pk)
        if not producto.imagen:
            raise Http404
        try:
            respuesta = FileResponse(producto.imagen.open('rb'), content_type='image/webp')
        except (FileNotFoundError, OSError):
            raise Http404 from None
        respuesta['Cache-Control'] = 'private, no-store'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        return respuesta

    def get_queryset(self):
        consulta = super().get_queryset()
        if self.action == 'imagen_producto':
            # Una miniatura no necesita cargar todas las paradas, cargas y cajillas.
            consulta = consulta.prefetch_related(None).select_related(None)
        vista = self.request.query_params.get('vista', 'en_curso')
        if vista == 'en_curso':
            return consulta.filter(estado__in=['borrador', 'en_ruta']) if self.action == 'list' else consulta
        if vista == 'historial':
            return consulta.filter(estado__in=['finalizado', 'cancelado']) if self.action == 'list' else consulta
        raise ValidationError({'vista': 'Selecciona una vista válida.'})
