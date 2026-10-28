"use client";
import { useLocale, useTranslations } from "next-intl";
import Label from "@/components/form/Label";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { clasePanel, type OpcionCompra } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";

export default function CabeceraTrabajoPreparacion({
  cliente,
  fecha,
  almacen,
  observaciones,
  ocupado,
  errores,
  alAlmacen,
  alObservaciones,
  alError,
}: {
  cliente: string;
  fecha: string;
  almacen: OpcionCompra | null;
  observaciones: string;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alAlmacen: (almacen: OpcionCompra | null) => void;
  alObservaciones: (valor: string) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  return (
    <section
      className={`${clasePanel} space-y-4 p-5 sm:p-6`}
      aria-labelledby="contexto-preparacion"
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,1fr)]">
        <div>
          <h2
            id="contexto-preparacion"
            className="text-theme-xs text-gray-500 dark:text-gray-400"
          >
            {t("cliente")}
          </h2>
          <p className="mt-2 text-base font-semibold text-gray-900 dark:text-white">
            {cliente}
          </p>
        </div>
        <div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("fechaEntregaTrabajo")}
          </p>
          <p className="mt-2 text-base font-semibold text-gray-900 dark:text-white">
            {mostrarFecha(fecha, idioma)}
          </p>
        </div>
        <DesplegableCompra
          tipo="general"
          ruta="preparaciones/almacenes/"
          etiqueta={t("almacen")}
          nombre="almacen"
          valor={almacen}
          alError={alError}
          deshabilitado={ocupado}
          error={errores.almacen?.join(" ")}
          alElegir={alAlmacen}
        />
      </div>
      <details
        className="border-t border-gray-100 pt-3 dark:border-gray-800"
        open={errores.observaciones?.length ? true : undefined}
      >
        <summary className="w-fit cursor-pointer rounded text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300">
          {t("notasOpcionalesTrabajo")}
          {observaciones.trim() ? " •" : ""}
        </summary>
        <div className="mt-3">
          <Label className="sr-only" htmlFor="observaciones-preparacion">
            {t("observaciones")}
          </Label>
          <textarea
            id="observaciones-preparacion"
            name="observaciones"
            rows={2}
            maxLength={1000}
            value={observaciones}
            disabled={ocupado}
            aria-invalid={!!errores.observaciones?.length}
            onChange={(evento) => alObservaciones(evento.target.value)}
            className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus-visible:ring-3 focus-visible:ring-brand-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {!!errores.observaciones?.length && (
            <p className="mt-1 text-theme-xs text-error-600 dark:text-error-400">
              {errores.observaciones.join(" ")}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
