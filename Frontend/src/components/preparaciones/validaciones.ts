import type { FieldErrors as Errores } from "@/lib/form-validation";
import type { DocumentoEditable } from "./tipos";
import { aMiles, serializarDocumento } from "./calculos";

export function validarDocumento(
  documento: DocumentoEditable,
  mensajes: {
    cantidad: string;
    entero: string;
    origen: string;
    motivo: string;
    superaPendiente: (cantidad: number) => string;
  },
): Errores {
  const errores: Errores = {};
  const decimal = (valor: string) =>
    /^\d{1,11}(\.\d{1,3})?$/.test(valor || "0");
  documento.lineas.forEach((linea, indice) => {
    for (const campo of ["merma", "aprovechable"] as const)
      if (!decimal(linea[campo]))
        errores[`lineas_${indice}_${campo}`] = [mensajes.cantidad];
    if (
      (Number(linea.merma) > 0 || Number(linea.aprovechable) > 0) &&
      !linea.motivo.trim()
    )
      errores[`lineas_${indice}_motivo_separacion`] = [mensajes.motivo];
  });
  const carga = serializarDocumento(documento);
  carga.lineas.forEach((linea, indice) => {
    if (!decimal(linea.cantidad_utilizada))
      errores[`lineas_${indice}_cantidad_utilizada`] = [mensajes.cantidad];
  });
  Object.values(documento.asignaciones).forEach((asignacion, indice) => {
    if (!asignacion.detalle)
      errores[`asignaciones_${indice}_detalle_pedido`] = [mensajes.origen];
    if (
      !/^\d{1,6}$/.test(asignacion.cantidad || "0") ||
      Number(asignacion.cantidad) > 999999
    )
      errores[`asignaciones_${indice}_cantidad`] = [mensajes.entero];
    else if (Number(asignacion.cantidad) > asignacion.pendiente)
      errores[`asignaciones_${indice}_cantidad`] = [
        mensajes.superaPendiente(asignacion.pendiente),
      ];
    carga.asignaciones[indice].aportes.forEach((aporte, posicion) => {
      if (!decimal(aporte.cantidad))
        errores[`asignaciones_${indice}_aportes_${posicion}_cantidad`] = [
          mensajes.cantidad,
        ];
      if (
        aporte.peso_kg !== null &&
        (!decimal(aporte.peso_kg) || Number(aporte.peso_kg) <= 0)
      )
        errores[`asignaciones_${indice}_aportes_${posicion}_peso_kg`] = [
          mensajes.cantidad,
        ];
    });
  });
  documento.cajillas.forEach((fila, indice) => {
    if (
      !/^\d{1,10}$/.test(fila.cantidad) ||
      Number(fila.cantidad) < 1 ||
      Number(fila.cantidad) > 2147483647
    )
      errores[`cajillas_${indice}_cantidad`] = [mensajes.entero];
  });
  return errores;
}

export function validarConfirmacionPreparacion(
  documento: DocumentoEditable,
  mensajes: {
    sinAsignaciones: string;
    positiva: string;
    sinMedicion: string;
    peso: string;
    saldo: string;
    lote: string;
    sinUso?: string;
  },
): Errores {
  const errores: Errores = {};
  const carga = serializarDocumento(documento);
  if (!carga.asignaciones.length)
    errores.asignaciones = [mensajes.sinAsignaciones];
  Object.values(documento.asignaciones).forEach((asignacion, indice) => {
    const prefijo = `asignaciones_${indice}`;
    if (
      /^\d{1,6}$/.test(asignacion.cantidad || "0") &&
      Number(asignacion.cantidad || "0") <= 0
    )
      errores[`${prefijo}_cantidad`] = [mensajes.positiva];
    const aportes = carga.asignaciones[indice].aportes;
    if (!aportes.length) errores[`${prefijo}_aportes`] = [mensajes.sinMedicion];
    aportes.forEach((aporte, posicion) => {
      const linea = documento.lineas.find(
        (fila) => fila.lote.id === aporte.lote,
      );
      if (!linea || linea.lote.producto !== asignacion.producto)
        errores[`${prefijo}_aportes_${posicion}_lote`] = [mensajes.lote];
      if (
        /^\d{1,11}(\.\d{1,3})?$/.test(aporte.cantidad || "0") &&
        aMiles(aporte.cantidad) <= BigInt(0)
      )
        errores[`${prefijo}_aportes_${posicion}_cantidad`] = [
          mensajes.positiva,
        ];
      if (
        linea &&
        !linea.lote.es_kg &&
        (!aporte.peso_kg || aMiles(aporte.peso_kg) <= BigInt(0))
      )
        errores[`${prefijo}_aportes_${posicion}_peso_kg`] = [mensajes.peso];
    });
  });
  carga.lineas.forEach((linea, indice) => {
    const utilizada = aMiles(linea.cantidad_utilizada);
    const saldo = documento.lineas[indice].lote.saldo;
    if (utilizada <= BigInt(0))
      errores[`lineas_${indice}_cantidad_utilizada`] = [mensajes.sinUso || mensajes.positiva];
    if (saldo !== undefined && utilizada > aMiles(saldo))
      errores[`lineas_${indice}_cantidad_utilizada`] = [mensajes.saldo];
  });
  return errores;
}
