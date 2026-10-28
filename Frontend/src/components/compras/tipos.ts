export interface PermisosCompras {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  registrar: boolean;
  cancelar: boolean;
}
export type EstadoCompra = "borrador" | "registrada" | "cancelada";
export interface OpcionCompra {
  id: number;
  nombre: string;
  subtitulo?: string;
  unidad_nombre?: string;
  categoria?: { id: number; nombre: string } | null;
}
export interface DetalleCompra {
  id: number;
  producto: number;
  presentacion: number | null;
  proveedor: number | null;
  producto_nombre: string;
  presentacion_nombre: string;
  unidad_nombre: string;
  proveedor_nombre: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
  cantidad_recibida: string;
  cantidad_pendiente: string;
}
export interface ReferenciaCompra {
  pedido: number;
  codigo: string;
  cliente_nombre: string;
  sucursal_nombre: string;
  detalles: {
    detalle_pedido: number;
    producto: number;
    producto_nombre: string;
    presentacion_nombre: string;
    columna: "cajas" | "unidades";
    cantidad: number;
  }[];
}
export interface ResumenCompra {
  id: number;
  codigo: string;
  fecha_pedidos: string;
  fecha_compra: string;
  responsable_nombre: string;
  estado: EstadoCompra;
  total: string;
  creado_en: string;
  version: string;
  cantidad_productos: number;
}
export interface Compra extends ResumenCompra {
  tiene_recepciones_activas: boolean;
  observaciones: string;
  detalles: DetalleCompra[];
  pedidos_referencia: ReferenciaCompra[];
  registrado_en: string | null;
  cancelado_en: string | null;
  motivo_cancelacion: string;
}
export interface LineaFormularioCompra {
  clave: string;
  id?: number;
  producto: OpcionCompra;
  presentacion: OpcionCompra | null;
  proveedor: OpcionCompra | null;
  cantidad: string;
  precioUnitario: string;
}
export interface PaginaCompra<T> {
  count: number;
  results: T[];
}
export interface NecesidadProducto extends OpcionCompra {
  disponible: boolean;
  cajas: number;
  unidades: number;
  pedidos: number;
}
export interface NecesidadSucursal {
  id: number;
  pedido: number;
  codigo: string;
  cliente: string;
  sucursal: string;
  producto: number;
  producto_nombre: string;
  presentacion_nombre: string;
  columna: "cajas" | "unidades";
  cantidad: number;
}
export interface ResumenNecesidades {
  pedidos: number;
  sucursales: number;
  productos: number;
}
export interface PaginaNecesidades<T> extends PaginaCompra<T> {
  compras_registradas: number;
  fecha_pedidos: string;
  resumen: ResumenNecesidades;
}
export const clasePanel =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const claseAccion =
  "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
export function claseEstado(estado: EstadoCompra) {
  return `inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${estado === "registrada" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : estado === "borrador" ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`;
}
