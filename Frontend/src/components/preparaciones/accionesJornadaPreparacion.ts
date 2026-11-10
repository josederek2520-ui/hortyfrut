import type {
  JornadaAgrupadaPreparacion,
  PermisosPreparaciones,
} from "./tipos";

export function accionJornadaPreparacion(
  grupo: JornadaAgrupadaPreparacion,
  permisos: PermisosPreparaciones,
) {
  if (
    grupo.borradores > 0 &&
    permisos.editar &&
    ["pendiente", "parcial"].includes(grupo.estado)
  ) {
    return grupo.borradores === 1 && grupo.borrador_id
      ? {
          tipo: "editar" as const,
          texto: "continuarGrupo",
          ruta: `/preparaciones/${grupo.borrador_id}/editar`,
        }
      : { tipo: "ver" as const, texto: "continuarGrupo" };
  }
  if (
    permisos.crear &&
    grupo.cliente_activo &&
    !grupo.borradores &&
    ["pendiente", "parcial"].includes(grupo.estado)
  )
    return { tipo: "preparar" as const, texto: "prepararGrupo" };
  return { tipo: "ver" as const, texto: "verGrupo" };
}

export function claseEstadoJornada(
  estado: JornadaAgrupadaPreparacion["estado"],
) {
  return estado === "preparado"
    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
    : estado === "parcial"
      ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}
