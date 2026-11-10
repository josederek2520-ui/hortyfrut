import type { FeatureCollection, LineString } from "geojson";
import type { PlanRuta, PuntoRuta } from "../dominio/Ruta";

export function colorPuntoRuta(punto: PuntoRuta): string {
  if (punto.color && /^#[0-9a-f]{6}$/i.test(punto.color)) return punto.color;
  return punto.tipo === "sucursal" ? "#2563eb" : "#16803c";
}

export function lineasColoreadas(
  plan: PlanRuta,
): FeatureCollection<LineString, { color: string; orden: number }> {
  const completas =
    plan.tramos.length > 0 && plan.tramos.every((tramo) => tramo.geometria);
  return {
    type: "FeatureCollection",
    features: completas
      ? plan.tramos.map((tramo, indice) => ({
          type: "Feature",
          geometry: tramo.geometria!,
          properties: {
            color: tramo.color ?? colorPuntoRuta(plan.puntos[indice + 1]!),
            orden: tramo.orden,
          },
        }))
      : [
          {
            type: "Feature",
            geometry: plan.geometria,
            properties: { color: "#16803c", orden: 0 },
          },
        ],
  };
}
