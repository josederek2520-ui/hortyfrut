import {
  aMiles,
  deMiles,
  compactarCantidadPreparacion,
} from "@/components/preparaciones/calculos";
import { formatearMedicionCapacidad } from "@/components/despachos/capacidadDespacho";
import type {
  CampoRecepcion,
  LineaEditable,
  HojaEntrega,
  ProductoEntrega,
  AporteEditable,
} from "./tipos";

export const camposRecepcion: CampoRecepcion[] = [
  "cajas_recibidas",
  "unidades_recibidas",
  "peso_recibido_kg",
  "cajas_rechazadas",
  "unidades_rechazadas",
  "peso_rechazado_kg",
  "motivo_rechazo",
];
export function lineaVacia(): LineaEditable {
  return {
    cajas_recibidas: "",
    unidades_recibidas: "",
    peso_recibido_kg: "",
    cajas_rechazadas: "0",
    unidades_rechazadas: "0",
    peso_rechazado_kg: "0",
    motivo_rechazo: "",
  };
}
export function normalizarMedicion(valor: string) {
  return valor.trim().replace(",", ".");
}
export function medirEntrega(valor: string): bigint | null {
  const normal = normalizarMedicion(valor);
  return /^\d{1,11}(?:\.\d{1,3})?$/.test(normal) ? aMiles(normal) : null;
}
export function pesoAceptado(linea: LineaEditable): string | null {
  const recibido = medirEntrega(linea.peso_recibido_kg),
    rechazado = medirEntrega(linea.peso_rechazado_kg);
  return recibido === null || rechazado === null || rechazado > recibido
    ? null
    : compactarCantidadPreparacion(deMiles(recibido - rechazado));
}
export function mostrarMedicion(valor: string | null, idioma: string) {
  if (valor === null) return "—";
  const negativo = valor.startsWith("-");
  return (
    (negativo ? "−" : "") +
    formatearMedicionCapacidad(negativo ? valor.slice(1) : valor, idioma)
  );
}
export function cargarLineas(hoja: HojaEntrega) {
  return Object.fromEntries(
    hoja.lineas.map((fila) => [
      fila.producto,
      Object.fromEntries(
        camposRecepcion.map((campo) => [
          campo,
          fila[campo] == null
            ? ""
            : campo.startsWith("peso_")
              ? compactarCantidadPreparacion(String(fila[campo]))
              : String(fila[campo]),
        ]),
      ) as LineaEditable,
    ]),
  );
}
export function prepararLineas(lineas: Record<number, LineaEditable>) {
  const errores: Record<string, string[]> = {};
  const filas = Object.entries(lineas).map(([producto, linea]) => {
    const fila: Record<string, string | number | null> = {
      producto: Number(producto),
    };
    for (const campo of camposRecepcion) {
      const valor = normalizarMedicion(linea[campo]);
      if (campo === "motivo_rechazo") {
        fila[campo] = linea[campo].trim();
        continue;
      }
      if (
        (!valor && campo.endsWith("recibidas")) ||
        (!valor && campo === "peso_recibido_kg")
      ) {
        fila[campo] = null;
        continue;
      }
      const entero =
        campo.startsWith("cajas_") || campo.startsWith("unidades_");
      if (entero ? !/^\d{1,6}$/.test(valor) : medirEntrega(valor) === null)
        errores[`${producto}_${campo}`] = [entero ? "entero" : "decimal"];
      fila[campo] = entero ? Number(valor) : valor;
    }
    return fila;
  });
  return { filas, errores };
}
export function diferenciaEntrega(
  hoja: HojaEntrega,
  lineas: Record<number, LineaEditable>,
) {
  let enviado = BigInt(0),
    recibido = BigInt(0);
  for (const producto of hoja.origen.productos) {
    const peso =
      producto.peso_kg === null ? null : medirEntrega(producto.peso_kg);
    const real = medirEntrega(
      lineas[producto.producto]?.peso_recibido_kg ?? "",
    );
    if (peso === null || real === null) return null;
    enviado += peso;
    recibido += real;
  }
  return compactarCantidadPreparacion(deMiles(enviado - recibido));
}

export function diferenciaProductoEntrega(
  enviado: string | null,
  recibido: string,
) {
  const pesoEnviado = enviado === null ? null : medirEntrega(enviado);
  const pesoRecibido = medirEntrega(recibido);
  return pesoEnviado === null || pesoRecibido === null
    ? null
    : compactarCantidadPreparacion(deMiles(pesoEnviado - pesoRecibido));
}

export function erroresLineaEntrega(linea: LineaEditable, completo = true) {
  const errores: Record<string, string[]> = {};
  for (const [recibido, rechazado] of [
    ["cajas_recibidas", "cajas_rechazadas"],
    ["unidades_recibidas", "unidades_rechazadas"],
    ["peso_recibido_kg", "peso_rechazado_kg"],
  ] as const) {
    const entero = recibido !== "peso_recibido_kg";
    const leer = (valor: string) =>
      entero
        ? /^\d{1,6}$/.test(normalizarMedicion(valor))
          ? BigInt(valor.trim())
          : null
        : medirEntrega(valor);
    const cantidad = leer(linea[recibido]),
      rechazo = leer(linea[rechazado]);
    if (cantidad === null && (completo || linea[recibido].trim()))
      errores[recibido] = [
        !linea[recibido].trim()
          ? "cantidadObligatoria"
          : entero
            ? "entero"
            : "decimal",
      ];
    if (rechazo === null) errores[rechazado] = [entero ? "entero" : "decimal"];
    else if (cantidad !== null && rechazo > cantidad)
      errores[rechazado] = ["rechazoExcesivo"];
  }
  if (
    [
      linea.cajas_rechazadas,
      linea.unidades_rechazadas,
      linea.peso_rechazado_kg,
    ].some((valor) => (medirEntrega(valor) ?? BigInt(0)) > BigInt(0)) &&
    !linea.motivo_rechazo.trim()
  )
    errores.motivo_rechazo = ["motivoObligatorio"];
  return errores;
}

