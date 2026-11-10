import {
  aMiles,
  deMiles,
  compactarCantidadPreparacion,
} from "@/components/preparaciones/calculos";
import {
  camposDevolucion,
  type AporteDevolucion,
  type CampoDevolucion,
  type Devolucion,
  type LineaEditableDevolucion,
} from "./tipos";

export function medicionDevolucion(valor: string) {
  const normal = valor.trim().replace(",", ".");
  return /^\d{1,11}(?:\.\d{1,3})?$/.test(normal) ? aMiles(normal) : null;
}
export function lineaNuevaDevolucion(
  aporte: AporteDevolucion,
): LineaEditableDevolucion {
  return {
    aporte: aporte.id,
    es_kg: aporte.es_kg,
    producto_nombre: aporte.producto_nombre,
    unidad_abreviatura: aporte.unidad_abreviatura,
    cantidad_recibida: "",
    peso_kg_recibido: "",
    cantidad_aprovechable: "",
    cantidad_merma: "",
    peso_kg_aprovechable: "",
    peso_kg_merma: "",
  };
}
export function cargarLineasDevolucion(documento: Devolucion) {
  return Object.fromEntries(
    documento.lineas.map((fila) => [
      fila.aporte,
      {
        aporte: fila.aporte,
        es_kg: fila.es_kg,
        producto_nombre: fila.producto_nombre,
        unidad_abreviatura: fila.unidad_abreviatura,
        ...Object.fromEntries(
          camposDevolucion.map((campo) => [
            campo,
            fila[campo] === null
              ? ""
              : compactarCantidadPreparacion(fila[campo]!),
          ]),
        ),
      } as LineaEditableDevolucion,
    ]),
  );
}
export function cambiarMedicionDevolucion(
  linea: LineaEditableDevolucion,
  campo: CampoDevolucion,
  valor: string,
) {
  const siguiente = { ...linea, [campo]: valor };
  if (linea.es_kg && campo.startsWith("cantidad_"))
    siguiente[
      campo === "cantidad_recibida"
        ? "peso_kg_recibido"
        : (("peso_kg_" + campo.slice(9)) as CampoDevolucion)
    ] = valor;
  return siguiente;
}
export function prepararDevolucion(
  lineas: Record<number, LineaEditableDevolucion>,
  revision: boolean,
  completo = false,
) {
  const campos: CampoDevolucion[] = revision
    ? [
        "cantidad_aprovechable",
        "cantidad_merma",
        "peso_kg_aprovechable",
        "peso_kg_merma",
      ]
    : ["cantidad_recibida", "peso_kg_recibido"];
  const errores: Record<string, string[]> = {};
  const filas = Object.values(lineas).map((linea) => {
    const fila: Record<string, string | number | null> = {
      aporte: linea.aporte,
    };
    for (const campo of campos) {
      const valor =
        linea.es_kg && campo.startsWith("peso_kg_")
          ? linea[
              campo === "peso_kg_recibido"
                ? "cantidad_recibida"
                : (("cantidad_" + campo.slice(8)) as CampoDevolucion)
            ]
          : linea[campo];
      const normal = valor.trim().replace(",", ".");
      const medicion = medicionDevolucion(normal);
      if (normal && medicion === null)
        errores[linea.aporte + "_" + campo] = ["decimal"];
      else if (
        completo &&
        (medicion === null || (!revision && medicion === BigInt(0)))
      )
        errores[linea.aporte + "_" + campo] = [
          revision ? "completarPartes" : "positivo",
        ];
      fila[campo] = normal || null;
    }
    if (revision) {
      for (const [prefijo, recibido] of [
        ["cantidad_", linea.cantidad_recibida],
        ["peso_kg_", linea.peso_kg_recibido],
      ] as const) {
        const aprovechable = medicionDevolucion(
          String(fila[prefijo + "aprovechable"] ?? ""),
        );
        const merma = medicionDevolucion(String(fila[prefijo + "merma"] ?? ""));
        if (
          aprovechable !== null &&
          merma !== null &&
          aprovechable + merma !== medicionDevolucion(recibido)
        )
          errores[linea.aporte + "_" + prefijo + "merma"] = ["sumaExacta"];
      }
    }
    return fila;
  });
  if (completo && !filas.length) errores.lineas = ["agregarAporte"];
  return { filas, errores };
}
export function totalPesoDevolucion(
  lineas: Record<number, LineaEditableDevolucion>,
  campo: CampoDevolucion,
) {
  let total = BigInt(0);
  for (const linea of Object.values(lineas)) {
    const valor = medicionDevolucion(linea[campo]);
    if (valor === null) return null;
    total += valor;
  }
  return Object.keys(lineas).length
    ? compactarCantidadPreparacion(deMiles(total))
    : null;
}
