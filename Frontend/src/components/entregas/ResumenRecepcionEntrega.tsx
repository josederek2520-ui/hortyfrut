"use client";
import { useLocale, useTranslations } from "next-intl";
import { mostrarMedicion } from "./calculosEntrega";
import DiferenciaEntrega from "./DiferenciaEntrega";

export default function ResumenRecepcionEntrega({
  resumen,
  diferencia,
}: {
  resumen: Record<
    "enviado" | "recibido" | "rechazado" | "aceptado",
    string | null
  >;
  diferencia: string | null;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  return (
    <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 p-5 text-sm dark:border-gray-800 dark:bg-gray-800/40">
      <h3 className="font-semibold">{t("totalPeso")}</h3>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(["enviado", "recibido", "rechazado", "aceptado"] as const).map(
          (campo) => (
            <div key={campo}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t(campo)}
              </dt>
              <dd
                className={
                  "mt-1 font-semibold tabular-nums " +
                  (campo === "aceptado"
                    ? "text-brand-700 dark:text-brand-300"
                    : "")
                }
              >
                {mostrarMedicion(resumen[campo], idioma)} kg
              </dd>
            </div>
          ),
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 pt-3 dark:border-gray-700">
        <DiferenciaEntrega diferencia={diferencia} />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("ayudaDiferencia")}
        </p>
      </div>
    </div>
  );
}
