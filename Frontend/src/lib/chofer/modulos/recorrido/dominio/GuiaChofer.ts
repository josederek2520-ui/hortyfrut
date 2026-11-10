import type { PosicionRuta, PlanRuta, PuntoRuta } from "./Ruta";
import type { PosicionChofer } from "../../seguimiento/dominio/Seguimiento";

export type LineaGuia = { type: "LineString"; coordinates: PosicionRuta[] };
export interface ObjetivoGuia {
  plan: number;
  tramo: number;
  destino: PuntoRuta;
  geometria: LineaGuia | null;
}
export interface ContextoGuia {
  clave: string;
  viaje: number;
  version: string;
  sesion: string;
  objetivo: ObjetivoGuia;
  posicion: PosicionChofer;
}
export interface DocumentoGuia {
  clave_operacion: string;
  version: string;
  sesion: string;
  plan: number;
  tramo: number;
  posicion: {
    id: string;
    latitud: string;
    longitud: string;
    precision_m: string;
    capturada_en: string;
  };
}
export interface RespuestaGuia {
  consulta: string;
  estado: "pendiente" | "lista" | "error";
  sesion: string;
  plan: number;
  tramo: number;
  version: string;
  venceEn: string;
  geometria: LineaGuia | null;
}
export interface RepositorioGuia {
  consultar(
    viaje: number,
    documento: DocumentoGuia,
    senal: AbortSignal,
  ): Promise<RespuestaGuia>;
}
export interface EstadoGuia {
  esperaS?: number;
  clave: string | null;
  fase: "inactiva" | "recorrido" | "calculando" | "actualizada" | "sin_guia";
  tramo: number | null;
  geometria: LineaGuia | null;
  distanciaM: number | null;
}
export type TramoGuia = PlanRuta["tramos"][number];
