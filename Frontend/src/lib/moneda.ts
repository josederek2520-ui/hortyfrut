// Conserva el formato numérico del idioma y unifica el símbolo visible.
// BOB es el identificador ISO que requiere Intl; la interfaz muestra Bs.
export function mostrarBolivianos(
  valor: number | string,
  idioma: string,
): string {
  // Mantener los centavos exactos de los importes persistidos como texto,
  // también cuando la parte entera supera la precisión segura de Number.
  const exacto =
    typeof valor === "string"
      ? /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(valor)
      : null;
  const entero = exacto ? BigInt(exacto[1] + exacto[2]) : null;
  const numero =
    entero !== null
      ? entero === BigInt(0) && exacto![1]
        ? -0
        : entero
      : Number(valor);
  return new Intl.NumberFormat(idioma, {
    style: "currency",
    currency: "BOB",
    currencyDisplay: "code",
  })
    .formatToParts(numero)
    .map((parte) =>
      parte.type === "currency"
        ? "Bs"
        : parte.type === "fraction" && exacto
          ? (exacto[3] ?? "").padEnd(2, "0")
          : parte.value,
    )
    .join("");
}
