export type EstadoViaje = "borrador" | "en_ruta" | "finalizado" | "cancelado";
export interface ResumenViaje {
  cajas: number;
  unidades: number;
  pesoKg: string;
  paradas: number;
  completadas: number;
  pedidos: number;
  pedidosDescargados: number;
  cajillas: number;
}
export interface Viaje {
  id: number;
  codigo: string;
  estado: EstadoViaje;
  fechaReparto: string;
  vehiculo: string;
  chofer: string;
  almacen: string;
  version: string;
  enviadoEn: string | null;
  siguienteDestino?: { cliente: string; sucursal: string } | null;
  resumen: ResumenViaje;
}
export interface Parada {
  id: number;
  sucursal: number;
  cliente: string;
  nombre: string;
  direccion: string;
  orden: number;
  llegadaEn: string | null;
  descargadaEn: string | null;
  pedidos: number;
  pedidosDescargados: number;
}
export interface ViajeDetalle extends Viaje {
  paradas: Parada[];
  capacidad:
    "apta" | "sin_carga" | "sin_capacidad" | "peso_incompleto" | "excedida";
  observaciones: string;
  cajillas: { sucursal: number; color: string; cantidad: number }[];
}
export interface Pedido {
  id: number;
  parada: number;
  codigo: string;
  fechaRequerida: string;
  cajas: number;
  unidades: number;
  pesoKg: string;
  productos: number;
  asignaciones: number;
  descargadaEn: string | null;
  responsable: string;
  registroAnterior: boolean;
}
export interface ProductoPedido {
  id: number;
  pedido: number;
  codigoPedido: string;
  nombre: string;
  presentacion: string;
  columna: "cajas" | "unidades";
  cantidad: number;
  pesoKg: string;
  codigoPreparacion: string;
  descargadaEn: string | null;
  aportes: {
    lote: number;
    codigo: string;
    cantidad: string;
    unidad: string;
    pesoKg: string;
  }[];
}
