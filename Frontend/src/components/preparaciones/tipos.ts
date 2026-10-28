import type { OpcionCompra, PaginaCompra } from "@/components/compras/tipos";
export interface PermisosPreparaciones {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  confirmar: boolean;
  cancelar: boolean;
}
export interface OpcionPreparacion extends OpcionCompra {
  activo?: boolean;
  saldo?: number;
}
export interface CeldaHoja {
  solicitada: number;
  preparada: number;
  pendiente: number;
}
export interface ProductoConsolidado {
  id: number;
  nombre: string;
  categoria: string;
  cajas: number;
  unidades: number;
  preparadas_cajas: number;
  preparadas_unidades: number;
  pendientes_cajas: number;
  pendientes_unidades: number;
  sucursales: Record<string, Partial<Record<"cajas" | "unidades", CeldaHoja>>>;
  imagen?: string | null;
}
export interface ProductoPreparacion extends OpcionCompra {
  imagen?: string | null;
  pendientes_cajas?: number;
  pendientes_unidades?: number;
}
export interface HojaConsolidada extends PaginaCompra<ProductoConsolidado> {
  cliente: OpcionPreparacion;
  fecha_pedidos: string;
  version_hoja: string;
  sucursales: PaginaCompra<OpcionPreparacion>;
  resumen: {
    pedidos: number;
    productos: number;
    pedidos_pendientes: number;
    lineas_pendientes: number;
  };
}
export interface NecesidadPreparacion {
  id: number;
  pedido: number;
  codigo: string;
  sucursal: number;
  sucursal_nombre: string;
  producto: number;
  producto_nombre: string;
  presentacion_nombre: string;
  columna: "cajas" | "unidades";
  cantidad: number;
  preparada: number;
  pendiente: number;
  disponible: boolean;
}
export interface LotePreparacion extends OpcionCompra {
  producto: number;
  producto_nombre: string;
  unidad: number;
  unidad_nombre: string;
  unidad_abreviatura: string;
  saldo?: string;
  fecha_vencimiento?: string | null;
  es_kg: boolean;
  producto_imagen?: string | null;
  producto_categoria?: OpcionCompra;
}
export interface LineaPreparacion {
  id: number;
  lote: number;
  lote_codigo: string;
  producto: number;
  producto_nombre: string;
  unidad: number;
  unidad_nombre: string;
  unidad_abreviatura: string;
  cantidad_utilizada: string;
  merma: string;
  aprovechable: string;
  motivo_separacion: string;
  lote_aprovechable: number | null;
  lote_aprovechable_codigo: string | null;
  es_kg: boolean;
  producto_imagen?: string | null;
  producto_categoria?: OpcionCompra;
}
export interface AportePreparacion {
  id: number;
  lote: number;
  lote_codigo: string;
  cantidad: string;
  peso_kg: string | null;
  unidad_abreviatura: string;
}
export interface AsignacionPreparacion {
  id: number;
  pedido: number;
  codigo: string;
  detalle_pedido: number | null;
  sucursal: number;
  sucursal_nombre: string;
  producto: number;
  producto_nombre: string;
  presentacion_nombre: string;
  columna: "cajas" | "unidades";
  cantidad_solicitada: number;
  cantidad: number;
  aportes: AportePreparacion[];
  pendiente_actual: number;
  disponible: boolean;
  producto_imagen?: string | null;
  producto_categoria?: OpcionCompra;
}
export interface CajillaPrevista {
  id: number;
  sucursal: number;
  sucursal_nombre: string;
  cajilla: number;
  color: string;
  cantidad: number;
}
export interface ResumenPreparacion {
  id: number;
  codigo: string;
  cliente: number;
  cliente_nombre: string;
  fecha_pedidos: string;
  almacen: number;
  almacen_nombre: string;
  estado: "borrador" | "confirmada" | "cancelada";
  responsable_nombre: string;
  creado_en: string;
  version: string;
  cantidad_productos: number;
}
export interface Preparacion extends ResumenPreparacion {
  observaciones: string;
  lineas: LineaPreparacion[];
  asignaciones: AsignacionPreparacion[];
  cajillas: CajillaPrevista[];
  confirmado_en: string | null;
  cancelado_en: string | null;
  motivo_cancelacion: string;
  movimiento_salida: number | null;
  movimiento_aprovechable: number | null;
  salida_codigo: string | null;
  aprovechable_codigo: string | null;
}
export interface LineaEditable {
  lote: LotePreparacion;
  merma: string;
  aprovechable: string;
  motivo: string;
}
export interface AporteEditable {
  cantidad: string;
  pesoKg: string;
}
export interface AsignacionEditable {
  clave: string;
  detalle: number | null;
  pedido: number;
  codigo: string;
  sucursal: number;
  sucursalNombre: string;
  producto: number;
  productoNombre: string;
  presentacion: string;
  columna: "cajas" | "unidades";
  solicitada: number;
  pendiente: number;
  disponible: boolean;
  cantidad: string;
  aportes: Record<number, AporteEditable>;
  imagen?: string | null;
  categoria?: OpcionCompra;
}
export interface CajillaEditable {
  clave: string;
  sucursal: OpcionPreparacion;
  color: OpcionPreparacion;
  cantidad: string;
}
export interface DocumentoEditable {
  lineas: LineaEditable[];
  asignaciones: Record<string, AsignacionEditable>;
  cajillas: CajillaEditable[];
}
