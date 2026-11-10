import type { RutaViaje } from "../dominio/Ruta";
import type { EstadoViaje, Parada } from "../../despachos/dominio/Viaje";

/** Proyeccion visual; nunca modifica el plan confirmado ni su geometria. */
export function vistaRecorrido(
  ruta: RutaViaje,
  paradas: Parada[] = [],
  estado?: EstadoViaje,
  mostrarCompleto = false,
) {
  const plan = ruta.estado !== "obsoleta" ? ruta.plan : null;
  const originales = plan?.puntos ?? ruta.puntos;
  const completadas = new Set(
    paradas.filter((parada) => parada.descargadaEn).map((parada) => parada.id),
  );
  const ocultarCompletadas = estado === "en_ruta" && !mostrarCompleto;
  const puntos = originales;
  const tramos =
    plan?.tramos.length && plan.tramos.every((tramo) => tramo.geometria)
      ? plan.tramos.filter((tramo) => {
          const destino = originales.find(
            (punto) => punto.orden === tramo.orden,
          );
          return (
            !ocultarCompletadas ||
            destino?.tipo !== "sucursal" ||
            !completadas.has(destino.parada!)
          );
        })
      : null;
  // Los planes antiguos sin desglose conservan su linea: no inventar atajos.
  const lineaGlobal = tramos === null ? (plan?.geometria ?? null) : null;
  const geometriaVisible =
    tramos?.flatMap((tramo) => tramo.geometria!.coordinates) ??
    lineaGlobal?.coordinates ??
    [];
  // El encuadre conserva las sucursales como referencia aun sin su tramo.
  const coordenadas = [
    ...geometriaVisible,
    ...puntos.flatMap((punto) => (punto.posicion ? [punto.posicion] : [])),
  ];
  const clave = `${plan?.id ?? "sin-plan"}:${puntos.map((punto) => `${punto.tipo}:${punto.parada}`).join(",")}:${tramos?.map((tramo) => tramo.orden).join(",") ?? "global"}`;
  return { puntos, tramos, lineaGlobal, coordenadas, clave, completadas };
}
