"use client";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
export default function PaginacionChofer({
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
  const t = useTranslations("chofer");
  if (total <= 10) return null;
  return (
    <nav
      className="flex items-center justify-between gap-3 py-4"
      aria-label={t("paginas")}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={ocupado || pagina <= 1}
        onClick={() => alCambiar(pagina - 1)}
      >
        {t("anterior")}
      </Button>
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {t("pagina", { pagina, total: Math.ceil(total / 10) })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={ocupado || pagina * 10 >= total}
        onClick={() => alCambiar(pagina + 1)}
      >
        {t("siguiente")}
      </Button>
    </nav>
  );
}
