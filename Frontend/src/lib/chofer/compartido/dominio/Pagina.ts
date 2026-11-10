export interface Pagina<T> {
  registros: T[];
  total: number;
  pagina: number;
}
export function exigirIdentificador(valor: number): number {
  if (!Number.isSafeInteger(valor) || valor < 1)
    throw new Error("Identificador no válido");
  return valor;
}
