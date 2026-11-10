import { aMiles, compactarCantidadPreparacion, deMiles } from "./calculos";
import type {
  AsignacionEditable,
  CajillaEditable,
  DocumentoEditable,
} from "./tipos";

export interface CantidadRevisionPreparacion {
  columna: "cajas" | "unidades";
  presentacion: string;
  cantidad: string | null;
}
export interface ProductoRevisionPreparacion {
  id: number;
  nombre: string;
  imagen: string | null;
  asignaciones: AsignacionEditable[];
  cajillas: CajillaEditable[];
  cantidades: CantidadRevisionPreparacion[];
  pesoKg: string | null;
}
export interface SucursalRevisionPreparacion {
  id: number;
  nombre: string;
  productos: ProductoRevisionPreparacion[];
  pedidos: { id: number; codigo: string }[];
  cajillasHistoricas: CajillaEditable[];
}

export function numeroRevisionPreparacion(
  valor: string | number,
  idioma: string,
): string {
  const texto = compactarCantidadPreparacion(String(valor));
  if (!/^\d+(\.\d+)?$/.test(texto)) return texto;
  const [entero, decimal] = texto.split(".");
  const formato = new Intl.NumberFormat(idioma);
  const separador =
    formato.formatToParts(1.1).find((parte) => parte.type === "decimal")
      ?.value || ".";
  return formato.format(BigInt(entero)) + (decimal ? separador + decimal : "");
}

export function pesoAsignacionesRevision(
  asignaciones: AsignacionEditable[],
  documento: DocumentoEditable,
): string | null {
  if (!asignaciones.length) return null;
  const lotes = new Map(
    documento.lineas.map((linea) => [linea.lote.id, linea.lote]),
  );
  let total = BigInt(0);
  for (const asignacion of asignaciones) {
    let medido = false;
    for (const [identificador, aporte] of Object.entries(asignacion.aportes)) {
      if (!aporte.cantidad.trim() && !aporte.pesoKg.trim()) continue;
      if (!/^\d{1,11}(\.\d{1,3})?$/.test(aporte.cantidad)) return null;
      if (aMiles(aporte.cantidad) === BigInt(0)) continue;
      const lote = lotes.get(Number(identificador));
      if (!lote) return null;
      const peso = lote.es_kg ? aporte.cantidad : aporte.pesoKg;
      if (!/^\d{1,11}(\.\d{1,3})?$/.test(peso) || aMiles(peso) <= BigInt(0))
        return null;
      total += aMiles(peso);
      medido = true;
    }
    if (!medido) return null;
  }
  return compactarCantidadPreparacion(deMiles(total));
}

export function agruparRevisionPreparacion(
  documento: DocumentoEditable,
): SucursalRevisionPreparacion[] {
  const sucursales = new Map<number, SucursalRevisionPreparacion>();
  const obtenerSucursal = (id: number, nombre: string) => {
    let sucursal = sucursales.get(id);
    if (!sucursal) {
      sucursal = {
        id,
        nombre,
        productos: [],
        pedidos: [],
        cajillasHistoricas: [],
      };
      sucursales.set(id, sucursal);
    }
    return sucursal;
  };
  const obtenerProducto = (
    sucursal: SucursalRevisionPreparacion,
    id: number,
    nombre: string,
  ) => {
    let producto = sucursal.productos.find((fila) => fila.id === id);
    if (!producto) {
      producto = {
        id,
        nombre,
        imagen:
          documento.lineas.find((fila) => fila.lote.producto === id)?.lote
            .producto_imagen || null,
        asignaciones: [],
        cajillas: [],
        cantidades: [],
        pesoKg: null,
      };
      sucursal.productos.push(producto);
    }
    return producto;
  };
  Object.values(documento.asignaciones).forEach((asignacion) => {
    const sucursal = obtenerSucursal(
      asignacion.sucursal,
      asignacion.sucursalNombre,
    );
    if (!sucursal.pedidos.some((fila) => fila.id === asignacion.pedido))
      sucursal.pedidos.push({
        id: asignacion.pedido,
        codigo: asignacion.codigo,
      });
    const producto = obtenerProducto(
      sucursal,
      asignacion.producto,
      asignacion.productoNombre,
    );
    producto.imagen ||= asignacion.imagen || null;
    producto.asignaciones.push(asignacion);
    let cantidad = producto.cantidades.find(
      (fila) =>
        fila.columna === asignacion.columna &&
        fila.presentacion === asignacion.presentacion,
    );
    if (!cantidad) {
      cantidad = {
        columna: asignacion.columna,
        presentacion: asignacion.presentacion,
        cantidad: "0",
      };
      producto.cantidades.push(cantidad);
    }
    cantidad.cantidad =
      cantidad.cantidad !== null && /^\d+$/.test(asignacion.cantidad)
        ? String(BigInt(cantidad.cantidad) + BigInt(asignacion.cantidad))
        : null;
  });
  documento.cajillas.forEach((fila) => {
    const sucursal = obtenerSucursal(fila.sucursal.id, fila.sucursal.nombre);
    if (fila.producto)
      obtenerProducto(
        sucursal,
        fila.producto.id,
        fila.producto.nombre,
      ).cajillas.push(fila);
    else sucursal.cajillasHistoricas.push(fila);
  });
  for (const sucursal of sucursales.values()) {
    for (const producto of sucursal.productos)
      producto.pesoKg = pesoAsignacionesRevision(
        producto.asignaciones,
        documento,
      );
    sucursal.productos.sort(
      (primero, segundo) =>
        primero.nombre.localeCompare(segundo.nombre) || primero.id - segundo.id,
    );
  }
  return [...sucursales.values()].sort(
    (primero, segundo) =>
      primero.nombre.localeCompare(segundo.nombre) || primero.id - segundo.id,
  );
}

export function totalCajillasRevision(
  documento: DocumentoEditable,
): number | null {
  let total = BigInt(0);
  for (const fila of documento.cajillas) {
    if (!/^\d+$/.test(fila.cantidad)) return null;
    total += BigInt(fila.cantidad);
  }
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
