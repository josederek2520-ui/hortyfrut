import type { PosicionRuta, RutaViaje } from "../dominio/Ruta";
import type { ObjetivoGuia, LineaGuia } from "../dominio/GuiaChofer";
import type { Parada } from "../../despachos/dominio/Viaje";
import type { PosicionChofer } from "../../seguimiento/dominio/Seguimiento";

const radioTierra = 6371000,
  radianes = Math.PI / 180;
export function distanciaGuia(a: PosicionRuta, b: PosicionRuta) {
  const valor =
    Math.sin(((b[1] - a[1]) * radianes) / 2) ** 2 +
    Math.cos(a[1] * radianes) *
      Math.cos(b[1] * radianes) *
      Math.sin(((b[0] - a[0]) * radianes) / 2) ** 2;
  return (
    radioTierra * 2 * Math.asin(Math.min(1, Math.sqrt(Math.max(0, valor))))
  );
}
export function posicionValidaGuia(
  posicion: PosicionChofer | null,
  ahora: number,
): posicion is PosicionChofer {
  return (
    !!posicion &&
    [
      posicion.latitud,
      posicion.longitud,
      posicion.precisionM,
      Date.parse(posicion.capturadaEn),
    ].every(Number.isFinite) &&
    Math.abs(posicion.latitud) <= 90 &&
    Math.abs(posicion.longitud) <= 180 &&
    posicion.precisionM >= 0 &&
    posicion.precisionM <= 100 &&
    Math.abs(ahora - Date.parse(posicion.capturadaEn)) <= 30000
  );
}
export function objetivoGuia(
  ruta: RutaViaje | null,
  paradas: Parada[],
): ObjetivoGuia | null {
  const plan = ruta?.plan;
  if (!plan?.fijadaEn) return null;
  const pendientes = new Set(
    paradas.filter((p) => !p.descargadaEn).map((p) => p.id),
  );
  const destino =
    plan.puntos.find(
      (p) => p.tipo === "sucursal" && pendientes.has(p.parada!),
    ) ?? plan.puntos.find((p) => p.tipo === "retorno");
  if (!destino?.posicion) return null;
  return {
    plan: plan.id,
    tramo: destino.orden,
    destino,
    geometria:
      plan.tramos.find((t) => t.orden === destino.orden)?.geometria ?? null,
  };
}

/** Proyecta solo sobre las calles del tramo, nunca cambia la lectura GPS del camión. */
export function recortarGuia(
  linea: LineaGuia,
  posicion: PosicionRuta,
  precision: number,
  avanceAnterior?: number,
) {
  const puntos = linea.coordinates;
  if (puntos.length < 2) return null;
  const escalaX =
      radioTierra *
      radianes *
      Math.max(0.00001, Math.cos(posicion[1] * radianes)),
    escalaY = radioTierra * radianes;
  const candidatos: {
    indice: number;
    punto: PosicionRuta;
    desvio: number;
    avance: number;
  }[] = [];
  let acumulado = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[i],
      b = puntos[i + 1];
    const ax = (a[0] - posicion[0]) * escalaX,
      ay = (a[1] - posicion[1]) * escalaY;
    const dx = (b[0] - a[0]) * escalaX,
      dy = (b[1] - a[1]) * escalaY,
      cuadrado = dx * dx + dy * dy;
    const fraccion = cuadrado
      ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / cuadrado))
      : 0;
    const punto: PosicionRuta = [
      a[0] + (b[0] - a[0]) * fraccion,
      a[1] + (b[1] - a[1]) * fraccion,
    ];
    const longitud = distanciaGuia(a, b);
    candidatos.push({
      indice: i,
      punto,
      desvio: Math.hypot(ax + fraccion * dx, ay + fraccion * dy),
      avance: acumulado + longitud * fraccion,
    });
    acumulado += longitud;
  }
  const minimo = candidatos.reduce((m, c) => Math.min(m, c.desvio), Infinity);
  // En cruces o calles paralelas próximas se prefiere continuidad del tramo,
  // en lugar de saltar a una vuelta lejana por unos metros de error del GPS.
  const cercanos = candidatos.filter(
    (c) => c.desvio <= minimo + Math.max(5, Math.min(precision, 15)),
  );
  cercanos.sort((a, b) =>
    avanceAnterior === undefined
      ? a.desvio - b.desvio || a.avance - b.avance
      : Math.abs(a.avance - avanceAnterior) -
        Math.abs(b.avance - avanceAnterior),
  );
  const mejor = cercanos[0],
    umbral = Math.max(40, precision + 20);
  if (
    !mejor ||
    mejor.desvio > umbral ||
    (avanceAnterior !== undefined &&
      mejor.avance < avanceAnterior - Math.max(40, precision))
  )
    return null;
  const coordenadas: PosicionRuta[] = [
    mejor.punto,
    ...puntos.slice(mejor.indice + 1),
  ];
  if (coordenadas.length < 2) coordenadas.push([...mejor.punto]);
  return {
    geometria: { type: "LineString" as const, coordinates: coordenadas },
    avance: mejor.avance,
    distanciaM: Math.max(0, acumulado - mejor.avance),
  };
}
