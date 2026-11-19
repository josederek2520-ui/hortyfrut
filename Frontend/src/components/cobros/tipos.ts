import type { ClienteVenta } from "@/components/ventas/tipos";
export type MedioCobro =
  "efectivo" | "transferencia" | "deposito" | "cheque" | "otro";
export type MedioNuevoCobro = Exclude<MedioCobro, "cheque">;
export interface ComprobanteCobro {
  nombre: string;
  tipo: string;
  tamano: number;
  sha256: string;
}
export interface SaldoCobro {
  id: number;
  codigo: string;
  cliente: number;
  fecha_emision: string;
  total: string;
  cobrado: string;
  saldo: string;
  version_saldo: string;
  estado_cobro: "pendiente" | "parcial" | "pagada";
}
export interface SeleccionCobro extends SaldoCobro {
  importeAplicado: string;
}
export interface FormularioCobro {
  cliente: ClienteVenta | null;
  fecha_cobro: string;
  importe: string;
  medio: MedioNuevoCobro;
  comprobante: File | null;
  aplicaciones: SeleccionCobro[];
}
export interface AplicacionCobro {
  venta: number;
  codigo: string;
  importe: string;
  saldo_anterior: string;
  saldo_posterior: string;
}
export interface RevisionCobro {
  fecha_cobro: string;
  medio: MedioNuevoCobro;
  comprobante: ComprobanteCobro | null;
  revision: string;
  importe: string;
  cliente_nombre: string;
  cliente_nit: string;
  aplicaciones: AplicacionCobro[];
}
export interface Cobro {
  id: number;
  codigo: string;
  cliente: number;
  cliente_nombre: string;
  cliente_nit: string;
  fecha_cobro: string;
  importe: string;
  medio: MedioCobro;
  referencia: string;
  comprobante: ComprobanteCobro | null;
  registrado_por_nombre: string;
  registrado_en: string;
  total_aplicaciones: number;
}
export interface PaginaCobros<T> {
  count: number;
  results: T[];
  total_cobrado?: string;
  version_origen?: string;
}
