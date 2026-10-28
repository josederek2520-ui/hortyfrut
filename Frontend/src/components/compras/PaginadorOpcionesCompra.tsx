"use client";
import { useTranslations } from "next-intl";
import {
  ChevronLeft as IconoAnterior,
  ChevronRight as IconoSiguiente,
} from "lucide-react";

export default function PaginadorOpcionesCompra({
  pagina,
  total,
  ocupado,
  alCambiar,
}: {
  pagina: number;
  total: number;
  ocupado: boolean;
  alCambiar: (pagina: number) => void;
}) {
  const t = useTranslations("compras");
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-800">
      <p
        role="status"
        className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400"
      >
        {t("opcionesCantidad", {
          desde: total ? (pagina - 1) * 10 + 1 : 0,
          hasta: Math.min(pagina * 10, total),
          total,
        })}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("anterior")}
          disabled={ocupado || pagina <= 1}
          onClick={() => alCambiar(pagina - 1)}
          className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <IconoAnterior className="size-4 rtl:rotate-180" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t("siguiente")}
          disabled={ocupado || pagina * 10 >= total}
          onClick={() => alCambiar(pagina + 1)}
          className="flex size-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <IconoSiguiente
            className="size-4 rtl:rotate-180"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
