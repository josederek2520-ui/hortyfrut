import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";
export function fechaCorta(valor: string, idioma: string) {
  return new Intl.DateTimeFormat(idioma, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(valor + "T12:00:00Z"));
}
export function cantidad(valor: string | number, idioma: string) {
  return new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
    Number(valor),
  );
}
export function etiquetaEstado(estado: string): ClaveMensaje {
  return estado === "en_ruta"
    ? "enRuta"
    : estado === "finalizado"
      ? "finalizado"
      : estado === "cancelado"
        ? "cancelado"
        : "pendienteSalida";
}
