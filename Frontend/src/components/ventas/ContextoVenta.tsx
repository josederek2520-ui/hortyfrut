"use client";
import { useLocale, useTranslations } from "next-intl";
import { Store as IconoCliente } from "lucide-react";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import { hoyBolivia, mostrarFechaVenta } from "./calculosVenta";
import type { FormularioVenta, Venta } from "./tipos";

export default function ContextoVenta({
  formulario,
  documento,
  revision,
  editable,
  bloqueado,
  alCambiar,
  alElegirCliente,
}: {
  formulario: FormularioVenta;
  documento: Venta | null;
  revision: boolean;
  editable: boolean;
  bloqueado: boolean;
  alCambiar: (cambios: Partial<FormularioVenta>) => void;
  alElegirCliente: () => void;
}) {
  const t = useTranslations("ventas"),
    idioma = useLocale();
  const fueraPeriodo = formulario.entregas.some(
    (fila) =>
      fila.fecha_recepcion < formulario.desde ||
      fila.fecha_recepcion > formulario.hasta,
  );
  return (
    <div className="border-b border-gray-100 p-5 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <IconoCliente className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("supermercado")}
            </p>
            <p className="mt-1 font-semibold">
              {formulario.cliente?.nombre ?? t("sinCliente")}
            </p>
            {formulario.cliente && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                NIT {formulario.cliente.nit}
              </p>
            )}
          </div>
        </div>
        {editable && !documento && !revision && (
          <Button
            variant="outline"
            disabled={bloqueado}
            onClick={alElegirCliente}
          >
            {t(formulario.cliente ? "cambiar" : "elegirSupermercado")}
          </Button>
        )}
      </div>
      {revision ? (
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {t("recepciones")}
            </dt>
            <dd className="mt-1">
              {mostrarFechaVenta(formulario.desde, idioma)} —{" "}
              {mostrarFechaVenta(formulario.hasta, idioma)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {t("vencimiento")}
            </dt>
            <dd className="mt-1">
              {formulario.vencimiento
                ? mostrarFechaVenta(formulario.vencimiento, idioma)
                : t("sinVencimiento")}
            </dd>
          </div>
          {documento?.fecha_emision && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("fechaEmision")}
              </dt>
              <dd className="mt-1">
                {mostrarFechaVenta(documento.fecha_emision, idioma)}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium"
                htmlFor="venta-desde"
              >
                {t("desde")}
              </label>
              <CampoFecha
                id="venta-desde"
                value={formulario.desde}
                max={formulario.hasta || undefined}
                disabled={bloqueado}
                required
                alCambiar={(desde) => alCambiar({ desde })}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-sm font-medium"
                htmlFor="venta-hasta"
              >
                {t("hasta")}
              </label>
              <CampoFecha
                id="venta-hasta"
                value={formulario.hasta}
                min={formulario.desde || undefined}
                disabled={bloqueado}
                required
                alCambiar={(hasta) => alCambiar({ hasta })}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-sm font-medium"
                htmlFor="venta-vencimiento"
              >
                {t("vencimientoOpcional")}
              </label>
              <CampoFecha
                id="venta-vencimiento"
                value={formulario.vencimiento}
                min={hoyBolivia()}
                disabled={bloqueado}
                alCambiar={(vencimiento) => alCambiar({ vencimiento })}
              />
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("fechaAyuda")}
          </p>
          {fueraPeriodo && (
            <p
              role="alert"
              className="mt-3 text-sm text-orange-700 dark:text-orange-300"
            >
              {t("fueraPeriodo")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
