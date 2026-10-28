import type {
  LineaRecepcion,
  OpcionProductoRecepcion,
  Recepcion,
} from "./tipos";
import type { FieldErrors as ErroresCampos } from "@/lib/form-validation";

// Elegir una unidad o ver una fila no implica que haya llegado producto.
export function seleccionarLineasRecepcion(lineas: LineaRecepcion[]) {
  const indices: number[] = [];
  const seleccionadas = lineas.filter((linea, indice) => {
    const anotada = [
      linea.cantidadCompra,
      linea.cantidadInventario,
      linea.pesoKg,
      linea.vencimiento,
    ].some((valor) => !!valor.trim());
    if (anotada) indices.push(indice);
    return anotada;
  });
  return { lineas: seleccionadas, indices };
}

export function erroresEnHojaRecepcion(
  errores: ErroresCampos,
  indices: number[],
): ErroresCampos {
  return Object.fromEntries(
    Object.entries(errores).map(([campo, mensajes]) => {
      const detalle = /^detalle_(\d+)_(.+)$/.exec(campo);
      return [
        detalle && indices[Number(detalle[1])] !== undefined
          ? `detalle_${indices[Number(detalle[1])]}_${detalle[2]}`
          : campo,
        mensajes,
      ];
    }),
  );
}

export function aMilesRecepcion(valor: string, enteros = 11): bigint | null {
  const normalizado = valor.trim().replace(",", ".") || "0";
  if (!new RegExp(`^[0-9]{1,${enteros}}(?:\\.[0-9]{1,3})?$`).test(normalizado))
    return null;
  const [entero, decimal = ""] = normalizado.split(".");
  return BigInt(entero + decimal.padEnd(3, "0"));
}

export function mismaUnidadRecepcion(linea: LineaRecepcion): boolean {
  return (
    !!linea.detalleCompra &&
    !!linea.unidadCompra &&
    linea.unidadCompra === linea.unidad.id
  );
}

export function actualizarMedicion(
  linea: LineaRecepcion,
  cambios: Partial<LineaRecepcion>,
): LineaRecepcion {
  const nueva = { ...linea, ...cambios };
  if (cambios.unidad && cambios.unidad.id !== linea.unidad.id) {
    nueva.cantidadInventario = "";
    nueva.pesoKg = "";
    if (mismaUnidadRecepcion(nueva)) nueva.cantidadCompra = "";
  } else if (mismaUnidadRecepcion(nueva)) {
    if ("cantidadCompra" in cambios)
      nueva.cantidadInventario = nueva.cantidadCompra;
    if ("cantidadInventario" in cambios)
      nueva.cantidadCompra = nueva.cantidadInventario;
  }
  if (nueva.unidad.es_kg) nueva.pesoKg = "";
  return nueva;
}

export function lineaDesdeOpcion(
  opcion: OpcionProductoRecepcion,
): LineaRecepcion {
  return {
    clave: `compra-${opcion.id}`,
    detalleCompra: opcion.id,
    producto: { id: opcion.producto, nombre: opcion.nombre },
    unidad: opcion.unidad,
    medidaCompra: opcion.medida_compra || "",
    pendiente: opcion.cantidad_pendiente,
    proveedorNombre: opcion.proveedor_nombre || "",
    unidadCompra: opcion.unidad_compra ?? null,
    disponible: opcion.disponible,
    cantidadCompra: "",
    cantidadInventario: "",
    pesoKg: "",
    vencimiento: "",
  };
}

export function lineasDesdeRecepcion(recepcion?: Recepcion): LineaRecepcion[] {
  return (recepcion?.detalles || []).map((linea) => ({
    clave: linea.detalle_compra
      ? `compra-${linea.detalle_compra}`
      : `detalle-${linea.id}`,
    id: linea.id,
    detalleCompra: linea.detalle_compra,
    producto: { id: linea.producto, nombre: linea.producto_nombre },
    unidad: {
      id: linea.unidad_inventario,
      nombre: linea.unidad_nombre,
      abreviatura: linea.unidad_abreviatura,
      es_kg: linea.es_kg,
    },
    medidaCompra: linea.medida_compra_nombre,
    pendiente: linea.cantidad_pendiente ?? undefined,
    proveedorNombre: linea.proveedor_nombre,
    unidadCompra: linea.unidad_compra ?? null,
    cantidadCompra: linea.cantidad_compra,
    cantidadInventario: linea.cantidad_inventario,
    pesoKg: linea.peso_kg || "",
    vencimiento: linea.fecha_vencimiento || "",
  }));
}

export function serializarLineasRecepcion(
  lineas: LineaRecepcion[],
  vinculada: boolean,
) {
  const normalizar = (valor: string) => valor.trim().replace(",", ".") || "0";
  return lineas.map((linea) => ({
    ...(linea.id ? { id: linea.id } : {}),
    detalle_compra: linea.detalleCompra,
    producto: linea.producto.id,
    unidad_inventario: linea.unidad.id,
    cantidad_compra: vinculada ? normalizar(linea.cantidadCompra) : "0",
    cantidad_inventario: normalizar(linea.cantidadInventario),
    peso_kg: linea.unidad.es_kg
      ? null
      : linea.pesoKg.trim()
        ? normalizar(linea.pesoKg)
        : null,
    fecha_vencimiento: linea.vencimiento || null,
  }));
}