export function validarRecepcionEntrega(
  hoja: HojaEntrega,
  lineas: Record<number, LineaEditable>,
  fecha: string,
  recibidoPor: string,
) {
  const errores: Record<string, string[]> = {};
  if (!fecha) errores.fecha_recepcion = ["fechaObligatoria"];
  else if (fecha < hoja.fecha_minima || fecha > hoja.fecha_maxima)
    errores.fecha_recepcion = ["fechaFueraRango"];
  if (!recibidoPor.trim()) errores.recibido_por = ["personaObligatoria"];
  for (const producto of hoja.origen.productos) {
    for (const [campo, mensajes] of Object.entries(
      erroresLineaEntrega(lineas[producto.producto] ?? lineaVacia()),
    ))
      errores[`${producto.producto}_${campo}`] = mensajes;
    if (producto.peso_kg === null)
      errores[`${producto.producto}_peso_recibido_kg`] = [
        "pesoOrigenIncompleto",
      ];
  }
  return errores;
}

export function progresoRecepcionEntrega(
  hoja: HojaEntrega,
  lineas: Record<number, LineaEditable>,
) {
  return {
    total: hoja.origen.productos.length,
    completos: hoja.origen.productos.filter(
      (producto) =>
        producto.peso_kg !== null &&
        !Object.keys(
          erroresLineaEntrega(lineas[producto.producto] ?? lineaVacia()),
        ).length,
    ).length,
  };
}

export function destinoErrorEntrega(hoja: HojaEntrega, campo: string) {
  const coincidencia = /^(?:lotes_)?(\d+)(?:_|$)/.exec(campo);
  const indice = hoja.origen.productos.findIndex(
    (producto) => producto.producto === Number(coincidencia?.[1]),
  );
  return {
    pagina: indice >= 0 ? Math.floor(indice / 10) + 1 : null,
    campo:
      indice >= 0 || ["fecha_recepcion", "recibido_por"].includes(campo)
        ? campo
        : "lineas",
  };
}

export function resumenConciliacionEntrega(
  producto: ProductoEntrega,
  linea: LineaEditable,
  aportes: Record<string, AporteEditable>,
) {
  let recibido = BigInt(0),
    rechazado = BigInt(0),
    completos = 0,
    invalido = false;
  for (const aporte of producto.aportes) {
    const anotado = aportes[`${aporte.carga}-${aporte.lote}`];
    const peso = medirEntrega(anotado?.peso_recibido_kg ?? "");
    const rechazo = medirEntrega(anotado?.peso_rechazado_kg ?? "");
    if (peso !== null) recibido += peso;
    if (rechazo !== null) rechazado += rechazo;
    if (peso !== null && rechazo !== null && rechazo <= peso) completos++;
    if (
      (anotado?.peso_recibido_kg.trim() && peso === null) ||
      (anotado?.peso_rechazado_kg.trim() && rechazo === null) ||
      (peso !== null && rechazo !== null && rechazo > peso)
    )
      invalido = true;
  }
  const objetivoRecibido = medirEntrega(linea.peso_recibido_kg);
  const objetivoRechazado = medirEntrega(linea.peso_rechazado_kg);
  return {
    completos,
    total: producto.aportes.length,
    invalido,
    recibido: compactarCantidadPreparacion(deMiles(recibido)),
    rechazado: compactarCantidadPreparacion(deMiles(rechazado)),
    pendienteRecibido:
      objetivoRecibido === null
        ? null
        : compactarCantidadPreparacion(deMiles(objetivoRecibido - recibido)),
    pendienteRechazado:
      objetivoRechazado === null
        ? null
        : compactarCantidadPreparacion(deMiles(objetivoRechazado - rechazado)),
    coincide:
      !invalido &&
      producto.aportes.length > 0 &&
      completos === producto.aportes.length &&
      objetivoRecibido === recibido &&
      objetivoRechazado === rechazado,
  };
}

export function resumenPesosEntrega(
  hoja: HojaEntrega,
  lineas: Record<number, LineaEditable>,
) {
  const resumen: Record<
    "enviado" | "recibido" | "rechazado" | "aceptado",
    bigint | null
  > = {
    enviado: BigInt(0),
    recibido: BigInt(0),
    rechazado: BigInt(0),
    aceptado: BigInt(0),
  };
  for (const producto of hoja.origen.productos) {
    const fila = lineas[producto.producto] ?? lineaVacia();
    const valores = {
      enviado:
        producto.peso_kg === null ? null : medirEntrega(producto.peso_kg),
      recibido: medirEntrega(fila.peso_recibido_kg),
      rechazado: medirEntrega(fila.peso_rechazado_kg),
      aceptado:
        pesoAceptado(fila) === null ? null : medirEntrega(pesoAceptado(fila)!),
    };
    for (const campo of Object.keys(resumen) as (keyof typeof resumen)[])
      resumen[campo] =
        resumen[campo] === null || valores[campo] === null
          ? null
          : resumen[campo]! + valores[campo]!;
  }
  return Object.fromEntries(
    Object.entries(resumen).map(([clave, valor]) => [
      clave,
      valor === null ? null : compactarCantidadPreparacion(deMiles(valor)),
    ]),
  ) as Record<keyof typeof resumen, string | null>;
}
