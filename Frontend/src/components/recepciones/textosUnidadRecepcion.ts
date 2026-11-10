import type { UnidadRecepcion } from "./tipos";

// Solo adapta los textos. Las unidades habilitadas y los valores no se modifican.
export function textosUnidadRecepcion(unidad: UnidadRecepcion) {
  if (unidad.es_kg) return { etiqueta: "pesoRecibido", ayuda: "pesarCantidad" };
  const nombres = [unidad.nombre, unidad.abreviatura].map((valor) =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, ""),
  );
  if (
    nombres.some((nombre) =>
      [
        "unidad",
        "unidades",
        "u",
        "ud",
        "uds",
        "uni",
        "und",
        "unit",
        "units",
      ].includes(nombre),
    )
  )
    return { etiqueta: "unidadesContadas", ayuda: "contarUnidades" };
  if (
    nombres.some((nombre) =>
      ["caja", "cajas", "cj", "caj", "box", "boxes"].includes(nombre),
    )
  )
    return { etiqueta: "cajasContadas", ayuda: "contarCajas" };
  return { etiqueta: "cantidadMedidaUnidad", ayuda: "medirCantidadUnidad" };
}
