import type { ProductoPreparacion } from "./tipos";

export type DireccionProductoPreparacion = -1 | 1;
export type PasoProductoPreparacion =
  { producto: ProductoPreparacion } | { pagina: number };

export function pasoProductoPreparacion(
  productos: ProductoPreparacion[],
  seleccionado: number | undefined,
  pagina: number,
  total: number,
  direccion: DireccionProductoPreparacion,
): PasoProductoPreparacion | null {
  const indice = productos.findIndex(
    (producto) => producto.id === seleccionado,
  );
  if (indice < 0) return null;
  const siguiente = productos[indice + direccion];
  if (siguiente) return { producto: siguiente };
  const destino = pagina + direccion;
  return destino >= 1 && destino <= Math.ceil(total / 10)
    ? { pagina: destino }
    : null;
}
