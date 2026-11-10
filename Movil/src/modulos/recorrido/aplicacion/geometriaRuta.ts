import type { PosicionRuta, PuntoRuta } from "../dominio/Ruta";

export function limitesRuta(
  posiciones: PosicionRuta[],
): [number, number, number, number] | null {
  if (!posiciones.length) return null;
  let oeste = 180,
    sur = 90,
    este = -180,
    norte = -90;
  for (const [longitud, latitud] of posiciones) {
    if (
      !Number.isFinite(longitud) ||
      !Number.isFinite(latitud) ||
      Math.abs(longitud) > 180 ||
      Math.abs(latitud) > 90
    )
      return null;
    oeste = Math.min(oeste, longitud);
    sur = Math.min(sur, latitud);
    este = Math.max(este, longitud);
    norte = Math.max(norte, latitud);
  }
  // Un único punto también necesita un área visible, sin inventar un recorrido.
  const margen = 0.001;
  return [
    oeste === este ? Math.max(-180, oeste - margen) : oeste,
    sur === norte ? Math.max(-90, sur - margen) : sur,
    oeste === este ? Math.min(180, este + margen) : este,
    sur === norte ? Math.min(90, norte + margen) : norte,
  ];
}
export function enlaceNavegacion(punto: PuntoRuta): string | null {
  if (!punto.posicion) return null;
  const [longitud, latitud] = punto.posicion;
  if (
    !Number.isFinite(longitud) ||
    !Number.isFinite(latitud) ||
    Math.abs(longitud) > 180 ||
    Math.abs(latitud) > 90
  )
    return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitud},${longitud}`)}&travelmode=driving`;
}
