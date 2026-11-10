export interface PaginaLogistica<T> {
  count: number;
  results: T[];
}
export interface OpcionLogistica {
  id: number;
  nombre: string;
  detalle?: string;
  ocupado?: boolean;
  capacidad_kg?: string | null;
  disponible?: number;
}
export const clasePanel =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const claseEntrada =
  "campo-suave-hortyfru min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
export const claseAccion =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
