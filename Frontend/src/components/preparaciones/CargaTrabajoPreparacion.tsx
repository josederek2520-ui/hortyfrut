"use client";
import { useTranslations } from "next-intl";

export default function CargaTrabajoPreparacion() {
  const t = useTranslations("preparaciones");
  return (
    <div role="status" className="space-y-4 p-5">
      <span className="sr-only">{t("cargando")}</span>
      {[0, 1, 2].map((fila) => (
        <div
          key={fila}
          aria-hidden="true"
          className="flex min-h-20 animate-pulse items-center gap-4 rounded-xl border border-gray-100 p-4 motion-reduce:animate-none dark:border-gray-800"
        >
          <span className="size-11 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            <span className="block h-2 w-16 rounded bg-gray-100 dark:bg-gray-800" />
          </span>
          <span className="h-8 w-20 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
