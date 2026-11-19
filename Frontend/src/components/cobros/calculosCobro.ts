import type { FormularioCobro } from "./tipos";
export function requiereComprobante(medio: string) {
  return medio === "transferencia" || medio === "deposito";
}
export function validarArchivoCobro(archivo: Pick<File, "size" | "type">) {
  return (
    archivo.size > 0 &&
    archivo.size <= 8 * 1024 * 1024 &&
    ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      archivo.type,
    )
  );
}
export function centavosCobro(valor: string): bigint | null {
  const texto = valor.trim().replace(",", ".");
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(texto)) return null;
  const [entero, decimales = ""] = texto.split(".");
  const resultado =
    BigInt(entero) * BigInt(100) + BigInt(decimales.padEnd(2, "0"));
  return resultado <= BigInt(999999999999999999) ? resultado : null;
}
export function importeDesdeCentavos(centavos: bigint) {
  return `${centavos < BigInt(0) ? "-" : ""}${(centavos < BigInt(0) ? -centavos : centavos) / BigInt(100)}.${((centavos < BigInt(0) ? -centavos : centavos) % BigInt(100)).toString().padStart(2, "0")}`;
}
export function sumarAplicaciones(formulario: FormularioCobro) {
  return formulario.aplicaciones.reduce(
    (suma, fila) => suma + (centavosCobro(fila.importeAplicado) ?? BigInt(0)),
    BigInt(0),
  );
}
export function prepararCobro(formulario: FormularioCobro, clave: string) {
  const errores: string[] = [],
    importe = centavosCobro(formulario.importe);
  if (!formulario.cliente) errores.push("elegirCliente");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formulario.fecha_cobro))
    errores.push("fechaValida");
  if (importe === null || importe <= BigInt(0)) errores.push("importeValido");
  if (!formulario.aplicaciones.length || formulario.aplicaciones.length > 100)
    errores.push("elegirVentas");
  if (
    new Set(formulario.aplicaciones.map((f) => f.id)).size !==
    formulario.aplicaciones.length
  )
    errores.push("elegirVentas");
  if (
    formulario.aplicaciones.some((fila) => {
      const valor = centavosCobro(fila.importeAplicado);
      return (
        valor === null ||
        valor <= BigInt(0) ||
        valor > (centavosCobro(fila.saldo) ?? BigInt(0)) ||
        fila.cliente !== formulario.cliente?.id
      );
    })
  )
    errores.push("aplicacionValida");
  if (importe !== sumarAplicaciones(formulario))
    errores.push("distribucionExacta");
  if (
    !["efectivo", "transferencia", "deposito", "otro"].includes(
      formulario.medio,
    )
  )
    errores.push("medioValido");
  if (requiereComprobante(formulario.medio)) {
    if (!formulario.comprobante) errores.push("comprobanteNecesario");
    else if (!validarArchivoCobro(formulario.comprobante))
      errores.push("comprobanteValido");
  }
  return {
    errores: [...new Set(errores)],
    cuerpo: {
      clave_operacion: clave,
      cliente: formulario.cliente?.id,
      fecha_cobro: formulario.fecha_cobro,
      importe: importeDesdeCentavos(importe ?? BigInt(0)),
      medio: formulario.medio,
      aplicaciones: formulario.aplicaciones.map((fila) => ({
        venta: fila.id,
        importe: importeDesdeCentavos(
          centavosCobro(fila.importeAplicado) ?? BigInt(0),
        ),
        version_saldo: fila.version_saldo,
      })),
      revision: "",
    },
  };
}
