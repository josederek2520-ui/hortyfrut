// Conserva el formato numérico del idioma y unifica el símbolo visible.
// BOB es el identificador ISO que requiere Intl; la interfaz muestra Bs.
export function mostrarBolivianos(
  valor: number | string,
  idioma: string,
): string {
  return new Intl.NumberFormat(idioma, {
    style: "currency",
    currency: "BOB",
    currencyDisplay: "code",
  })
    .formatToParts(Number(valor))
    .map((parte) => (parte.type === "currency" ? "Bs" : parte.value))
    .join("");
}
