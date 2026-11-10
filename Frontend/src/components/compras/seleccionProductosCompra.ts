import type {
  DatosProductoCompra,
  LineaFormularioCompra,
  OpcionCompra,
} from "./tipos";

export type OrigenProductosCompra = "pedidos" | "catalogo";

export function productosSeleccionadosCompra(
  lineas: Pick<LineaFormularioCompra, "producto">[],
): number[] {
  return [...new Set(lineas.map((linea) => linea.producto.id))].sort(
    (primero, segundo) => primero - segundo,
  );
}

export function consultaReferenciasPedidosCompra(
  fecha: string,
  lineas: Pick<LineaFormularioCompra, "producto">[],
): string | null {
  const productos = productosSeleccionadosCompra(lineas);
  if (!fecha || !productos.length) return null;
  const parametros = new URLSearchParams({
    fecha_pedidos: fecha,
    productos: productos.join(","),
    vista: "resumen",
    pagina: "1",
  });
  return `compras/necesidades/?${parametros}`;
}

export function consultaProductosCompra({
  origen,
  fecha,
  buscar,
  pagina,
  categoria,
  excluidos,
}: {
  origen: OrigenProductosCompra;
  fecha: string;
  buscar: string;
  pagina: number;
  categoria: OpcionCompra | null;
  excluidos: number[];
}) {
  const parametros = new URLSearchParams({
    fecha_pedidos: fecha,
    buscar,
    pagina: String(pagina),
  });
  if (categoria) parametros.set("categoria", String(categoria.id));
  if (excluidos.length)
    parametros.set(
      "excluir_productos",
      [...new Set(excluidos)]
        .sort((primero, segundo) => primero - segundo)
        .join(","),
    );
  if (origen === "pedidos") {
    parametros.set("vista", "resumen");
    parametros.set("solo_disponibles", "true");
  }
  return `compras/${origen === "pedidos" ? "necesidades" : "productos"}/?${parametros}`;
}

export function incorporarProductoCompra(
  lineas: LineaFormularioCompra[],
  datos: DatosProductoCompra,
  clave: string,
): LineaFormularioCompra[] {
  if (
    lineas.length >= 500 ||
    lineas.some((linea) => linea.producto.id === datos.producto.id)
  )
    return lineas;
  return [
    ...lineas,
    {
      clave,
      producto: datos.producto,
      presentacion: datos.presentacion,
      proveedor: datos.proveedor,
      cantidad: datos.cantidad,
      importeTotal: datos.importeTotal,
    },
  ];
}

export function agregarOtroProveedorCompra(
  lineas: LineaFormularioCompra[],
  claveOrigen: string,
  claveNueva: string,
): LineaFormularioCompra[] {
  const origen = lineas.find((linea) => linea.clave === claveOrigen);
  if (!origen || lineas.length >= 500) return lineas;
  return [
    ...lineas,
    {
      clave: claveNueva,
      producto: origen.producto,
      presentacion: origen.presentacion,
      proveedor: null,
      cantidad: "",
      importeTotal: "",
    },
  ];
}
