"use client";
import { useTranslations } from "next-intl";
import {
  Check as IconoCompletado,
  Boxes as IconoCarga,
  Truck as IconoTransporte,
  ClipboardCheck as IconoRevision,
} from "lucide-react";
import {
  nombresPasosDespacho,
  puedeAbrirPasoDespacho,
} from "./navegacionFormularioDespacho";
import estilos from "./estilosFormulario.module.css";

export default function PasosFormularioDespacho({
  paso,
  visitado,
  transporteValido,
  origenValido,
  tieneCarga,
  revisionGuardada,
  guardando,
  alElegir,
}: {
  paso: number;
  visitado: number;
  transporteValido: boolean;
  origenValido: boolean;
  tieneCarga: boolean;
  revisionGuardada: boolean;
  guardando: boolean;
  alElegir: (paso: number) => void;
}) {
  const t = useTranslations("despachos");
  const iconos = [IconoCarga, IconoTransporte, IconoRevision];
  const coloresActivos = [
    "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200",
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200",
    "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200",
  ];
  const completados = [
    visitado > 0 && origenValido && tieneCarga,
    visitado > 1 && transporteValido && tieneCarga && revisionGuardada,
    false,
  ];
  return (
    <nav
      aria-label={t("pasos")}
      className="border-b border-gray-100 p-2 sm:p-3 dark:border-gray-800"
    >
      <p className="sr-only">
        {t("pasoActualFormulario", {
          paso: paso + 1,
          total: 3,
          nombre: t(nombresPasosDespacho[paso]),
        })}
      </p>
      <ol className="grid grid-cols-3 gap-2">
        {nombresPasosDespacho.map((nombre, indice) => {
          const Icono = iconos[indice];
          return (
            <li key={nombre} className="min-w-0">
              <button
                type="button"
                aria-current={paso === indice ? "step" : undefined}
                aria-pressed={paso === indice}
                aria-controls="panel-paso-despacho"
                disabled={
                  guardando ||
                  !puedeAbrirPasoDespacho(
                    indice,
                    visitado,
                    origenValido,
                    tieneCarga,
                    revisionGuardada,
                  )
                }
                onClick={() => alElegir(indice)}
                className={`${estilos.paso} flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-theme-xs font-medium focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${paso === indice ? coloresActivos[indice] : completados[indice] ? "border-gray-200 bg-gray-50 text-gray-700 enabled:hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200 dark:enabled:hover:bg-gray-800" : "border-transparent text-gray-500 enabled:hover:bg-gray-100 dark:text-gray-400 dark:enabled:hover:bg-gray-800"}`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-theme-xs tabular-nums ${paso === indice ? "bg-white/75 dark:bg-white/10" : completados[indice] ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
                >
                  {completados[indice] && paso !== indice ? (
                    <>
                      <IconoCompletado className="size-4" aria-hidden="true" />
                      <span className="sr-only">
                        {t("pasoCompletadoFormulario")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Icono className="size-4" aria-hidden="true" />
                      <span className="sr-only">{indice + 1}</span>
                    </>
                  )}
                </span>
                {t(nombre)}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
