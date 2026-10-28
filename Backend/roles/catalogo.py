"""Only permissions of implemented application modules belong in this catalog."""
from django.contrib.auth.models import Permission
from django.db.models import Q

MODULOS = {
    'preparaciones': {'label': 'Preparaciones de pedidos', 'app': 'preparaciones', 'model': 'preparacion', 'permissions': {
        'view_preparacion': 'Ver preparaciones y hoja consolidada', 'add_preparacion': 'Crear preparaciones', 'change_preparacion': 'Editar preparaciones',
        'confirmar_preparacion': 'Confirmar preparaciones', 'cancelar_preparacion': 'Cancelar borradores de preparación'}},
    'cajillas': {'label': 'Cajillas', 'app': 'cajillas', 'model': 'cajilla', 'permissions': {
        'view_cajilla': 'Ver cajillas', 'add_cajilla': 'Registrar colores de cajillas', 'registrar_ingreso': 'Registrar ingresos de cajillas',
        'registrar_salida': 'Registrar salidas de cajillas', 'registrar_devolucion': 'Registrar devoluciones de cajillas'}},
    'recepciones': {'label': 'Recepciones', 'app': 'recepciones', 'model': 'recepcion', 'permissions': {
        'view_recepcion': 'Ver recepciones', 'add_recepcion': 'Crear recepciones', 'change_recepcion': 'Editar recepciones',
        'confirmar_recepcion': 'Confirmar recepciones', 'cancelar_recepcion': 'Cancelar borradores de recepción'}},
    'lotes': {'label': 'Lotes', 'app': 'inventario', 'model': 'lote', 'permissions': {
        'view_lote': 'Ver lotes', 'cambiar_estado_lote': 'Bloquear o desbloquear lotes'}},
    'movimientos_inventario': {'label': 'Movimientos de inventario', 'app': 'inventario', 'model': 'movimientoinventario', 'permissions': {
        'view_movimientoinventario': 'Ver movimientos de inventario'}},
    'unidades_inventario': {'label': 'Unidades de inventario', 'app': 'inventario', 'model': 'unidadinventarioproducto', 'permissions': {
        'gestionar_unidades_inventario': 'Gestionar unidades de inventario por producto'}},
    'almacenes': {'label': 'Almacenes', 'app': 'almacenes', 'model': 'almacen', 'permissions': {
        'view_almacen': 'Ver almacenes', 'add_almacen': 'Crear almacenes', 'change_almacen': 'Editar almacenes',
        'cambiar_estado_almacen': 'Activar o desactivar almacenes'}},
    'compras': {'label': 'Compras', 'app': 'compras', 'model': 'compra', 'permissions': {
        'view_compra': 'Ver compras', 'add_compra': 'Crear compras', 'change_compra': 'Editar compras',
        'registrar_compra': 'Registrar compras', 'cancelar_compra': 'Cancelar compras'}},
    'proveedores': {'label': 'Proveedores', 'app': 'proveedores', 'model': 'proveedor', 'permissions': {
        'view_proveedor': 'Ver proveedores', 'add_proveedor': 'Crear proveedores', 'change_proveedor': 'Editar proveedores',
        'cambiar_estado_proveedor': 'Activar o desactivar proveedores'}},
    'pedidos': {'label': 'Pedidos', 'app': 'pedidos', 'model': 'pedido', 'permissions': {
        'view_pedido': 'Ver pedidos', 'add_pedido': 'Crear pedidos', 'change_pedido': 'Editar pedidos',
        'cancelar_pedido': 'Cancelar pedidos', 'ver_todos_pedidos': 'Ver pedidos de todas las sucursales',
        'gestionar_todos_pedidos': 'Gestionar pedidos de todas las sucursales'}},
    'clientes': {'label': 'Clientes', 'app': 'clientes', 'model': 'cliente', 'permissions': {
        'view_cliente': 'Ver clientes', 'add_cliente': 'Crear clientes',
        'change_cliente': 'Editar clientes', 'cambiar_estado_cliente': 'Activar o desactivar clientes'}},
    'sucursales': {'label': 'Sucursales de clientes', 'app': 'clientes', 'model': 'sucursal', 'permissions': {
        'view_sucursal': 'Ver sucursales', 'add_sucursal': 'Crear sucursales',
        'change_sucursal': 'Editar sucursales', 'cambiar_estado_sucursal': 'Activar o desactivar sucursales',
        'asignar_encargado': 'Asignar encargado de pedidos'}},
    'presentaciones': {'label': 'Presentaciones de productos', 'app': 'productos', 'model': 'presentacionproducto', 'permissions': {
        'view_presentacionproducto': 'Ver presentaciones', 'add_presentacionproducto': 'Crear presentaciones',
        'change_presentacionproducto': 'Editar presentaciones', 'cambiar_estado_presentacionproducto': 'Activar o desactivar presentaciones'}},
    'productos': {'label': 'Productos', 'app': 'productos', 'model': 'producto', 'permissions': {
        'view_producto': 'Ver productos', 'add_producto': 'Crear productos',
        'change_producto': 'Editar productos', 'cambiar_estado_producto': 'Activar o desactivar productos'}},
    'unidades_medida': {'label': 'Unidades de medida', 'app': 'catalogos', 'model': 'unidadmedida', 'permissions': {
        'view_unidadmedida': 'Ver unidades de medida', 'add_unidadmedida': 'Crear unidades de medida',
        'change_unidadmedida': 'Editar unidades de medida', 'cambiar_estado_unidadmedida': 'Activar o desactivar unidades de medida'}},
    'categorias_productos': {'label': 'Categorías de productos', 'app': 'catalogos', 'model': 'categoriaproducto', 'permissions': {
        'view_categoriaproducto': 'Ver categorías de productos', 'add_categoriaproducto': 'Crear categorías de productos',
        'change_categoriaproducto': 'Editar categorías de productos', 'cambiar_estado_categoriaproducto': 'Activar o desactivar categorías de productos'}},
    'usuarios': {'label': 'Usuarios', 'app': 'usuarios', 'model': 'usuario', 'permissions': {
        'view_usuario': 'Ver usuarios', 'add_usuario': 'Crear usuarios', 'change_usuario': 'Editar usuarios',
        'desactivar_usuario': 'Activar o desactivar usuarios', 'asignar_roles': 'Asignar roles',
        'restablecer_password': 'Restablecer contraseñas'}},
    'roles': {'label': 'Roles y permisos', 'app': 'auth', 'model': 'group', 'permissions': {
        'view_group': 'Ver roles', 'add_group': 'Crear roles', 'change_group': 'Editar roles', 'delete_group': 'Eliminar roles'}},
    'auditoria': {'label': 'Registro de actividad', 'app': 'auditoria', 'model': 'registroactividad', 'permissions': {
        'ver_registroactividad': 'Ver registro de actividad'}},
}


def permisos_publicos():
    query = Q(pk__in=[])
    for module in MODULOS.values():
        query |= Q(content_type__app_label=module['app'], content_type__model=module['model'], codename__in=module['permissions'])
    return Permission.objects.filter(query).select_related('content_type')


def permiso_data(permission, actor):
    module_key, label = 'other', permission.codename
    for key, module in MODULOS.items():
        if permission.content_type.app_label == module['app'] and permission.content_type.model == module['model'] and permission.codename in module['permissions']:
            module_key, label = key, module['permissions'][permission.codename]
            break
    code = f'{permission.content_type.app_label}.{permission.codename}'
    return {'id': permission.pk, 'code': code, 'label': label, 'module': module_key,
            'asignable': module_key != 'other' and actor.has_perm(code)}
