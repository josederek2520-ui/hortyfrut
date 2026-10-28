"use client";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";

export default function PaginadorCompras({
  pagina,
  total,
  alCambiar,
  ocupado = false,
}: {
  pagina: number;
  total: number;
  alCambiar: (pagina: number) => void;
  ocupado?: boolean;
}) {
  const t = useTranslations("compras");
  const paginas = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
      <p
        role="status"
        className="text-theme-xs text-gray-500 dark:text-gray-400"
      >
        {t("paginacion", {
          desde: total ? (pagina - 1) * 10 + 1 : 0,
          hasta: Math.min(pagina * 10, total),
          total,
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={ocupado || pagina <= 1}
          onClick={() => alCambiar(pagina - 1)}
        >
          {t("anterior")}
        </Button>
        <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
          {pagina} / {paginas}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={ocupado || pagina >= paginas}
          onClick={() => alCambiar(pagina + 1)}
        >
          {t("siguiente")}
        </Button>
      </div>
    </div>
  );
}
