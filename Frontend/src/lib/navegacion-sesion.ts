import type { Session as Sesion } from "@/components/users/types";

export function rutaInicial(sesion: Sesion | null): string {
  if (sesion?.capabilities.view) return "/usuarios";
  if (sesion?.role_capabilities.view) return "/roles";
  if (sesion?.permisos_actividad.ver) return "/actividad";
  if (sesion?.permisos_catalogos.unidades_medida.ver) return "/unidades-medida";
  if (sesion?.permisos_catalogos.categorias_productos.ver)
    return "/categorias-productos";
  if (sesion?.permisos_productos?.ver) return "/productos";
  if (sesion?.permisos_clientes?.ver) return "/clientes";
  if (sesion?.permisos_proveedores?.ver) return "/proveedores";
  if (sesion?.permisos_pedidos?.ver) return "/pedidos";
  if (sesion?.permisos_compras?.ver) return "/compras";
  if (sesion?.permisos_almacenes?.ver) return "/almacenes";
  if (sesion?.permisos_recepciones?.ver) return "/recepciones";
  if (sesion?.permisos_inventario?.ver_lotes) return "/lotes";
  if (sesion?.permisos_inventario?.ver_movimientos)
    return "/movimientos-inventario";
  if (sesion?.permisos_cajillas?.ver) return "/cajillas";
  if (sesion?.permisos_preparaciones?.ver) return "/preparaciones";
  return "/profile";
}
