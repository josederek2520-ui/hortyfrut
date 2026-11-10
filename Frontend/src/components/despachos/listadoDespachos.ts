import type { Despacho } from "./tipos";

export type VistaListadoDespachos = "activos" | "historial";
export interface ResumenListadoDespachos {
  total: number;
  borrador: number;
  en_ruta: number;
  finalizado: number;
  cancelado: number;
  hay_carga_disponible?: boolean;
}
export interface FiltrosListadoDespachos {
  vista: VistaListadoDespachos;
  buscar: string;
  estado: string;
  fecha: string;
  pagina: number;
}
export const estadosPorVista: Record<
  VistaListadoDespachos,
  Despacho["estado"][]
> = {
  activos: ["en_ruta", "borrador"],
  historial: ["finalizado", "cancelado"],
};

export function consultasListadoDespachos(filtros: FiltrosListadoDespachos) {
  const comunes = new URLSearchParams();
  if (filtros.buscar.trim()) comunes.set("buscar", filtros.buscar.trim());
  if (filtros.fecha) comunes.set("fecha", filtros.fecha);
  const lista = new URLSearchParams(comunes);
  lista.set("vista", filtros.vista);
  lista.set("pagina", String(filtros.pagina));
  if (
    estadosPorVista[filtros.vista].includes(
      filtros.estado as Despacho["estado"],
    )
  )
    lista.set("estado", filtros.estado);
  return {
    lista: `despachos/?${lista}`,
    resumen: `despachos/resumen/?${comunes}`,
  };
}

export function tipoVacioListadoDespachos(
  vista: VistaListadoDespachos,
  hayFiltros: boolean,
  resumen: ResumenListadoDespachos | null,
) {
  if (hayFiltros) return "filtros";
  if (!resumen) return "vista";
  if (resumen.total === 0)
    return resumen.hay_carga_disponible === false ? "sin_carga" : "primero";
  return vista;
}

export function accionListadoDespacho(
  despacho: Despacho,
  puedeEditar: boolean,
) {
  const ruta = `/despachos/${despacho.id}`;
  if (despacho.estado === "borrador" && !despacho.enviado_en && puedeEditar)
    return {
      ruta: `${ruta}/editar`,
      etiqueta: "continuarListado",
      descripcion: "continuarDespachoListado",
    } as const;
  if (despacho.estado === "en_ruta")
    return {
      ruta,
      etiqueta: "abrirViajeListado",
      descripcion: "abrirDespachoListado",
    } as const;
  return {
    ruta,
    etiqueta: "verResumenListado",
    descripcion: "verDespachoListado",
  } as const;
}
