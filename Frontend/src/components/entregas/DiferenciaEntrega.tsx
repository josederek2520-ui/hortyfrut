"use client";
import { useLocale, useTranslations } from "next-intl";
import { mostrarMedicion } from "./calculosEntrega";

export default function DiferenciaEntrega({
  diferencia,
}: {
  diferencia: string | null;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  if (diferencia === null)
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {t("diferenciaPendiente")}
      </span>
    );
  const coincide = diferencia === "0";
  const sobra = diferencia.startsWith("-");
  return (
    <span
      className={`text-xs font-medium ${coincide ? "text-gray-600 dark:text-gray-300" : "text-orange-800 dark:text-orange-200"}`}
    >
      {t(coincide ? "pesoCoincide" : sobra ? "sobranKilos" : "faltanKilos", {
        kilos: mostrarMedicion(
          sobra ? diferencia.slice(1) : diferencia,
          idioma,
        ),
      })}
    </span>
  );
}
