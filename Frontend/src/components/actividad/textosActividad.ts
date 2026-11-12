interface TraductorActividad {
  (clave: string): string;
  has: (clave: string) => boolean;
}

export function nombreAccionActividad(
  modulo: string,
  accion: string,
  traducir: TraductorActividad,
): string {
  const clave = `accionesPorModulo.${modulo}.${accion}`;
  if (modulo && traducir.has(clave)) return traducir(clave);
  return traducir.has(`acciones.${accion}`)
    ? traducir(`acciones.${accion}`)
    : accion.replaceAll("_", " ");
}
