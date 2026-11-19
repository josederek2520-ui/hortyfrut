import type {
  ComprobanteCobro,
  SaldoCobro,
  RevisionCobro,
} from "@/components/cobros/tipos";
export type EstadoPago = "por_verificar" | "confirmado" | "observado";
export interface AvisoPago {
  id: number;
  codigo: string;
  version: string;
  cliente: number;
  cliente_nombre: string;
  cliente_nit: string;
  fecha_cobro: string;
  importe: string;
  medio: "transferencia" | "deposito";
  estado: EstadoPago;
  informado_por_nombre: string;
  informado_en: string;
  revisado_por_nombre: string;
  revisado_en: string | null;
  motivo_observacion: string;
  cobro: number | null;
  codigo_cobro: string | null;
  comprobante: ComprobanteCobro;
  total_aplicaciones: number;
}
export interface VentaPropia extends SaldoCobro {
  cliente_nombre: string;
  por_verificar: string;
}
export interface PaginaPagos<T> {
  count: number;
  results: T[];
  next: string | null;
  previous: string | null;
  resumen?: {
    saldo: string;
    cobrado: string;
    por_verificar: string;
    total: string;
  };
}
export interface AplicacionPago {
  venta: number;
  codigo: string;
  importe: string;
  saldo_informado: string;
  saldo_actual: string;
  total: string;
}
export interface RevisionPago extends RevisionCobro {
  version_aviso: string;
}
