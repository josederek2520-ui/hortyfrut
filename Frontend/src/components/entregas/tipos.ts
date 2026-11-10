export interface PermisosEntregas {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  enviar: boolean;
  confirmar: boolean;
  ver_todas: boolean;
  gestionar_todas: boolean;
}
export interface AporteOrigen {
  carga: number;
  lote: number;
  codigo_lote: string;
  preparacion: string;
  cantidad: string;
  unidad: string;
  peso_kg: string | null;
}
export interface ProductoEntrega {
  pedido_cajas?: number;
  pedido_unidades?: number;
  producto: number;
  nombre: string;
  cajas: number;
  unidades: number;
  peso_kg: string | null;
  aportes: AporteOrigen[];
  categoria?: string;
  imagen?: string | null;
}
export type CampoRecepcion =
  | "cajas_recibidas"
  | "unidades_recibidas"
  | "peso_recibido_kg"
  | "cajas_rechazadas"
  | "unidades_rechazadas"
  | "peso_rechazado_kg"
  | "motivo_rechazo";
export type LineaEditable = Record<CampoRecepcion, string>;
export interface AporteEditable {
  carga: number;
  lote: number;
  peso_recibido_kg: string;
  peso_rechazado_kg: string;
}
export interface HojaEntrega {
  id: number | null;
  codigo: string;
  estado: "pendiente" | "borrador" | "revision" | "confirmada";
  version: string;
  fecha_recepcion: string | null;
  recibido_por: string;
  recibido_por_usuario?: number | null;
  receptor_por_registrar?: boolean;
  receptor_asignado?: { id: number; nombre: string } | null;
  acciones?: AccionesEntrega;
  responsable_nombre: string;
  confirmado_por_nombre: string;
  fecha_minima: string;
  fecha_maxima: string;
  confirmado_en: string | null;
  comprobante: boolean;
  origen: {
    despacho: number;
    pedido: number;
    codigo_despacho: string;
    codigo_pedido: string;
    cliente_nombre: string;
    sucursal_nombre: string;
    descargada_en: string;
    productos: ProductoEntrega[];
  };
  lineas: ({ producto: number } & Record<
    CampoRecepcion,
    string | number | null
  >)[];
  aportes: AporteEditable[];
}
export interface FilaListadoEntrega {
  despacho: number;
  pedido: number;
  codigo_despacho: string;
  codigo_pedido: string;
  cliente_nombre: string;
  sucursal_nombre: string;
  fecha_reparto?: string;
  descargada_en: string;
  estado: HojaEntrega["estado"];
  acciones?: AccionesEntrega;
}
export interface AccionesEntrega {
  registrar: boolean;
  editar: boolean;
  enviar: boolean;
  revisar: boolean;
}
export interface PaginaEntrega<T> {
  count: number;
  results: T[];
  resumen_estados?: Record<HojaEntrega["estado"], number>;
}
export const panelEntrega =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const entradaEntrega =
  "campo-suave-hortyfru min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800";
