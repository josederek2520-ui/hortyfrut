export type Respaldo = {
  id: string;
  nombre: string;
  estado: "preparando" | "completado" | "fallido";
  creado_en: string;
  finalizado_en: string | null;
  responsable_nombre: string;
  tamano_bytes: number;
  error: string;
};

export type PaginaRespaldos = {
  count: number;
  results: Respaldo[];
  en_preparacion: boolean;
};

export function fechaRespaldo(valor: string, idioma: string) {
  return new Intl.DateTimeFormat(idioma, {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(valor));
}

export function tamanoRespaldo(valor: number, idioma: string) {
  if (!valor) return "—";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  const indice = Math.min(
    Math.floor(Math.log(valor) / Math.log(1024)),
    unidades.length - 1,
  );
  return `${new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 }).format(valor / 1024 ** indice)} ${unidades[indice]}`;
}
