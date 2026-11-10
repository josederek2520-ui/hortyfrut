export function compactarMedida(valor: string): string {
  return /^-?\d+\.\d+$/.test(valor)
    ? valor.replace(/0+$/, "").replace(/\.$/, "")
    : valor;
}
