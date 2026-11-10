import type { PosicionChofer } from "../dominio/Seguimiento";

export function areaPrecision(posicion: PosicionChofer) {
  const radioTierra = 6371008.8,
    latitud = (posicion.latitud * Math.PI) / 180,
    longitud = (posicion.longitud * Math.PI) / 180,
    radio = posicion.precisionM / radioTierra;
  const anillo = Array.from({ length: 49 }, (_, indice) => {
    const rumbo = (indice * 2 * Math.PI) / 48;
    const latitudDestino = Math.asin(
      Math.sin(latitud) * Math.cos(radio) +
        Math.cos(latitud) * Math.sin(radio) * Math.cos(rumbo),
    );
    const longitudDestino =
      longitud +
      Math.atan2(
        Math.sin(rumbo) * Math.sin(radio) * Math.cos(latitud),
        Math.cos(radio) - Math.sin(latitud) * Math.sin(latitudDestino),
      );
    return [
      (((longitudDestino * 180) / Math.PI + 540) % 360) - 180,
      (latitudDestino * 180) / Math.PI,
    ];
  });
  // GeoJSON exige cerrar el anillo con coordenadas exactamente iguales.
  anillo[48] = anillo[0]!;
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [anillo] },
  };
}
