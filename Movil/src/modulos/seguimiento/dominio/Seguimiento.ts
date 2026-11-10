export interface PosicionChofer {
  id: string;
  latitud: number;
  longitud: number;
  precisionM: number;
  capturadaEn: string;
  velocidadMS: number | null;
  rumbo: number | null;
}
export interface SesionSeguimiento {
  id: string;
  activa: boolean;
  venceEn: string;
}
export interface InicioSeguimiento {
  clave_operacion: string;
  version: string;
}
export type MotivoCierre =
  | "chofer"
  | "segundo_plano"
  | "permiso"
  | "cuenta"
  | "sin_conexion"
  | "error_gps";
export interface CierreSeguimiento {
  sesion: string;
  motivo: MotivoCierre;
}
export interface LoteUbicaciones {
  sesion: string;
  clave_operacion: string;
  posiciones: {
    id: string;
    latitud: string;
    longitud: string;
    precision_m: string;
    capturada_en: string;
    velocidad_m_s: string | null;
    rumbo: string | null;
  }[];
}
export interface RepositorioSeguimiento {
  iniciar(
    viaje: number,
    documento: InicioSeguimiento,
  ): Promise<SesionSeguimiento>;
  detener(
    viaje: number,
    documento: CierreSeguimiento,
  ): Promise<SesionSeguimiento>;
  enviar(viaje: number, documento: LoteUbicaciones): Promise<SesionSeguimiento>;
}
export interface LecturaUbicacion {
  latitud: number;
  longitud: number;
  precisionM: number | null;
  instante: number;
  velocidadMS: number | null;
  rumbo: number | null;
}
export interface Localizador {
  autorizar(): Promise<void>;
  observar(
    alPosicion: (posicion: LecturaUbicacion) => void,
    alError: () => void,
  ): Promise<{ remove(): void }>;
}
export interface EstadoSeguimiento {
  viaje: number | null;
  fase:
    | "inactivo"
    | "iniciando"
    | "buscando"
    | "compartiendo"
    | "pendiente"
    | "detenido"
    | "error";
  posicion: PosicionChofer | null;
  error: string;
}
