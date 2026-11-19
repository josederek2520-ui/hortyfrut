import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CalendarDays as IconoCalendario } from "lucide-react";
import CampoFecha from "@/components/form/CampoFecha";
import type { FormularioVenta } from "./tipos";

interface PropiedadesPeriodo {
  supermercado: ReactNode;
  desde: string;
  hasta: string;
  variosDias: boolean;
  bloqueado: boolean;
  alModo: (varios: boolean) => void;
  alCambiar: (cambios: Partial<FormularioVenta>) => void;
}

export default function PeriodoRecepcionVenta({
  supermercado,
  desde,
  hasta,
  variosDias,
  bloqueado,
  alModo,
  alCambiar,
}: PropiedadesPeriodo) {
  const t = useTranslations("ventas");
  return (
    <fieldset disabled={bloqueado} className="min-w-0">
      <legend className="sr-only">
        {t("supermercado")} · {t("fechaRecepcionEntregas")}
      </legend>
      <div className="flex flex-wrap items-center gap-3">
        {supermercado}
        <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
          <IconoCalendario
            className="size-4 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          {t("fechaRecepcionEntregas")}
        </span>
        <div
          role="group"
          aria-label={t("fechaRecepcionEntregas")}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {[false, true].map((varios) => (
            <button
              key={String(varios)}
              type="button"
              className="pestana-hortyfru inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              aria-pressed={variosDias === varios}
              disabled={bloqueado}
              onClick={() => alModo(varios)}
            >
              {t(varios ? "variosDias" : "unDia")}
            </button>
          ))}
        </div>
        <div
          className={
            "grid w-full gap-3 " +
            (variosDias
              ? "max-w-xl grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]"
              : "sm:max-w-52")
          }
        >
          <div className="flex min-w-0 items-center gap-2">
            <label
              className={
                variosDias
                  ? "shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400"
                  : "sr-only"
              }
              htmlFor="venta-desde"
            >
              {t(variosDias ? "inicioPeriodo" : "diaRecepcion")}
            </label>
            <div className="min-w-0 flex-1">
              <CampoFecha
                id="venta-desde"
                value={desde}
                max={variosDias ? hasta || undefined : undefined}
                disabled={bloqueado}
                required
                alCambiar={(valor) =>
                  alCambiar(
                    variosDias
                      ? { desde: valor }
                      : { desde: valor, hasta: valor },
                  )
                }
              />
            </div>
          </div>
          {variosDias && (
            <div className="flex min-w-0 items-center gap-2">
              <label
                className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400"
                htmlFor="venta-hasta"
              >
                {t("finPeriodo")}
              </label>
              <div className="min-w-0 flex-1">
                <CampoFecha
                  id="venta-hasta"
                  value={hasta}
                  min={desde || undefined}
                  disabled={bloqueado}
                  required
                  alCambiar={(valor) => alCambiar({ hasta: valor })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
        {t("fechaAyuda")}
      </p>
    </fieldset>
  );
}
