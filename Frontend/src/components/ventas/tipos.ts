export interface PermisosVentas {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  emitir: boolean;
  cancelar: boolean;
  descargar: boolean;
}
export interface ClienteVenta {
  id: number;
  nombre: string;
  nit: string;
}
export interface EntregaVenta {
  id: number;
  codigo: string;
  sucursal_nombre: string;
  codigo_pedido: string;
  fecha_recepcion: string;
  fecha_requerida: string;
  productos: number;
  peso_aceptado_kg: string;
  total: string | null;
  incidencias: string[];
}
export interface AporteVenta {
  aporte: number;
  codigo_lote: string;
  peso_aceptado_kg: string;
  importe: string | null;
}
export interface LineaVenta {
  linea_entrega: number;
  entrega: number;
  codigo_entrega: string;
  producto: number;
  producto_nombre: string;
  pedido: number;
  codigo_pedido: string;
  sucursal_nombre: string;
  fecha_recepcion: string;
  fecha_requerida: string;
  peso_aceptado_kg: string;
  precio_kg: string | null;
  importe: string | null;
  codigo_acuerdo: string | null;
  version_acuerdo: number | null;
  aportes: AporteVenta[];
}
export interface Venta {
  id: number;
  codigo: string;
  estado: "borrador" | "emitida" | "cancelada";
  version: string;
  cliente: number;
  cliente_nombre: string;
  cliente_nit: string;
  desde: string;
  hasta: string;
  fecha_emision: string | null;
  vencimiento: string | null;
  total: string | null;
  cobrado: string | null;
  saldo: string | null;
  estado_cobro: "pendiente" | null;
  peso_aceptado_kg: string | null;
  total_entregas: number;
  total_lineas: number;
  creado_en: string;
  registrado_por_nombre: string;
  emitido_por_nombre: string;
  emitido_en: string | null;
  seleccion: number[];
  entregas: EntregaVenta[];
  revision: string;
  incidencias: string[];
}
export interface FormularioVenta {
  cliente: ClienteVenta | null;
  desde: string;
  hasta: string;
  vencimiento: string;
  entregas: EntregaVenta[];
}
export type AccionVenta =
  "guardar" | "revisar" | "emitir" | "cancelar" | "reintentar";
export const panelVenta =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const campoVenta =
  "campo-suave-hortyfru min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
export const enlaceVenta =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300";
