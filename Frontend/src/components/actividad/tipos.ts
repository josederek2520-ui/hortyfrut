export interface RegistroActividad {
  id: number;
  fecha: string;
  actor: number | null;
  responsable: string;
  modulo: string;
  accion: string;
  descripcion: string;
  objeto_tipo: string;
  objeto_id: string;
  objeto_nombre: string;
  resultado: "exito" | "rechazado" | "error";
  origen: string;
}
export interface DetalleActividad extends RegistroActividad {
  cambios: Record<string, unknown>;
  solicitud_id: string;
  metodo: string;
  ruta: string;
  codigo_http: number | null;
}
export interface PaginaActividad {
  corte: number;
  resumen: ResumenActividad;
  count: number;
  results: RegistroActividad[];
}
export interface ResumenActividad {
  total: number;
  exitosos: number;
  rechazados: number;
  errores: number;
}
export interface OpcionesActividad {
  modulos: string[];
  acciones: string[];
}
export interface FiltrosActividad {
  modulo: string;
  accion: string;
  responsable: string;
  desde: string;
  hasta: string;
}
export const FILTROS_VACIOS: FiltrosActividad = {
  modulo: "",
  accion: "",
  responsable: "",
  desde: "",
  hasta: "",
};
