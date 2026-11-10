import type { CargaPreparada } from "./tipos";

export interface ComprobacionCapacidad {
  estado:
    "sin_carga" | "sin_capacidad" | "peso_incompleto" | "excedida" | "apta";
  capacidad_kg: string | null;
  peso_kg: string | null;
  margen_kg: string | null;
}

export interface OcupacionCapacidad {
  porcentaje: string;
  cota: "menor" | "mayor" | null;
  porcentajeBarra: number;
  cercaDelLimite: boolean;
  excedida: boolean;
  disponibleKg: string;
  excesoKg: string;
}

// Es una presentación del resultado existente; no añade reglas para operar el viaje.
export function calcularOcupacionCapacidad(
  resultado: ComprobacionCapacidad,
): OcupacionCapacidad | null {
  if (resultado.estado !== "apta" && resultado.estado !== "excedida")
    return null;
  const capacidad = milesPositivos(resultado.capacidad_kg);
  const peso = milesPositivos(resultado.peso_kg);
  if (capacidad === null || peso === null) return null;
  const excedida = peso > capacidad;
  let centesimas = (peso * BigInt(10000) + capacidad / BigInt(2)) / capacidad;
  let cota: OcupacionCapacidad["cota"] = null;
  if (centesimas === BigInt(0)) {
    centesimas = BigInt(1);
    cota = "menor";
  } else if (excedida && centesimas === BigInt(10000)) cota = "mayor";
  else if (peso < capacidad && centesimas === BigInt(10000)) cota = "menor";
  const entero = centesimas / BigInt(100);
  const decimal = String(centesimas % BigInt(100))
    .padStart(2, "0")
    .replace(/0+$/, "");
  return {
    porcentaje: String(entero) + (decimal ? "." + decimal : ""),
    cota,
    porcentajeBarra:
      Number(((excedida ? capacidad : peso) * BigInt(1000000)) / capacidad) /
      10000,
    cercaDelLimite: !excedida && peso * BigInt(100) >= capacidad * BigInt(80),
    excedida,
    disponibleKg: desdeMiles(excedida ? BigInt(0) : capacidad - peso),
    excesoKg: desdeMiles(excedida ? peso - capacidad : BigInt(0)),
  };
}

export function formatearMedicionCapacidad(
  valor: string,
  idioma: string,
): string {
  if (!/^\d+(?:\.\d+)?$/.test(valor)) return valor;
  const [entero, fraccion = ""] = valor.split(".");
  const decimal = fraccion.replace(/0+$/, "");
  const formato = new Intl.NumberFormat(idioma);
  const separador =
    formato.formatToParts(1.1).find((parte) => parte.type === "decimal")
      ?.value ?? ".";
  return formato.format(BigInt(entero)) + (decimal ? separador + decimal : "");
}

function milesPositivos(valor: string | null | undefined): bigint | null {
  if (typeof valor !== "string" || !/^\d+(?:\.\d{1,3})?$/.test(valor))
    return null;
  const [entero, decimales = ""] = valor.split(".");
  const miles =
    BigInt(entero) * BigInt(1000) + BigInt(decimales.padEnd(3, "0"));
  return miles > BigInt(0) ? miles : null;
}

function desdeMiles(valor: bigint): string {
  const signo = valor < BigInt(0) ? "-" : "";
  const absoluto = valor < BigInt(0) ? -valor : valor;
  return `${signo}${absoluto / BigInt(1000)}.${String(absoluto % BigInt(1000)).padStart(3, "0")}`;
}

export function comprobarCapacidadDespacho(
  capacidadKg: string | null | undefined,
  cargas: CargaPreparada[],
): ComprobacionCapacidad {
  const capacidad = milesPositivos(capacidadKg);
  const resultado: ComprobacionCapacidad = {
    estado: "sin_carga",
    capacidad_kg: capacidad === null ? null : desdeMiles(capacidad),
    peso_kg: null,
    margen_kg: null,
  };
  if (!cargas.length) return resultado;
  let peso = BigInt(0);
  for (const carga of cargas) {
    const pesos = (carga.aportes ?? []).map((aporte) =>
      milesPositivos(aporte.peso_kg),
    );
    if (!pesos.length || pesos.some((valor) => valor === null)) {
      return { ...resultado, estado: "peso_incompleto" };
    }
    const medido = pesos.reduce<bigint>(
      (suma, valor) => suma + valor!,
      BigInt(0),
    );
    if (milesPositivos(carga.peso_kg) !== medido) {
      return { ...resultado, estado: "peso_incompleto" };
    }
    peso += medido;
  }
  return {
    ...resultado,
    estado:
      capacidad === null
        ? "sin_capacidad"
        : peso > capacidad
          ? "excedida"
          : "apta",
    peso_kg: desdeMiles(peso),
    margen_kg: capacidad === null ? null : desdeMiles(capacidad - peso),
  };
}
