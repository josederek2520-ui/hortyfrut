import type { OpcionCompra } from "@/components/compras/tipos";
export interface PermisosRecepciones {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  confirmar: boolean;
  cancelar: boolean;
}
export interface UnidadRecepcion extends OpcionCompra {
  abreviatura: string;
  es_kg: boolean;
}
export interface OrigenRecepcion extends OpcionCompra {
  fecha_compra: string;
  tiene_pendientes?: boolean;
}
export interface OpcionProductoRecepcion extends OpcionCompra {
  producto: number;
  unidad: UnidadRecepcion;
  disponible: boolean;
  medida_compra?: string;
  cantidad_comprada?: string;
  cantidad_recibida?: string;
  cantidad_pendiente?: string;
  proveedor_nombre?: string;
  unidad_compra?: number | null;
}
export interface DetalleRecepcion {
  id: number;
  detalle_compra: number | null;
  producto: number;
  producto_nombre: string;
  unidad_inventario: number;
  unidad_nombre: string;
  unidad_abreviatura: string;
  medida_compra_nombre: string;
  cantidad_compra: string;
  cantidad_inventario: string;
  peso_kg: string | null;
  fecha_vencimiento: string | null;
  lote: number | null;
  lote_codigo: string | null;
  es_kg: boolean;
  proveedor_nombre?: string;
  unidad_compra?: number | null;
  cantidad_pendiente?: string | null;
}
export interface ResumenRecepcion {
  id: number;
  codigo: string;
  compra: number | null;
  compra_codigo: string | null;
  almacen: number;
  almacen_nombre: string;
  fecha_recepcion: string;
  estado: "borrador" | "confirmada" | "cancelada";
  responsable_nombre: string;
  creado_en: string;
  version: string;
  cantidad_productos: number;
}
export interface Recepcion extends ResumenRecepcion {
  detalles: DetalleRecepcion[];
  observaciones: string;
  confirmado_en: string | null;
  cancelado_en: string | null;
  motivo_cancelacion: string;
  movimiento: number | null;
  movimiento_codigo: string | null;
  compra_fecha: string | null;
}
export interface LineaRecepcion {
  clave: string;
  id?: number;
  detalleCompra: number | null;
  producto: OpcionCompra;
  unidad: UnidadRecepcion;
  medidaCompra: string;
  pendiente?: string;
  cantidadCompra: string;
  cantidadInventario: string;
  pesoKg: string;
  vencimiento: string;
  proveedorNombre?: string;
  unidadCompra?: number | null;
  disponible?: boolean;
}
