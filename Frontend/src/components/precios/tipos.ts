export type EstadoPrecio =
  "borrador" | "propuesta" | "aceptado" | "rechazado" | "cancelado";
export type AlcancePrecio = "periodo" | "entregas";
export type AccionPrecio =
  | "guardar"
  | "presentar"
  | "aceptar"
  | "rechazar"
  | "cancelar"
  | "nueva_version"
  | "reintentar";
export interface PermisosPrecios {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  presentar: boolean;
  aceptar: boolean;
  rechazar: boolean;
  cancelar: boolean;
}
export interface LineaPrecio {
  producto: number;
  producto_nombre: string;
  categoria_nombre: string;
  precio_kg: string;
  precio_anterior: string | null;
}
export interface AcuerdoPrecio {
  id: number;
  codigo: string;
  version: string;
  estado: EstadoPrecio;
  cliente: number;
  cliente_nombre: string;
  alcance: AlcancePrecio;
  desde: string | null;
  hasta: string | null;
  referencia_propuesta: string;
  numero_version: number;
  anterior: number | null;
  es_actual: boolean;
  motivo_version: string;
  motivo_rechazo: string;
  registrado_por_nombre: string;
  propuesto_por_nombre: string;
  propuesto_en: string | null;
  revisado_por_nombre: string;
  revisado_en: string | null;
  creado_en: string;
  total_productos: number;
  lineas: LineaPrecio[];
  entregas: number[];
}
export interface FormularioPrecio {
  cliente: { id: number; nombre: string } | null;
  alcance: AlcancePrecio;
  desde: string;
  hasta: string;
  referencia_propuesta: string;
  lineas: LineaPrecio[];
  entregas: number[];
}
export interface OpcionPrecio {
  id: number;
  nombre: string;
  categoria_nombre?: string;
  sucursal_nombre?: string;
  fecha_requerida?: string;
  codigo_pedido?: string;
}
export const panelPrecio =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const campoPrecio =
  "campo-suave-hortyfru min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white";
