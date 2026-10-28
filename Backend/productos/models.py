import uuid
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from catalogos.models import CatalogoBase


def ruta_imagen_producto(instancia, nombre):
    return f'productos/{uuid.uuid4().hex}.webp'


class Producto(CatalogoBase):
    categoria = models.ForeignKey('catalogos.CategoriaProducto', on_delete=models.PROTECT, related_name='productos')
    unidad_medida = models.ForeignKey('catalogos.UnidadMedida', on_delete=models.PROTECT, related_name='productos')
    imagen = models.ImageField(upload_to=ruta_imagen_producto, blank=True, max_length=200)

    class Meta(CatalogoBase.Meta):
        abstract = False
        db_table = 'productos'
        verbose_name = 'producto'
        verbose_name_plural = 'productos'
        permissions = [('cambiar_estado_producto', 'Activar o desactivar productos')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), name='producto_nombre_unico_ci'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='producto_nombre_valido'),
        ]


class PresentacionProducto(CatalogoBase):
    class ColumnaPedido(models.TextChoices):
        CAJAS = 'cajas', 'Cajas (CANT)'
        UNIDADES = 'unidades', 'Unidades (UNI)'
        OTRA = 'otra', 'Sin columna en la hoja'

    class Uso(models.TextChoices):
        COMPRA = 'compra', 'Compras'
        PEDIDO = 'pedido', 'Pedidos'
        AMBOS = 'ambos', 'Compras y pedidos'

    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='presentaciones')
    uso = models.CharField(max_length=10, choices=Uso.choices, default=Uso.AMBOS)
    columna_pedido = models.CharField(max_length=10, choices=ColumnaPedido.choices, default=ColumnaPedido.OTRA)

    class Meta(CatalogoBase.Meta):
        abstract = False
        db_table = 'presentaciones_producto'
        verbose_name = 'presentación de producto'
        verbose_name_plural = 'presentaciones de productos'
        permissions = [('cambiar_estado_presentacionproducto', 'Activar o desactivar presentaciones')]
        constraints = [
            models.UniqueConstraint(Lower('nombre'), 'producto', name='presentacion_nombre_unico_producto'),
            models.CheckConstraint(condition=~Q(nombre='') & Q(nombre=Trim('nombre')), name='presentacion_nombre_valido'),
            models.CheckConstraint(condition=Q(uso__in=['compra', 'pedido', 'ambos']), name='presentacion_uso_valido'),
            models.UniqueConstraint(fields=['producto', 'columna_pedido'], condition=Q(columna_pedido__in=['cajas', 'unidades']), name='presentacion_columna_unica'),
            models.CheckConstraint(condition=Q(columna_pedido='otra') | Q(columna_pedido__in=['cajas', 'unidades'], uso__in=['pedido', 'ambos']), name='presentacion_columna_valida'),
        ]
