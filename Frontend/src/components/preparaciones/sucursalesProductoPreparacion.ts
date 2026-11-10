import type { DocumentoEditable } from "./tipos";

export interface SucursalProductoPreparacion {
  id: number;
  nombre: string;
  pedidos: number;
  lineas: number;
}

export function sucursalesAnotadasProducto(
  documento: DocumentoEditable,
  producto: number,
) {
  const grupos = new Map<number, SucursalProductoPreparacion>();
  const pedidos = new Map<number, Set<number>>();
  Object.values(documento.asignaciones)
    .filter((fila) => fila.producto === producto)
    .forEach((fila) => {
      const grupo = grupos.get(fila.sucursal) ?? {
        id: fila.sucursal,
        nombre: fila.sucursalNombre,
        pedidos: 0,
        lineas: 0,
      };
      const identificadores = pedidos.get(fila.sucursal) ?? new Set<number>();
      identificadores.add(fila.pedido);
      pedidos.set(fila.sucursal, identificadores);
      grupo.pedidos = identificadores.size;
      ++grupo.lineas;
      grupos.set(fila.sucursal, grupo);
    });
  documento.cajillas
    .filter((fila) => fila.producto?.id === producto)
    .forEach((fila) => {
      if (!grupos.has(fila.sucursal.id))
        grupos.set(fila.sucursal.id, {
          ...fila.sucursal,
          pedidos: 0,
          lineas: 0,
        });
    });
  return [...grupos.values()].sort(
    (primero, segundo) =>
      primero.nombre.localeCompare(segundo.nombre) || primero.id - segundo.id,
  );
}

export function errorSucursalProducto(
  documento: DocumentoEditable,
  producto: number,
  errores: Record<string, string[]>,
) {
  const asignaciones = Object.values(documento.asignaciones);
  for (const [campo, mensajes] of Object.entries(errores)) {
    if (!mensajes?.length) continue;
    const referencia = /^(asignaciones|cajillas)_(\d+)_/.exec(campo);
    if (!referencia) continue;
    const indice = Number(referencia[2]);
    if (referencia[1] === "asignaciones") {
      const fila = asignaciones[indice];
      if (fila?.producto === producto)
        return { sucursal: fila.sucursal, asignacion: fila.clave };
    } else {
      const fila = documento.cajillas[indice];
      if (fila?.producto?.id === producto)
        return { sucursal: fila.sucursal.id, asignacion: null };
    }
  }
  return null;
}
