import type { ViajeDetalle } from "@/lib/chofer/modulos/despachos/dominio/Viaje";
export function siguienteParada(viaje: ViajeDetalle) {
  return [...viaje.paradas]
    .sort((a, b) => a.orden - b.orden)
    .find((parada) => !parada.descargadaEn);
}
export function siguienteAccion(
  viaje: ViajeDetalle,
  puedeOperar: boolean,
): "iniciar" | "llegar" | "pedidos" | "finalizar" | null {
  if (!puedeOperar) return null;
  if (viaje.estado === "borrador")
    return viaje.enviadoEn && viaje.capacidad === "apta" ? "iniciar" : null;
  if (viaje.estado !== "en_ruta") return null;
  const parada = siguienteParada(viaje);
  return !parada ? "finalizar" : parada.llegadaEn ? "pedidos" : "llegar";
}
