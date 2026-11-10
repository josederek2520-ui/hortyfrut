export interface PermisosDevoluciones {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  recibir: boolean;
  revisar: boolean;
  cancelar: boolean;
}
export type EstadoDevolucion =
  "borrador" | "recibida" | "revisada" | "cancelada";
export interface OrigenDevolucion {
  id: number;
  codigo: string;
  pedido: number;
  despacho: number;
  codigo_pedido: string;
  codigo_despacho: string;
  cliente_nombre: string;
  sucursal_nombre: string;
  descargada_en: string;
  confirmado_en: string;
  fecha_minima: string;
  version: string;
}
export interface AporteDevolucion {
  id: number;
  aporte?: number;
  producto: number;
  producto_nombre: string;
  carga: number;
  lote: number;
  codigo_lote: string;
  preparacion: string;
  unidad: number;
  unidad_nombre: string;
  unidad_abreviatura: string;
  es_kg: boolean;
  cantidad_enviada: string;
  peso_recibido_entrega: string;
  peso_rechazado_entrega: string;
  cantidad_devuelta: string;
  peso_devuelto: string;
  maximo_cantidad: string;
  maximo_peso: string;
  fecha_vencimiento: string | null;
  vencido: boolean;
}
export const camposDevolucion = [
  "cantidad_recibida",
  "peso_kg_recibido",
  "cantidad_aprovechable",
  "cantidad_merma",
  "peso_kg_aprovechable",
  "peso_kg_merma",
] as const;
export type CampoDevolucion = (typeof camposDevolucion)[number];
export type ValoresDevolucion = Record<CampoDevolucion, string>;
export interface LineaDevolucion extends Record<
  CampoDevolucion,
  string | null
> {
  aporte: number;
  es_kg: boolean;
  producto_nombre: string;
  unidad_abreviatura: string;
  lote_retenido: { id: number; codigo: string } | null;
  lote_aprovechable: { id: number; codigo: string } | null;
}
export interface LineaEditableDevolucion extends ValoresDevolucion {
  aporte: number;
  es_kg: boolean;
  producto_nombre: string;
  unidad_abreviatura: string;
}
export interface Devolucion {
  id: number;
  codigo: string;
  estado: EstadoDevolucion;
  version: string;
  entrega: number;
  codigo_entrega: string;
  almacen: number;
  almacen_nombre: string;
  cliente_nombre: string;
  sucursal_nombre: string;
  codigo_pedido: string;
  fecha_recepcion: string | null;
  motivo: string;
  motivo_revision: string;
  creado_en: string;
  responsable_nombre: string;
  recibido_por_nombre: string;
  recibido_en: string | null;
  revisado_por_nombre: string;
  revisado_en: string | null;
  origen: OrigenDevolucion;
  fecha_maxima: string;
  lineas: LineaDevolucion[];
  movimientos: { id: number; codigo: string; tipo: string }[];
}
export interface PaginaDevoluciones<T> {
  count: number;
  results: T[];
  entrega?: OrigenDevolucion;
  orden_aportes?: number[];
  fecha_maxima?: string;
}
export type AccionDevolucion =
  | "guardar"
  | "recibir"
  | "guardar_revision"
  | "revisar"
  | "cancelar"
  | "reintentar";
export const panelDevolucion =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const entradaDevolucion =
  "campo-suave-hortyfru min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
