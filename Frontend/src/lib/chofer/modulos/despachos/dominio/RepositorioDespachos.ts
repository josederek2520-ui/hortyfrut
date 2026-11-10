import type { Pagina } from "@/lib/chofer/compartido/dominio/Pagina";
import type { Pedido, ProductoPedido, Viaje, ViajeDetalle } from "./Viaje";
export interface RepositorioDespachos {
  listar(
    pagina: number,
    estado: string,
    senal?: AbortSignal,
  ): Promise<Pagina<Viaje>>;
  detalle(identificador: number, senal?: AbortSignal): Promise<ViajeDetalle>;
  pedidos(
    viaje: number,
    parada: number,
    pagina: number,
    senal?: AbortSignal,
  ): Promise<Pagina<Pedido>>;
  productos(
    viaje: number,
    parada: number,
    pedido: number,
    pagina: number,
    senal?: AbortSignal,
  ): Promise<Pagina<ProductoPedido>>;
  operar(
    viaje: number,
    accion: string,
    datos: DocumentoOperacion,
  ): Promise<ViajeDetalle>;
}
export interface DocumentoOperacion {
  version: string;
  clave_operacion: string;
  parada?: number;
  pedido?: number;
  cargas_comprobadas?: number[];
}
