import type { AcuerdoPrecio, FormularioPrecio } from "./tipos";

export function centavosPrecio(valor: string): bigint | null {
  const texto = valor.trim().replace(",", ".");
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(texto)) return null;
  const [entero, decimal = ""] = texto.split(".");
  const resultado =
    BigInt(entero) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
  return resultado > 0 ? resultado : null;
}
export function normalizarPrecio(valor: string) {
  const centavos = centavosPrecio(valor);
  return centavos === null
    ? null
    : `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, "0")}`;
}
export function cargarFormularioPrecio(
  acuerdo: AcuerdoPrecio,
): FormularioPrecio {
  return {
    cliente: { id: acuerdo.cliente, nombre: acuerdo.cliente_nombre },
    alcance: acuerdo.alcance,
    desde: acuerdo.desde ?? "",
    hasta: acuerdo.hasta ?? "",
    referencia_propuesta: acuerdo.referencia_propuesta,
    entregas: [...acuerdo.entregas],
    lineas: acuerdo.lineas.map((fila) => ({
      ...fila,
      precio_kg: fila.precio_kg ?? "",
    })),
  };
}
export function prepararPrecio(
  formulario: FormularioPrecio,
  completo: boolean,
) {
  const errores: Record<string, string[]> = {};
  if (!formulario.cliente) errores.cliente = ["clienteObligatorio"];
  if (formulario.alcance === "periodo") {
    if (completo && (!formulario.desde || !formulario.hasta))
      errores.desde = ["fechasObligatorias"];
    if (
      formulario.desde &&
      formulario.hasta &&
      formulario.desde > formulario.hasta
    )
      errores.hasta = ["fechasOrdenadas"];
  } else if (completo && !formulario.entregas.length)
    errores.entregas = ["entregasObligatorias"];
  if (completo && !formulario.lineas.length)
    errores.lineas = ["productosObligatorios"];
  if (
    formulario.lineas.length > 500 ||
    new Set(formulario.lineas.map((f) => f.producto)).size !==
      formulario.lineas.length
  )
    errores.lineas = ["productosRepetidos"];
  const lineas = formulario.lineas.map((fila) => {
    const precio = normalizarPrecio(fila.precio_kg);
    if ((fila.precio_kg.trim() || completo) && !precio)
      errores[`${fila.producto}_precio_kg`] = ["precioValido"];
    return { producto: fila.producto, precio_kg: precio };
  });
  return {
    errores,
    datos: {
      cliente: formulario.cliente?.id,
      alcance: formulario.alcance,
      desde: formulario.alcance === "periodo" ? formulario.desde || null : null,
      hasta: formulario.alcance === "periodo" ? formulario.hasta || null : null,
      referencia_propuesta: formulario.referencia_propuesta,
      lineas,
      entregas: formulario.alcance === "entregas" ? formulario.entregas : [],
    },
  };
}
