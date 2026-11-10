export type PosicionRuta = [number, number];
export interface PuntoRuta {
  tipo: "almacen" | "sucursal" | "retorno";
  parada: number | null;
  sucursal: number | null;
  orden: number;
  nombre: string;
  cliente: string;
  posicion: PosicionRuta | null;
  color?: string;
}
export interface PlanRuta {
  id: number;
  numero: number;
  puntos: PuntoRuta[];
  geometria: { type: "LineString"; coordinates: PosicionRuta[] };
  tramos: {
    orden: number;
    distanciaM: number;
    duracionS: number;
    color?: string;
    geometria?: { type: "LineString"; coordinates: PosicionRuta[] };
  }[];
  distanciaM: number;
  duracionS: number;
  aprobadaEn: string | null;
  fijadaEn: string | null;
  optimizacion?: {
    mejoraS: number;
    mejoraPorcentaje: number;
    duracionInicialS: number;
  };
}
export interface CalculoOptimizacion {
  id: number;
  estado:
    "pendiente" | "calculando" | "lista" | "error" | "obsoleta" | "cancelada";
  error: string;
}
export interface RutaViaje {
  despacho: number;
  versionDespacho: string;
  preparando: boolean;
  puedeOrdenar: boolean;
  puedeCalcular: boolean;
  puedeAprobar: boolean;
  puedeOptimizar?: boolean;
  optimizacion?: CalculoOptimizacion | null;
  estado:
    | "sin_calcular"
    | "faltan_ubicaciones"
    | "pendiente_aprobacion"
    | "lista"
    | "obsoleta";
  puntos: PuntoRuta[];
  faltantes: string[];
  plan: PlanRuta | null;
}

export type AccionRuta =
  | "calcular-ruta"
  | "aprobar-ruta"
  | "optimizar-ruta"
  | "cancelar-optimizacion"
  | "elegir-alternativa";
export interface DocumentoRuta {
  version: string;
  clave_operacion: string;
  orden_paradas?: number[];
  plan?: number;
  calculo?: number;
  consulta?: number;
  opcion?: number;
}
export interface OpcionCamino {
  opcion: number;
  actual: boolean;
  distanciaM: number;
  duracionS: number;
  calles: string[];
  geometria: { type: "LineString"; coordinates: PosicionRuta[] };
}
export interface ComparacionCaminos {
  consulta: number;
  plan: number;
  tramo: number;
  versionDespacho: string;
  venceEn: string;
  opciones: OpcionCamino[];
}
export interface DocumentoConsultaCaminos {
  version: string;
  clave_operacion: string;
  plan: number;
  tramo: number;
}
export interface VistaPreviaCamino {
  comparacion: ComparacionCaminos;
  opcion: number;
}
export interface RepositorioRutas {
  consultar(viaje: number, senal?: AbortSignal): Promise<RutaViaje>;
  operar(
    viaje: number,
    accion: AccionRuta,
    documento: DocumentoRuta,
  ): Promise<RutaViaje>;
}
