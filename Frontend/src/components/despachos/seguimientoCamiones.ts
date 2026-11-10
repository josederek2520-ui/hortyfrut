import type { Despacho } from "./tipos";

export interface FiltrosSeguimientoCamiones {
  buscar: string;
  estado: "" | "en_ruta" | "borrador";
  pagina: number;
}

export function consultaSeguimientoCamiones(
  filtros: FiltrosSeguimientoCamiones,
) {
  const parametros = new URLSearchParams({ pagina: String(filtros.pagina) });
  if (filtros.buscar.trim()) parametros.set("buscar", filtros.buscar.trim());
  if (filtros.estado) parametros.set("estado", filtros.estado);
  return `despachos/viajes-actuales/?${parametros}`;
}

export function esViajeActual(viaje: Pick<Despacho, "estado" | "enviado_en">) {
  return (
    viaje.estado === "en_ruta" ||
    (viaje.estado === "borrador" && !!viaje.enviado_en)
  );
}

export function elegirViajeSupervision(
  viajes: Despacho[],
  seleccion: { ruta: string; id: number } | null,
  ruta: string,
) {
  return seleccion?.ruta === ruta ? seleccion.id : (viajes[0]?.id ?? null);
}
