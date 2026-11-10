import {
  aMiles,
  compactarCantidadPreparacion,
  deMiles,
  disponibleLotePreparacion,
} from "./calculos";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
} from "./tipos";

const decimalValido = (valor: string | undefined): valor is string =>
  typeof valor === "string" && /^\d{1,11}(?:\.\d{1,3})?$/.test(valor);
const compacto = (valor: bigint) =>
  compactarCantidadPreparacion(deMiles(valor));
const consumosValidos = (documento: DocumentoEditable, lote: number) =>
  Object.values(documento.asignaciones).every((fila) =>
    decimalValido(fila.aportes[lote]?.cantidad || "0"),
  ) &&
  documento.lineas
    .filter((fila) => fila.lote.id === lote)
    .every(
      (fila) =>
        decimalValido(fila.merma || "0") &&
        decimalValido(fila.aprovechable || "0"),
    );

export class ErrorDistribucionLotes extends Error {
  constructor(
    public codigo:
      | "datos"
      | "incompatible"
      | "seleccionado"
      | "limite"
      | "sin_saldo"
      | "cambio"
      | "incompleto",
  ) {
    super(codigo);
  }
}

export function insuficienciaLotePreparacion(
  documento: DocumentoEditable,
  asignacion: AsignacionEditable,
  lote: LotePreparacion,
) {
  const cantidad = asignacion.aportes[lote.id]?.cantidad;
  if (!decimalValido(cantidad) || !decimalValido(lote.saldo)) return null;
  const disponible = disponibleLotePreparacion(documento, lote, asignacion);
  if (disponible === null || aMiles(cantidad) <= disponible) return null;
  const libre = disponible > BigInt(0) ? disponible : BigInt(0);
  return {
    objetivo: compacto(aMiles(cantidad)),
    disponible: compacto(libre),
    faltante: compacto(aMiles(cantidad) - libre),
    otrasCantidadesExcedidas: disponible < BigInt(0),
  };
}

export function huellaDistribucionLotes(
  documento: DocumentoEditable,
  asignacion: AsignacionEditable,
  contexto: string,
  almacen?: number,
) {
  return JSON.stringify([
    contexto,
    almacen,
    asignacion,
    documento.lineas,
    documento.asignaciones,
  ]);
}

export interface PropuestaDistribucionLotes {
  objetivo: string;
  faltante: string;
  filas: { lote: LotePreparacion; cantidad: string }[];
}

export function proponerDistribucionLotes(
  documento: DocumentoEditable,
  asignacion: AsignacionEditable,
  origen: LotePreparacion,
  adicionales: LotePreparacion[],
): PropuestaDistribucionLotes {
  const insuficiencia = insuficienciaLotePreparacion(
    documento,
    asignacion,
    origen,
  );
  if (!insuficiencia || insuficiencia.otrasCantidadesExcedidas)
    throw new ErrorDistribucionLotes("datos");
  if (!origen.es_kg || origen.producto !== asignacion.producto)
    throw new ErrorDistribucionLotes("incompatible");
  if (!consumosValidos(documento, origen.id))
    throw new ErrorDistribucionLotes("datos");
  if (Object.keys(asignacion.aportes).length + adicionales.length > 20)
    throw new ErrorDistribucionLotes("limite");
  const existentes = new Set(Object.keys(asignacion.aportes).map(Number));
  const nuevos = new Set<number>();
  const filas = [{ lote: origen, cantidad: insuficiencia.disponible }];
  let faltante = aMiles(insuficiencia.faltante);
  for (const lote of adicionales) {
    if (existentes.has(lote.id) || nuevos.has(lote.id))
      throw new ErrorDistribucionLotes("seleccionado");
    nuevos.add(lote.id);
    if (!consumosValidos(documento, lote.id))
      throw new ErrorDistribucionLotes("datos");
    if (
      !Number.isSafeInteger(lote.id) ||
      lote.id < 1 ||
      lote.producto !== origen.producto ||
      lote.unidad !== origen.unidad ||
      !lote.es_kg
    )
      throw new ErrorDistribucionLotes("incompatible");
    if (
      !decimalValido(lote.saldo) ||
      (lote.disponible_preparacion !== undefined &&
        !decimalValido(lote.disponible_preparacion))
    )
      throw new ErrorDistribucionLotes("datos");
    let disponible = disponibleLotePreparacion(documento, lote);
    if (disponible === null) throw new ErrorDistribucionLotes("datos");
    if (
      lote.disponible_preparacion !== undefined &&
      aMiles(lote.disponible_preparacion) < disponible
    )
      disponible = aMiles(lote.disponible_preparacion);
    if (disponible <= BigInt(0) || faltante <= BigInt(0))
      throw new ErrorDistribucionLotes("sin_saldo");
    const cantidad = disponible < faltante ? disponible : faltante;
    filas.push({ lote, cantidad: compacto(cantidad) });
    faltante -= cantidad;
  }
  const nuevasLineas = adicionales.filter(
    (lote) => !documento.lineas.some((fila) => fila.lote.id === lote.id),
  );
  const fuente = documento.lineas.find((fila) => fila.lote.id === origen.id);
  const retirarOrigen =
    insuficiencia.disponible === "0" &&
    !!fuente &&
    !aMiles(fuente.merma) &&
    !aMiles(fuente.aprovechable) &&
    !fuente.motivo.trim() &&
    !Object.values(documento.asignaciones).some(
      (fila) => fila.clave !== asignacion.clave && origen.id in fila.aportes,
    );
  if (
    documento.lineas.length + nuevasLineas.length - (retirarOrigen ? 1 : 0) >
    500
  )
    throw new ErrorDistribucionLotes("limite");
  return {
    objetivo: insuficiencia.objetivo,
    faltante: compacto(faltante),
    filas,
  };
}

