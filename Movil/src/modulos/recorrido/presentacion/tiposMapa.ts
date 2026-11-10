import type { RutaViaje } from "../dominio/Ruta";
import type { PosicionChofer } from "@/modulos/seguimiento/dominio/Seguimiento";

export interface PropiedadesMapa {
  ruta: RutaViaje;
  siguiente: number | null;
  espacioSuperior: number;
  espacioInferior: number;
  revisionEncuadre: number;
  posicionChofer?: PosicionChofer | null;
  centroUbicacion?: [number, number] | null;
  alIniciarCarga: () => void;
  alError: () => void;
  alCargar: () => void;
}
