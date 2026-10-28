import { mostrarBolivianos } from "@/lib/moneda";

const maximoCentavos = BigInt("99999999999999");

function numeroEscalado(valor: string, decimales: number): bigint | null {
  const normalizado = valor.trim().replace(",", ".") || "0";
  if (!new RegExp(`^[0-9]+(?:\\.[0-9]{1,${decimales}})?$`).test(normalizado))
    return null;
  const [entero, fraccion = ""] = normalizado.split(".");
  return BigInt(entero + fraccion.padEnd(decimales, "0"));
}

export function subtotalCentavos(
  cantidad: string,
  precio: string,
): bigint | null {
  const cantidadEscalada = numeroEscalado(cantidad, 3);
  const precioEscalado = numeroEscalado(precio, 2);
  if (cantidadEscalada === null || precioEscalado === null) return null;
  const subtotal =
    (cantidadEscalada * precioEscalado + BigInt(500)) / BigInt(1000);
  return subtotal <= maximoCentavos ? subtotal : null;
}

export function totalCentavos(
  lineas: { cantidad: string; precioUnitario: string }[],
): bigint | null {
  let total = BigInt(0);
  for (const linea of lineas) {
    const subtotal = subtotalCentavos(linea.cantidad, linea.precioUnitario);
    if (subtotal === null) return null;
    total += subtotal;
  }
  return total <= maximoCentavos ? total : null;
}

export function mostrarCentavos(valor: bigint | null, idioma: string): string {
  return valor === null ? "—" : mostrarBolivianos(Number(valor) / 100, idioma);
}

export function mostrarImporte(valor: string, idioma: string): string {
  return mostrarBolivianos(valor, idioma);
}

export function mostrarFecha(fecha: string, idioma: string): string {
  return new Intl.DateTimeFormat(idioma, {
    dateStyle: "medium",
    timeZone: "America/La_Paz",
  }).format(new Date(`${fecha}T12:00:00-04:00`));
}
