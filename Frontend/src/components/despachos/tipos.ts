export interface PermisosDespachos {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  iniciar: boolean;
  enviar: boolean;
  recorrido: boolean;
  finalizar: boolean;
  cancelar: boolean;
}
export interface AporteCarga {
  lote: number;
  codigo_lote: string;
  cantidad: string;
  unidad: string;
  peso_kg: string;
}
export interface CargaPreparada {
  id: number;
  asignacion?: number;
  preparacion: number;
  codigo_preparacion: string;
  pedido: number;
  codigo_pedido: string;
  sucursal: number;
  sucursal_nombre: string;
  cliente_nombre: string;
  direccion?: string;
  producto: number;
  producto_nombre: string;
  presentacion_nombre: string;
  columna: "cajas" | "unidades";
  cantidad: number;
  peso_kg: string;
  fecha_requerida: string;
  aportes: AporteCarga[];
  cajillas_previstas?: {
    preparacion_id: number;
    producto_id?: number | null;
    sucursal_id: number;
    cajilla_id: number;
    color: string;
    cantidad: number;
  }[];
}
export interface CajillaCarga {
  sucursal: number;
  cajilla: number;
  color: string;
  cantidad: number;
}

export interface PedidoCargaDespacho {
  pedido: number;
  codigo_pedido: string;
  fecha_requerida: string;
  asignaciones: number;
  productos: number;
  cajas: number;
  unidades: number;
  peso_kg: string;
}
export interface DestinoCargaDespacho {
  sucursal: number;
  sucursal_nombre: string;
  cliente_nombre: string;
  direccion?: string;
  pedidos: number;
  asignaciones: number;
  productos: number;
  cajas: number;
  unidades: number;
  peso_kg: string;
}
export interface ParadaDespacho {
  id: number;
  sucursal: number;
  sucursal_nombre: string;
  cliente_nombre: string;
  direccion: string;
  orden: number;
  llegada_en: string | null;
  descargada_en: string | null;
  pedidos: number;
  pedidos_descargados: number;
}
export interface PedidoDescarga {
  pedido: number;
  parada: number;
  codigo_pedido: string;
  fecha_requerida: string;
  sucursal: number;
  productos: number;
  asignaciones: number;
  cajas: number;
  unidades: number;
  peso_kg: string;
  descargada_en: string | null;
  responsable_descarga_nombre: string;
  registro_anterior: boolean;
}
export interface ResumenDespacho {
  cajas: number;
  unidades: number;
  peso_kg: string;
  paradas: number;
  completadas: number;
  cajillas: number;
  pedidos: number;
  pedidos_descargados: number;
}
export interface Despacho {
  id: number;
  codigo: string;
  almacen: number;
  almacen_nombre: string;
  vehiculo: number;
  vehiculo_placa: string;
  chofer: number;
  chofer_nombre: string;
  fecha_reparto: string;
  estado: "borrador" | "en_ruta" | "finalizado" | "cancelado";
  observaciones: string;
  responsable_nombre: string;
  creado_en: string;
  salida_en: string | null;
  retorno_en: string | null;
  enviado_en: string | null;
  enviado_por_nombre: string;
  version: string;
  resumen: ResumenDespacho;
  siguiente_destino?: {
    cliente_nombre: string;
    sucursal_nombre: string;
    orden: number;
  } | null;
}
export interface DetalleDespacho extends Despacho {
  cajillas_automaticas?: boolean | null;
  cajillas_sugeridas?: CajillaCarga[];
  vehiculo_capacidad_kg: string | null;
  comprobacion_capacidad: import("./capacidadDespacho").ComprobacionCapacidad;
  paradas: ParadaDespacho[];
  cargas: CargaPreparada[];
  cajillas: CajillaCarga[];
  historial: {
    accion: string;
    responsable_nombre: string;
    creado_en: string;
  }[];
}
export function claseEstadoDespacho(estado: string) {
  return `inline-flex rounded-full px-3 py-1 text-theme-xs font-medium ${estado === "en_ruta" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : estado === "finalizado" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`;
}
