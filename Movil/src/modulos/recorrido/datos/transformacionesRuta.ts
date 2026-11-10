import { ErrorAplicacion } from "@/compartido/dominio/Errores";
import type {
  PlanRuta,
  PosicionRuta,
  PuntoRuta,
  RutaViaje,
} from "../dominio/Ruta";

function registro(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    throw new ErrorAplicacion("datos", 502);
  return valor as Record<string, unknown>;
}
function texto(valor: unknown): string {
  if (typeof valor !== "string") throw new ErrorAplicacion("datos", 502);
  return valor;
}
function numero(valor: unknown, entero = false): number {
  if ((typeof valor !== "number" && typeof valor !== "string") || valor === "")
    throw new ErrorAplicacion("datos", 502);
  const convertido = Number(valor);
  if (
    !Number.isFinite(convertido) ||
    convertido < 0 ||
    (entero && !Number.isSafeInteger(convertido))
  )
    throw new ErrorAplicacion("datos", 502);
  return convertido;
}
function lista(valor: unknown): unknown[] {
  if (!Array.isArray(valor)) throw new ErrorAplicacion("datos", 502);
  return valor;
}
function posicion(longitud: unknown, latitud: unknown): PosicionRuta {
  if (
    (typeof longitud !== "number" && typeof longitud !== "string") ||
    (typeof latitud !== "number" && typeof latitud !== "string") ||
    longitud === "" ||
    latitud === ""
  )
    throw new ErrorAplicacion("datos", 502);
  const lon = Number(longitud),
    lat = Number(latitud);
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    Math.abs(lon) > 180 ||
    Math.abs(lat) > 90
  )
    throw new ErrorAplicacion("datos", 502);
  return [lon, lat];
}
function leerPunto(valor: unknown): PuntoRuta {
  const punto = registro(valor),
    tipo = texto(punto.tipo);
  if (
    !["almacen", "sucursal", "retorno"].includes(tipo) ||
    (punto.latitud == null) !== (punto.longitud == null)
  )
    throw new ErrorAplicacion("datos", 502);
  return {
    tipo: tipo as PuntoRuta["tipo"],
    parada: punto.parada == null ? null : numero(punto.parada, true),
    sucursal: punto.sucursal == null ? null : numero(punto.sucursal, true),
    orden: numero(punto.orden, true),
    nombre: texto(punto.nombre),
    cliente: texto(punto.cliente),
    posicion:
      punto.latitud == null ? null : posicion(punto.longitud, punto.latitud),
    color: leerColor(punto.color),
  };
}

function leerColor(valor: unknown): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string" || !/^#[0-9a-f]{6}$/i.test(valor))
    throw new ErrorAplicacion("datos", 502);
  return valor;
}
function leerPlan(valor: unknown): PlanRuta {
  const plan = registro(valor),
    geometria = registro(plan.geometria);
  if (plan.trafico_en_vivo !== false || geometria.type !== "LineString")
    throw new ErrorAplicacion("datos", 502);
  const puntos = lista(plan.puntos).map(leerPunto);
  const coordenadas = lista(geometria.coordinates).map((valor) => {
    const par = lista(valor);
    if (par.length !== 2) throw new ErrorAplicacion("datos", 502);
    return posicion(par[0], par[1]);
  });
  if (
    coordenadas.length < 2 ||
    puntos.length < 3 ||
    puntos.some((punto) => !punto.posicion)
  )
    throw new ErrorAplicacion("datos", 502);
  const origen = puntos[0]!,
    retorno = puntos[puntos.length - 1]!;
  const tramos = lista(plan.tramos).map((valor) => {
    const tramo = registro(valor);
    return {
      orden: numero(tramo.orden, true),
      distanciaM: numero(tramo.distancia_m),
      duracionS: numero(tramo.duracion_s),
      color: leerColor(tramo.color),
      ...(tramo.geometria === undefined
        ? {}
        : { geometria: leerGeometria(tramo.geometria) }),
    };
  });
  if (
    origen.tipo !== "almacen" ||
    retorno.tipo !== "retorno" ||
    origen.posicion![0] !== retorno.posicion![0] ||
    origen.posicion![1] !== retorno.posicion![1] ||
    tramos.length !== puntos.length - 1 ||
    tramos.some((tramo, indice) => tramo.orden !== indice + 1)
  )
    throw new ErrorAplicacion("datos", 502);
  return {
    id: numero(plan.id, true),
    numero: numero(plan.numero, true),
    puntos,
    geometria: { type: "LineString", coordinates: coordenadas },
    distanciaM: numero(plan.distancia_m),
    duracionS: numero(plan.duracion_s),
    aprobadaEn: plan.aprobada_en == null ? null : texto(plan.aprobada_en),
    fijadaEn: plan.fijada_en == null ? null : texto(plan.fijada_en),
    tramos,
    ...(plan.optimizacion == null
      ? {}
      : { optimizacion: leerResumenOptimizacion(plan.optimizacion) }),
  };
}

