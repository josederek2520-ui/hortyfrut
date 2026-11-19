import { api } from "@/lib/api";
import type { PaginaCobros, SaldoCobro } from "./tipos";

export async function consultarSaldosCobro(
  cliente: number,
  identificadores: number[],
  signal: AbortSignal,
  ruta = "cobros",
) {
  const consultar = (pagina: number) =>
    api<PaginaCobros<SaldoCobro>>(
      ruta +
        "/ventas/?" +
        new URLSearchParams({
          cliente: String(cliente),
          seleccion: identificadores.join(","),
          pagina: String(pagina),
        }),
      { signal },
    );
  const primera = await consultar(1),
    filas = [...primera.results];
  if (primera.count !== identificadores.length || primera.count > 100)
    throw new Error("saldosDistintos");
  for (let pagina = 2; pagina <= Math.ceil(primera.count / 10); pagina++) {
    if (signal.aborted) throw new Error("consultaCancelada");
    const siguiente = await consultar(pagina);
    if (
      siguiente.count !== primera.count ||
      siguiente.version_origen !== primera.version_origen
    )
      throw new Error("saldosDistintos");
    filas.push(...siguiente.results);
  }
  if (
    signal.aborted ||
    filas.length !== identificadores.length ||
    new Set(filas.map((f) => f.id)).size !== identificadores.length ||
    filas.some((fila) => !identificadores.includes(fila.id))
  )
    throw new Error("saldosDistintos");
  return filas;
}
