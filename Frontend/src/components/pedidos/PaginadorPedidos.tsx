"use client";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";

export default function PaginadorPedidos({
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
  const t = useTranslations("pedidos");
  const paginas = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
      <p
        aria-live="polite"
        className="text-sm text-gray-500 dark:text-gray-400"
      >
        {t("paginacion", { pagina, paginas, total })}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={ocupado || pagina <= 1}
          onClick={() => alCambiar(pagina - 1)}
        >
          {t("anterior")}
        </Button>
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