function leerResumenOptimizacion(valor: unknown) {
  const datos = registro(valor);
  return {
    mejoraS: numero(datos.mejora_s),
    mejoraPorcentaje: numero(datos.mejora_porcentaje),
    duracionInicialS: numero(datos.duracion_inicial_s),
  };
}

function leerGeometria(valor: unknown): {
  type: "LineString";
  coordinates: PosicionRuta[];
} {
  const datos = registro(valor);
  if (datos.type !== "LineString") throw new ErrorAplicacion("datos", 502);
  const coordenadas = lista(datos.coordinates).map((valor) => {
    const par = lista(valor);
    if (par.length !== 2) throw new ErrorAplicacion("datos", 502);
    return posicion(par[0], par[1]);
  });
  if (coordenadas.length < 2 || coordenadas.length > 100000)
    throw new ErrorAplicacion("datos", 502);
  return { type: "LineString", coordinates: coordenadas };
}
export function leerRutaViaje(valor: unknown): RutaViaje {
  const datos = registro(valor),
    estado = texto(datos.estado);
  if (
    ![
      "sin_calcular",
      "faltan_ubicaciones",
      "pendiente_aprobacion",
      "lista",
      "obsoleta",
    ].includes(estado) ||
    datos.trafico_en_vivo !== false
  )
    throw new ErrorAplicacion("datos", 502);
  const plan = datos.plan == null ? null : leerPlan(datos.plan);
  const indicador = (valor: unknown) => {
    if (valor === undefined) return false;
    if (typeof valor !== "boolean") throw new ErrorAplicacion("datos", 502);
    return valor;
  };
  const preparando = indicador(datos.preparando);
  const versionDespacho = texto(datos.version_despacho);
  if (!/^[0-9a-f]{64}$/.test(versionDespacho))
    throw new ErrorAplicacion("datos", 502);
  if (
    estado === "lista" &&
    (!plan?.aprobadaEn || (!preparando && !plan.fijadaEn))
  )
    throw new ErrorAplicacion("datos", 502);
  return {
    despacho: numero(datos.despacho, true),
    versionDespacho,
    preparando,
    puedeOrdenar: indicador(datos.puede_ordenar),
    puedeCalcular: indicador(datos.puede_calcular),
    puedeAprobar: indicador(datos.puede_aprobar),
    puedeOptimizar: indicador(datos.puede_optimizar),
    optimizacion:
      datos.optimizacion == null ? null : leerCalculo(datos.optimizacion),
    estado: estado as RutaViaje["estado"],
    plan,
    puntos: lista(datos.puntos).map(leerPunto),
    faltantes: lista(datos.faltantes).map(texto),
  };
}

function leerCalculo(valor: unknown): NonNullable<RutaViaje["optimizacion"]> {
  const datos = registro(valor),
    estado = texto(datos.estado);
  if (
    ![
      "pendiente",
      "calculando",
      "lista",
      "error",
      "obsoleta",
      "cancelada",
    ].includes(estado)
  )
    throw new ErrorAplicacion("datos", 502);
  return {
    id: numero(datos.id, true),
    estado: estado as NonNullable<RutaViaje["optimizacion"]>["estado"],
    error: texto(datos.error),
  };
}
