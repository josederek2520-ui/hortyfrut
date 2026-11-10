"use client";
import { useLocale, useTranslations } from "next-intl";
import { Navigation, LoaderCircle, RefreshCw } from "lucide-react";
import type { EstadoGuia } from "@/lib/chofer/modulos/recorrido/dominio/GuiaChofer";

export default function EstadoGuiaChofer({
  estado,
  alReintentar,
}: {
  estado: EstadoGuia;
  alReintentar: () => void;
}) {
  const t = useTranslations("chofer.guia"),
    idioma = useLocale();
  if (estado.fase === "inactiva") return null;
  const Icono = estado.fase === "calculando" ? LoaderCircle : Navigation;
  return (
    <div className="mt-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-100">
      <div className="flex items-center gap-2">
        <Icono
          aria-hidden="true"
          className={
            "size-4 shrink-0 " +
            (estado.fase === "calculando"
              ? "animate-spin motion-reduce:animate-none"
              : "")
          }
        />
        <p role="status" className="text-xs font-medium">
          {t(estado.fase)}
        </p>
        {estado.fase === "sin_guia" && (
          <button
            type="button"
            className="ms-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500"
            aria-label={t("reintentar")}
            disabled={!!estado.esperaS}
            onClick={alReintentar}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      {estado.fase === "sin_guia" && !!estado.esperaS && (
        <p className="mt-1 ps-6 text-xs">
          {t("espera", { segundos: estado.esperaS })}
        </p>
      )}
      {estado.distanciaM !== null && (
        <p className="mt-1 ps-6 text-xs tabular-nums">
          {t("restante", {
            distancia: new Intl.NumberFormat(idioma, {
              maximumFractionDigits: estado.distanciaM >= 1000 ? 1 : 0,
            }).format(
              estado.distanciaM >= 1000
                ? estado.distanciaM / 1000
                : estado.distanciaM,
            ),
            unidad: estado.distanciaM >= 1000 ? "km" : "m",
          })}
        </p>
      )}
    </div>
  );
}