export function totalesKgAsignacion(
  documento: DocumentoEditable,
  asignacion: AsignacionEditable,
) {
  const totales = new Map<
    number,
    { unidad: number; abreviatura: string; cantidad: bigint }
  >();
  for (const [id, aporte] of Object.entries(asignacion.aportes)) {
    const lote = documento.lineas.find(
      (fila) => fila.lote.id === Number(id),
    )?.lote;
    if (!lote || !decimalValido(aporte.cantidad || "0")) return [];
    if (!lote.es_kg) continue;
    const anterior = totales.get(lote.unidad) ?? {
      unidad: lote.unidad,
      abreviatura: lote.unidad_abreviatura,
      cantidad: BigInt(0),
    };
    totales.set(lote.unidad, {
      ...anterior,
      cantidad: anterior.cantidad + aMiles(aporte.cantidad),
    });
  }
  return [...totales.values()]
    .filter((fila) => fila.cantidad > BigInt(0))
    .map((fila) => ({ ...fila, cantidad: compacto(fila.cantidad) }));
}

export function aplicarDistribucionLotes(
  documento: DocumentoEditable,
  asignacion: AsignacionEditable,
  origen: LotePreparacion,
  adicionales: LotePreparacion[],
  huella: string,
  contexto: string,
  almacen?: number,
): DocumentoEditable {
  if (
    !almacen ||
    huella !==
      huellaDistribucionLotes(documento, asignacion, contexto, almacen) ||
    !asignacion.disponible ||
    !asignacion.detalle ||
    !documento.asignaciones[asignacion.clave]
  )
    throw new ErrorDistribucionLotes("cambio");
  const propuesta = proponerDistribucionLotes(
    documento,
    asignacion,
    origen,
    adicionales,
  );
  if (aMiles(propuesta.faltante) > BigInt(0))
    throw new ErrorDistribucionLotes("incompleto");
  const aportes = { ...asignacion.aportes };
  propuesta.filas.forEach(({ lote, cantidad }) => {
    if (aMiles(cantidad) > BigInt(0))
      aportes[lote.id] = { cantidad, pesoKg: "" };
    else delete aportes[lote.id];
  });
  const asignaciones = {
    ...documento.asignaciones,
    [asignacion.clave]: { ...asignacion, aportes },
  };
  const lineas = documento.lineas.map((fila) => {
    const actualizado = adicionales.find((lote) => lote.id === fila.lote.id);
    return actualizado
      ? { ...fila, lote: { ...fila.lote, ...actualizado } }
      : fila;
  });
  adicionales.forEach((lote) => {
    if (!lineas.some((fila) => fila.lote.id === lote.id))
      lineas.push({
        lote: {
          ...lote,
          producto_imagen: asignacion.imagen ?? origen.producto_imagen,
          producto_categoria: asignacion.categoria ?? origen.producto_categoria,
        },
        merma: "",
        aprovechable: "",
        motivo: "",
      });
  });
  return {
    ...documento,
    asignaciones,
    lineas: lineas.filter(
      (fila) =>
        fila.lote.id !== origen.id ||
        Object.values(asignaciones).some(
          (asignada) => origen.id in asignada.aportes,
        ) ||
        aMiles(fila.merma) > BigInt(0) ||
        aMiles(fila.aprovechable) > BigInt(0) ||
        !!fila.motivo.trim(),
    ),
  };
}
