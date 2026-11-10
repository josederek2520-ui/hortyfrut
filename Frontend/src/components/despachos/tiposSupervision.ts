export interface PosicionSupervision {
  id: string;
  latitud: number;
  longitud: number;
  precisionM: number;
  capturadaEn: string;
  recibidaEn: string;
}
export interface DatosSupervision {
  despacho: number;
  version: string;
  estado: string;
  consultadoEn: string;
  seguimiento: null | {
    id: string;
    activa: boolean;
    iniciadaEn: string;
    cerradaEn: string | null;
    posicion: PosicionSupervision | null;
  };
  progreso: {
    total: number;
    completadas: number;
    siguiente: null | {
      id: number;
      cliente: string;
      sucursal: string;
      llegadaEn: string | null;
    };
  };
}
export type FaseSupervision =
  | "inactivo"
  | "conectando"
  | "en_vivo"
  | "reconectando"
  | "sin_conexion"
  | "sin_permiso";
export interface EstadoSupervision {
  fase: FaseSupervision;
  datos: DatosSupervision | null;
  desfaseReloj?: number;
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    throw new Error("Respuesta no válida");
  return valor as Record<string, unknown>;
}
function texto(valor: unknown) {
  if (typeof valor !== "string") throw new Error("Texto no válido");
  return valor;
}
function entero(valor: unknown) {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 0)
    throw new Error("Número no válido");
  return valor;
}
function fecha(valor: unknown) {
  const cadena = texto(valor);
  if (!Number.isFinite(Date.parse(cadena))) throw new Error("Fecha no válida");
  return cadena;
}
export function leerSupervision(
  valor: unknown,
  despacho: number,
): DatosSupervision {
  const datos = objeto(valor),
    progreso = objeto(datos.progreso);
  if (
    datos.despacho !== despacho ||
    !/^[a-f0-9]{64}$/.test(texto(datos.version_despacho))
  )
    throw new Error("Viaje no válido");
  const sesion = datos.seguimiento == null ? null : objeto(datos.seguimiento);
  const punto =
    sesion?.ultima_posicion == null ? null : objeto(sesion.ultima_posicion);
  let posicion: PosicionSupervision | null = null;
  if (punto) {
    const latitud = Number(punto.latitud),
      longitud = Number(punto.longitud),
      precisionM = Number(punto.precision_m);
    if (
      [punto.latitud, punto.longitud, punto.precision_m].some(
        (valor) => valor == null || valor === "",
      ) ||
      ![latitud, longitud, precisionM].every(Number.isFinite) ||
      Math.abs(latitud) > 90 ||
      Math.abs(longitud) > 180 ||
      precisionM < 0 ||
      precisionM > 100
    )
      throw new Error("Posición no válida");
    posicion = {
      id: texto(punto.id),
      latitud,
      longitud,
      precisionM,
      capturadaEn: fecha(punto.capturada_en),
      recibidaEn: fecha(punto.recibida_en),
    };
  }
  if (sesion && typeof sesion.activa !== "boolean")
    throw new Error("Estado no válido");
  const siguiente =
    progreso.siguiente == null ? null : objeto(progreso.siguiente);
  const total = entero(progreso.total),
    completadas = entero(progreso.completadas);
  if (completadas > total) throw new Error("Avance no válido");
  return {
    despacho,
    version: texto(datos.version_despacho),
    estado: texto(datos.estado),
    consultadoEn: fecha(datos.consultado_en),
    seguimiento: sesion
      ? {
          id: texto(sesion.id),
          activa: sesion.activa === true,
          iniciadaEn: fecha(sesion.iniciada_en),
          cerradaEn:
            sesion.cerrada_en == null ? null : fecha(sesion.cerrada_en),
          posicion,
        }
      : null,
    progreso: {
      total,
      completadas,
      siguiente: siguiente
        ? {
            id: entero(siguiente.id),
            cliente: texto(siguiente.cliente_nombre),
            sucursal: texto(siguiente.sucursal_nombre),
            llegadaEn:
              siguiente.llegada_en == null ? null : fecha(siguiente.llegada_en),
          }
        : null,
    },
  };
}

export function estadoUbicacion(datos: DatosSupervision | null, ahora: number) {
  if (!datos?.seguimiento) return "sin_compartir";
  if (!datos.seguimiento.activa) return "detenido";
  const posicion = datos.seguimiento.posicion;
  if (
    !posicion ||
    Date.parse(posicion.capturadaEn) <
      Date.parse(datos.seguimiento.iniciadaEn) - 30000
  )
    return "buscando";
  return ahora -
    Math.min(
      Date.parse(posicion.capturadaEn),
      Date.parse(posicion.recibidaEn),
    ) >
    15000
    ? "desactualizada"
    : "compartiendo";
}
