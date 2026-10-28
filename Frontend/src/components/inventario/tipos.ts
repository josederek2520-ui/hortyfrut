export interface PermisosInventario {
  ver_lotes: boolean;
  cambiar_estado_lotes: boolean;
  ver_movimientos: boolean;
  gestionar_unidades: boolean;
}
export interface UnidadInventario {
  id: number;
  nombre: string;
  abreviatura: string;
  es_base: boolean;
  activo: boolean;
  vigente: boolean;
  version: string;
}
export interface Lote {
  calidad: "apto" | "aprovechable";
  lote_origen: number | null;
  preparacion: { id: number; codigo: string } | null;
  id: number;
  codigo: string;
  producto: number;
  producto_nombre: string;
  unidad_nombre: string;
  unidad_abreviatura: string;
  almacen_origen: number;
  almacen_nombre: string;
  fecha_ingreso: string;
  fecha_vencimiento: string | null;
  peso_kg_ingreso: string | null;
  estado: "disponible" | "bloqueado";
  saldo: string;
  vencido: boolean;
  disponible: boolean;
  version: string;
  recepcion: { id: number; codigo: string } | null;
  creado_en: string;
}
export interface MovimientoInventario {
  tipo: "entrada_recepcion" | "salida_preparacion" | "entrada_aprovechable";
  naturaleza: "entrada" | "salida";
  referencia_tipo: "recepcion" | "preparacion";
  id: number;
  codigo: string;
  almacen_nombre: string;
  fecha: string;
  referencia_id: number;
  referencia_codigo: string;
  responsable_nombre: string;
  cantidad_lotes: number;
  creado_en: string;
  detalles: {
    id: number;
    lote: number;
    lote_codigo: string;
    producto_nombre: string;
    unidad_abreviatura: string;
    cantidad: string;
  }[];
}
export const claseEnlaceInventario =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 focus-visible:ring-3 focus-visible:ring-brand-400 dark:text-brand-300 dark:ring-brand-800 dark:hover:bg-brand-500/10";
export const claseSelectorInventario =
  "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus-visible:ring-3 focus-visible:ring-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
