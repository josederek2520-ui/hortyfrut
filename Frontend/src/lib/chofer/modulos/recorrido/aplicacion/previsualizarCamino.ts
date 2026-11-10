import type { RutaViaje, VistaPreviaCamino } from "../dominio/Ruta";

export function previsualizarCamino(
  ruta: RutaViaje,
  vista: VistaPreviaCamino | null,
): RutaViaje {
  if (
    !vista ||
    !ruta.plan ||
    vista.comparacion.plan !== ruta.plan.id ||
    vista.comparacion.versionDespacho !== ruta.versionDespacho
  )
    return ruta;
  const opcion = vista.comparacion.opciones[vista.opcion],
    tramo = vista.comparacion.tramo;
  if (!opcion || tramo < 1 || tramo >= ruta.plan.puntos.length) return ruta;
  const puntos = ruta.plan.puntos
    .slice(tramo - 1, tramo + 1)
    .map((punto) =>
      punto.tipo === "retorno" ? { ...punto, tipo: "almacen" as const } : punto,
    );
  const color = ruta.plan.tramos[tramo - 1].color;
  return {
    ...ruta,
    estado: "pendiente_aprobacion",
    puntos,
    plan: {
      ...ruta.plan,
      puntos,
      geometria: opcion.geometria,
      distanciaM: opcion.distanciaM,
      duracionS: opcion.duracionS,
      tramos: [
        {
          orden: tramo,
          color,
          geometria: opcion.geometria,
          distanciaM: opcion.distanciaM,
          duracionS: opcion.duracionS,
        },
      ],
    },
  };
}
