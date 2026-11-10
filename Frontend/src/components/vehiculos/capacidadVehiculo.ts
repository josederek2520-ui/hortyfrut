// La API conserva capacidad_kg para mantener los registros y contratos existentes.
// La interfaz permite ingresar y consultar toneladas sin redondear al guardar.
function desplazarDecimal(valor: string, posiciones: number): string {
  const [entero, fraccion = ""] = valor.split(".");
  const digitos = entero + fraccion;
  const punto = entero.length + posiciones;
  const expandido =
    punto <= 0
      ? `0.${"0".repeat(-punto)}${digitos}`
      : punto >= digitos.length
        ? digitos + "0".repeat(punto - digitos.length)
        : `${digitos.slice(0, punto)}.${digitos.slice(punto)}`;
  const [parteEntera, parteDecimal = ""] = expandido.split(".");
  const normalizado = parteEntera.replace(/^0+(?=\d)/, "");
  const decimal = parteDecimal.replace(/0+$/, "");
  return decimal ? `${normalizado}.${decimal}` : normalizado;
}

export function kilogramosAToneladas(valor?: string | null): string {
  if (!valor || !/^\d+(?:\.\d+)?$/.test(valor)) return "";
  return desplazarDecimal(valor, -3);
}

export function toneladasAKilogramos(valor: string): string | null {
  const normalizado = valor.trim().replace(",", ".");
  if (!normalizado) return "";
  if (
    !/^(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(normalizado) ||
    Number(normalizado) <= 0 ||
    Number(normalizado) > 999999.999999
  )
    return null;
  return desplazarDecimal(
    normalizado.startsWith(".") ? `0${normalizado}` : normalizado,
    3,
  );
}

export function formatearCapacidadToneladas(
  valor: string | null | undefined,
  idioma: string,
): string | null {
  const toneladas = kilogramosAToneladas(valor);
  if (!toneladas || Number(toneladas) <= 0) return null;
  return `${new Intl.NumberFormat(idioma, { maximumFractionDigits: 6 }).format(Number(toneladas))} t`;
}
