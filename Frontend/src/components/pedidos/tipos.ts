export interface PaginaResultados<T> {
  count: number;
  results: T[];
}
export interface PermisosPedidos {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  cancelar: boolean;
  ver_todos: boolean;
  gestionar_todos: boolean;
}
export interface OpcionPedido {
  id: number;
  nombre: string;
  cliente?: string;
  responsable?: string;
  activo?: boolean;
}
export interface DestinosPedido extends PaginaResultados<OpcionPedido> {
  sucursal_asignada: OpcionPedido | null;
}
export interface PresentacionHoja {
  id: number;
  nombre: string;
  disponible: boolean;
}
export interface ProductoHoja {
  id: number;
  nombre: string;
  imagen: string | null;
  categoria: { id: number; nombre: string };
  cajas: PresentacionHoja | null;
  unidades: PresentacionHoja | null;
}
export type ColumnaPedido = "cajas" | "unidades";
export interface CantidadHoja {
  producto: ProductoHoja;
  cajas: string;
  unidades: string;
}
export type CantidadesHoja = Record<number, CantidadHoja>;
export interface LineaPedido {
  cantidad_preparada: number;
  cantidad_pendiente: number;
  imagen: string | null;
  id: number;
  producto: number;
  presentacion: number;
  columna: ColumnaPedido;
  cantidad: number;
  producto_nombre: string;
  presentacion_nombre: string;
  categoria_nombre: string;
}
export interface Pedido {
  bloqueado_preparacion: boolean;
  puede_editar: boolean;
  puede_cancelar: boolean;
  id: number;
  codigo: string;
  sucursal: number;
  cliente_nombre: string;
  sucursal_nombre: string;
  responsable_nombre: string;
  fecha_requerida: string;
  estado: "pendiente" | "preparado" | "cancelado";
  creado_en: string;
  cantidad_productos: number;
  version: string;
  direccion: string;
  detalles: LineaPedido[];
  cancelado_en: string | null;
  motivo_cancelacion: string;
}
export const clasePanel =
  "superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
export const claseEntrada =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800";
