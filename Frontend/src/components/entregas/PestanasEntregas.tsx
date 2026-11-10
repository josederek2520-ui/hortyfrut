"use client";
import { useTranslations } from "next-intl";
import type { HojaEntrega } from "./tipos";

export default function PestanasEntregas({
  estado,
  resumen,
  alCambiar,
}: {
  estado: string;
  resumen?: Record<HojaEntrega["estado"], number>;
  alCambiar: (estado: string) => void;
}) {
  const t = useTranslations("entregas");
  const opciones = [
    "",
    "pendiente",
    "borrador",
    "revision",
    "confirmada",
  ] as const;
  return (
    <div
      role="group"
      aria-label={t("filtrarEtapa")}
      className="flex flex-wrap gap-1 border-b border-gray-100 p-3 dark:border-gray-800"
    >
      {opciones.map((valor) => {
        const cantidad = resumen
          ? valor
            ? resumen[valor]
            : Object.values(resumen).reduce(
                (total, actual) => total + actual,
                0,
              )
          : undefined;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={estado === valor}
            onClick={() => alCambiar(valor)}
            className="pestana-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium"
          >
            {t(valor ? `pestanas.${valor}` : "todos")}
            {cantidad !== undefined && (
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                {cantidad}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
