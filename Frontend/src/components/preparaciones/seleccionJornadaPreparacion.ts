import type {
  EstadoTrabajoPreparacion,
  HojaConsolidada,
  ProductoPreparacion,
} from "./tipos";

export function primerProductoPendiente(
  hoja: HojaConsolidada,
): ProductoPreparacion | null {
  const producto = hoja.results.find(
    (fila) => fila.pendientes_cajas > 0 || fila.pendientes_unidades > 0,
  );
  return producto
    ? {
        id: producto.id,
        nombre: producto.nombre,
        subtitulo: producto.categoria,
        categoria: producto.categoria_id
          ? { id: producto.categoria_id, nombre: producto.categoria }
          : undefined,
        imagen: producto.imagen,
        cajas: producto.cajas,
        unidades: producto.unidades,
        pendientes_cajas: producto.pendientes_cajas,
        pendientes_unidades: producto.pendientes_unidades,
      }
    : null;
}

export function decisionCambioJornada(
  estado: EstadoTrabajoPreparacion,
  actual: { fecha: string; cliente: number | null },
  nueva: { fecha: string; cliente: number | null },
): "ignorar" | "confirmar" | "aplicar" {
  if (
    estado.guardando ||
    (actual.fecha === nueva.fecha && actual.cliente === nueva.cliente)
  )
    return "ignorar";
  return estado.modificado ? "confirmar" : "aplicar";
}
