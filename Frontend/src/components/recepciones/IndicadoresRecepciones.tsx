"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Clock3 as IconoPendiente,
  CircleCheck as IconoConfirmada,
  CircleSlash as IconoCancelada,
  ArrowUpRight as IconoAbrir,
} from "lucide-react";

export interface ResumenEstadosRecepciones {
  total: number;
  borradores: number;
  confirmadas: number;
  canceladas: number;
}

const indicadores = [
  {
    estado: "borrador",
    clave: "borradores",
    ayuda: "ayudaIndicadorBorradores",
    Icono: IconoPendiente,
    tono: "bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-500/12 dark:text-orange-300 dark:ring-orange-500/20",
  },
  {
    estado: "confirmada",
    clave: "confirmadas",
    ayuda: "ayudaIndicadorConfirmadas",
    Icono: IconoConfirmada,
    tono: "bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-500/12 dark:text-brand-300 dark:ring-brand-500/20",
  },
  {
    estado: "cancelada",
    clave: "canceladas",
    ayuda: "ayudaIndicadorCanceladas",
    Icono: IconoCancelada,
    tono: "bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700",
  },
] as const;

export default function IndicadoresRecepciones({
  resumen,
  estado,
  cargando,
  alElegir,
}: {
  resumen?: ResumenEstadosRecepciones;
  estado: string;
  cargando: boolean;
  alElegir: (estado: string) => void;
}) {
  const t = useTranslations("recepciones");
  const idioma = useLocale();
  return (
    <div
      role="group"
      aria-label={t("filtrarPorIndicadores")}
      className="grid gap-3 sm:grid-cols-3"
    >
      {indicadores.map(({ estado: valor, clave, ayuda, Icono, tono }) => {
        const seleccionado = estado === valor;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={seleccionado}
            aria-controls="resultados-recepciones"
            onClick={() => alElegir(seleccionado ? "" : valor)}
            className="indicador-seleccionable-hortyfru group flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-4 text-start"
          >
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${tono}`}
            >
              <Icono className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                {t(clave)}
              </span>
              <span className="indicador-seleccionable-hortyfru__ayuda mt-1 block text-theme-xs leading-5">
                {t(ayuda)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-3xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
                {cargando || !resumen
                  ? "—"
                  : new Intl.NumberFormat(idioma).format(resumen[clave])}
              </span>
              <IconoAbrir
                className="indicador-seleccionable-hortyfru__acceso size-3.5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
