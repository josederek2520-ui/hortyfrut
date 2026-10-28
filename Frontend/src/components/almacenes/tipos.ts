export interface Almacen {
  id: number;
  nombre: string;
  direccion: string;
  latitud: string | null;
  longitud: string | null;
  activo: boolean;
  creado_en: string;
  version: string;
}
export interface PaginaAlmacenes {
  count: number;
  results: Almacen[];
}
export interface ResumenAlmacenes {
  total: number;
  activos: number;
  inactivos: number;
}
export const clasePanel =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const claseAccion =
  "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
export function claseEstado(activo: boolean) {
  return `inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${activo ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`;
}
