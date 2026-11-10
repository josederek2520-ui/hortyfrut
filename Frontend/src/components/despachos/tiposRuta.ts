export interface PuntoRuta {
  tipo: "almacen" | "sucursal" | "retorno";
  parada: number | null;
  sucursal: number | null;
  orden: number;
  nombre: string;
  cliente: string;
  latitud: string | null;
  longitud: string | null;
  color?: string;
}
export interface PlanRuta {
  id: number;
  numero: number;
  puntos: PuntoRuta[];
  geometria: { type: "LineString"; coordinates: [number, number][] };
  distancia_m: string;
  duracion_s: string;
  aprobada_en: string | null;
  aprobada_por_nombre: string;
  fijada_en: string | null;
  trafico_en_vivo: false;
  tramos?: {
    orden: number;
    color: string;
    destino_parada: number | null;
    geometria?: { type: "LineString"; coordinates: [number, number][] };
  }[];
  optimizacion?: {
    mejora_s: string;
    mejora_porcentaje: string;
    duracion_inicial_s: string;
    algoritmo: string;
    metodo_elegido: string;
  } | null;
}
export interface DocumentoRuta {
  despacho: number;
  version_despacho: string;
  estado:
    | "sin_calcular"
    | "faltan_ubicaciones"
    | "pendiente_aprobacion"
    | "lista"
    | "obsoleta";
  optimizacion?: {
    id: number;
    estado:
      "pendiente" | "calculando" | "lista" | "error" | "obsoleta" | "cancelada";
    error: string;
  } | null;
  plan: PlanRuta | null;
  puntos: PuntoRuta[];
  faltantes: string[];
  puede_calcular: boolean;
  puede_aprobar: boolean;
  trafico_en_vivo: false;
}
