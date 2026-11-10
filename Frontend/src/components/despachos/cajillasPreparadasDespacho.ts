import type { CajillaCarga, CargaPreparada, DetalleDespacho } from "./tipos";

const claveCajilla = (fila: CajillaCarga) => `${fila.sucursal}:${fila.cajilla}`;

export function preverCajillasCarga(cargas: CargaPreparada[]): CajillaCarga[] {
  const previstas = new Map<
    string,
    NonNullable<CargaPreparada["cajillas_previstas"]>[number]
  >();
  for (const carga of cargas) {
    for (const fila of carga.cajillas_previstas ?? []) {
      if (
        fila.preparacion_id !== carga.preparacion ||
        fila.sucursal_id !== carga.sucursal ||
        (fila.producto_id != null && fila.producto_id !== carga.producto)
      )
        continue;
      previstas.set(
        `${fila.preparacion_id}:${fila.sucursal_id}:${fila.producto_id ?? 0}:${fila.cajilla_id}`,
        fila,
      );
    }
  }
  const cantidades = new Map<string, CajillaCarga>();
  for (const fila of previstas.values()) {
    const clave = `${fila.sucursal_id}:${fila.cajilla_id}`;
    cantidades.set(clave, {
      sucursal: fila.sucursal_id,
      cajilla: fila.cajilla_id,
      color: fila.color,
      cantidad: (cantidades.get(clave)?.cantidad ?? 0) + fila.cantidad,
    });
  }
  return [...cantidades.values()].sort(
    (a, b) => a.sucursal - b.sucursal || a.cajilla - b.cajilla,
  );
}

export function usaCajillasAutomaticas(despacho?: DetalleDespacho): boolean {
  if (!despacho) return true;
  if (despacho.enviado_en || despacho.estado !== "borrador") return false;
  return despacho.cajillas_automaticas ?? despacho.cajillas.length === 0;
}

export function cajillasEfectivasDespacho(
  despacho: DetalleDespacho,
): CajillaCarga[] {
  return usaCajillasAutomaticas(despacho)
    ? (despacho.cajillas_sugeridas ?? preverCajillasCarga(despacho.cargas))
    : despacho.cajillas;
}

export function conservarCajillasManuales(
  anteriores: CargaPreparada[],
  siguientes: CargaPreparada[],
  actuales: CajillaCarga[],
): CajillaCarga[] {
  const destinos = new Set(siguientes.map((fila) => fila.sucursal));
  const anterioresPrevistas = new Set(
    preverCajillasCarga(anteriores).map(claveCajilla),
  );
  const resultado = actuales.filter((fila) => destinos.has(fila.sucursal));
  const presentes = new Set(resultado.map(claveCajilla));
  for (const fila of preverCajillasCarga(siguientes)) {
    const clave = claveCajilla(fila);
    // Conserva ajustes y retiradas explícitas; incorpora los grupos nuevos de carga.
    if (!presentes.has(clave) && !anterioresPrevistas.has(clave))
      resultado.push(fila);
  }
  return resultado;
}
