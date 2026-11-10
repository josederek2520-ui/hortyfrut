import type { DatosTransporteDespacho } from "./TransporteFormularioDespacho";
export const nombresPasosDespacho = [
  "carga",
  "viajeRutaFormulario",
  "revision",
] as const;
export function erroresTransporteDespacho(
  datos: DatosTransporteDespacho,
  requerido: string,
  fechaInvalida: string,
) {
  const errores: Record<string, string[]> = {};
  for (const campo of ["almacen", "vehiculo", "chofer"] as const)
    if (!datos[campo]) errores[campo] = [requerido];
  if (!datos.fecha) errores.fecha_reparto = [requerido];
  else {
    const fecha = new Date(datos.fecha + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ||
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== datos.fecha
    )
      errores.fecha_reparto = [fechaInvalida];
  }
  return errores;
}
export function pasoErrorDespacho(
  errores: Record<string, string[]>,
  actual: number,
) {
  if (
    ["almacen", "fecha_reparto"].some((campo) => errores[campo]?.length) ||
    Object.keys(errores).some((campo) => /^asignaciones(?:_|$)/.test(campo))
  )
    return 0;
  if (
    ["vehiculo", "chofer", "observaciones", "capacidad"].some(
      (campo) => errores[campo]?.length,
    ) ||
    Object.keys(errores).some((campo) =>
      /^(cajillas|orden_sucursales)(?:_|$)/.test(campo),
    )
  )
    return 1;
  return actual;
}
export function puedeAbrirPasoDespacho(
  indice: number,
  visitado: number,
  origenValido: boolean,
  tieneCarga: boolean,
  revisionGuardada: boolean,
) {
  if (
    !Number.isInteger(indice) ||
    indice < 0 ||
    indice >= nombresPasosDespacho.length
  )
    return false;
  if (indice === 0) return true;
  return (
    indice <= visitado &&
    origenValido &&
    tieneCarga &&
    (indice !== 2 || revisionGuardada)
  );
}
