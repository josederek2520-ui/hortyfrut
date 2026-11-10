import type {
  CajillaEditable,
  DocumentoEditable,
  OpcionPreparacion,
} from "./tipos";

export function cajillasDelProducto(
  documento: DocumentoEditable,
  producto: number,
  sucursal: number,
) {
  return documento.cajillas.filter(
    (fila) => fila.producto?.id === producto && fila.sucursal.id === sucursal,
  );
}

export function anotarCajillasProducto(
  documento: DocumentoEditable,
  producto: OpcionPreparacion,
  sucursal: OpcionPreparacion,
  color: OpcionPreparacion,
  cantidad: string,
  clave: string,
): DocumentoEditable | null {
  if (
    !/^\d{1,10}$/.test(cantidad) ||
    Number(cantidad) < 1 ||
    Number(cantidad) > 2147483647
  )
    return null;
  const existente = cajillasDelProducto(
    documento,
    producto.id,
    sucursal.id,
  ).find((fila) => fila.color.id === color.id);
  if (existente && !/^\d{1,10}$/.test(existente.cantidad)) return null;
  const total = Number(existente?.cantidad || 0) + Number(cantidad);
  if (total > 2147483647 || (!existente && documento.cajillas.length >= 500))
    return null;
  return {
    ...documento,
    cajillas: existente
      ? documento.cajillas.map((fila) =>
          fila === existente ? { ...fila, cantidad: String(total) } : fila,
        )
      : [...documento.cajillas, { clave, producto, sucursal, color, cantidad }],
  };
}

export function resumirCajillasPreparacion(cajillas: CajillaEditable[]) {
  const resumen = new Map<
    string,
    { sucursal: OpcionPreparacion; color: OpcionPreparacion; cantidad: number }
  >();
  cajillas.forEach((fila) => {
    const clave = `${fila.sucursal.id}:${fila.color.id}`;
    const anterior = resumen.get(clave);
    resumen.set(clave, {
      sucursal: fila.sucursal,
      color: fila.color,
      cantidad: (anterior?.cantidad || 0) + (Number(fila.cantidad) || 0),
    });
  });
  return [...resumen.values()];
}

export function sugerenciaCajillasProducto(
  documento: DocumentoEditable,
  producto: number,
  sucursal: number,
): number {
  const cajas = Object.values(documento.asignaciones)
    .filter(
      (fila) =>
        fila.producto === producto &&
        fila.sucursal === sucursal &&
        fila.columna === "cajas" &&
        /^\d+$/.test(fila.cantidad),
    )
    .reduce((total, fila) => total + Number(fila.cantidad), 0);
  const anotadas = cajillasDelProducto(documento, producto, sucursal).reduce(
    (total, fila) => total + (Number(fila.cantidad) || 0),
    0,
  );
  return Math.max(0, cajas - anotadas);
}

export function saldoPrevistoColor(
  documento: DocumentoEditable,
  color: OpcionPreparacion,
): number | undefined {
  if (color.saldo === undefined) return undefined;
  return (
    color.saldo -
    documento.cajillas
      .filter((fila) => fila.color.id === color.id)
      .reduce((total, fila) => total + (Number(fila.cantidad) || 0), 0)
  );
}
