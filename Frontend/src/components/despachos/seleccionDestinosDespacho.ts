import type {
  CargaPreparada,
  DestinoCargaDespacho,
  PedidoCargaDespacho,
} from "./tipos";
import type { PaginaLogistica } from "@/components/logistica/tipos";

export function pesoEnMilesDespacho(valor: string): bigint {
  if (!/^\d+(?:\.\d{1,3})?$/.test(valor || "0")) return BigInt(0);
  const [entero, decimal = ""] = (valor || "0").split(".");
  return BigInt(entero) * BigInt(1000) + BigInt(decimal.padEnd(3, "0"));
}

export function pesoCargaDespacho(filas: CargaPreparada[]): string {
  const peso = filas.reduce(
    (suma, fila) => suma + pesoEnMilesDespacho(fila.peso_kg),
    BigInt(0),
  );
  return (
    String(peso / BigInt(1000)) +
    "." +
    String(peso % BigInt(1000)).padStart(3, "0")
  );
}

export function agruparCargaDestinos(
  filas: CargaPreparada[],
): DestinoCargaDespacho[] {
  const grupos = new Map<number, CargaPreparada[]>();
  filas.forEach((fila) =>
    grupos.set(fila.sucursal, [...(grupos.get(fila.sucursal) || []), fila]),
  );
  return [...grupos.values()]
    .map((grupo) => ({
      sucursal: grupo[0].sucursal,
      sucursal_nombre: grupo[0].sucursal_nombre,
      cliente_nombre: grupo[0].cliente_nombre,
      direccion: grupo[0].direccion,
      pedidos: new Set(grupo.map((fila) => fila.pedido)).size,
      asignaciones: grupo.length,
      productos: new Set(grupo.map((fila) => fila.producto)).size,
      cajas: grupo
        .filter((fila) => fila.columna === "cajas")
        .reduce((suma, fila) => suma + fila.cantidad, 0),
      unidades: grupo
        .filter((fila) => fila.columna === "unidades")
        .reduce((suma, fila) => suma + fila.cantidad, 0),
      peso_kg: pesoCargaDespacho(grupo),
    }))
    .sort(
      (a, b) =>
        a.cliente_nombre.localeCompare(b.cliente_nombre) ||
        a.sucursal_nombre.localeCompare(b.sucursal_nombre) ||
        a.sucursal - b.sucursal,
    );
}

export function agruparCargaPedidos(
  filas: CargaPreparada[],
): PedidoCargaDespacho[] {
  const grupos = new Map<number, CargaPreparada[]>();
  filas.forEach((fila) =>
    grupos.set(fila.pedido, [...(grupos.get(fila.pedido) || []), fila]),
  );
  return [...grupos.values()]
    .map((grupo) => ({
      pedido: grupo[0].pedido,
      codigo_pedido: grupo[0].codigo_pedido,
      fecha_requerida: grupo[0].fecha_requerida,
      asignaciones: grupo.length,
      productos: new Set(grupo.map((fila) => fila.producto)).size,
      cajas: grupo
        .filter((fila) => fila.columna === "cajas")
        .reduce((suma, fila) => suma + fila.cantidad, 0),
      unidades: grupo
        .filter((fila) => fila.columna === "unidades")
        .reduce((suma, fila) => suma + fila.cantidad, 0),
      peso_kg: pesoCargaDespacho(grupo),
    }))
    .sort(
      (a, b) =>
        a.fecha_requerida.localeCompare(b.fecha_requerida) ||
        a.pedido - b.pedido,
    );
}

export function cargaDelDestino(
  filas: CargaPreparada[],
  sucursal: number,
  fecha = "",
  pedido?: number,
) {
  return filas.filter(
    (fila) =>
      fila.sucursal === sucursal &&
      (!fecha || fila.fecha_requerida === fecha) &&
      (!pedido || fila.pedido === pedido),
  );
}

export class ErrorSeleccionDestino extends Error {
  constructor(public codigo: "limite" | "cambio") {
    super(codigo);
  }
}
export interface PaginaCargaDestino extends PaginaLogistica<CargaPreparada> {
  version_carga?: string;
}

export async function cargarDestinoCompleto(
  parametros: URLSearchParams,
  consultar: (ruta: string, signal: AbortSignal) => Promise<PaginaCargaDestino>,
  signal: AbortSignal,
): Promise<CargaPreparada[] | null> {
  const recibidas = new Map<number, CargaPreparada>();
  let total: number | undefined;
  let version: string | undefined;
  for (let pagina = 1; ; pagina += 1) {
    if (signal.aborted) return null;
    const consulta = new URLSearchParams(parametros);
    consulta.set("pagina", String(pagina));
    const datos = await consultar(
      "despachos/disponibles/?" + consulta.toString(),
      signal,
    );
    if (signal.aborted) return null;
    if (datos.count > 1000) throw new ErrorSeleccionDestino("limite");
    if (
      !datos.version_carga ||
      (total !== undefined &&
        (total !== datos.count || version !== datos.version_carga))
    )
      throw new ErrorSeleccionDestino("cambio");
    total = datos.count;
    version = datos.version_carga;
    datos.results.forEach((fila) => recibidas.set(fila.id, fila));
    if (pagina * 10 >= total) break;
    if (!datos.results.length) throw new ErrorSeleccionDestino("cambio");
  }
  if (recibidas.size !== total) throw new ErrorSeleccionDestino("cambio");
  return [...recibidas.values()];
}
