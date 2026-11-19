"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  History,
  Store,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import EstadoPrecio from "./EstadoPrecio";
import { panelPrecio, type AcuerdoPrecio } from "./tipos";

interface PropiedadesResumen {
  propuesta: AcuerdoPrecio;
  ocupado: boolean;
  historialBloqueado: boolean;
  alVolver: () => void;
  alHistorial: () => void;
  alEntregas?: () => void;
}

export default function ResumenPropuestaPrecio({
  propuesta,
  ocupado,
  historialBloqueado,
  alVolver,
  alHistorial,
  alEntregas,
}: PropiedadesResumen) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const porPedidos = propuesta.alcance === "periodo";
  const unDia = !!propuesta.desde && propuesta.desde === propuesta.hasta;
  const fecha = (valor: string) =>
    new Date(valor + "T12:00:00").toLocaleDateString(idioma, {
      day: "numeric",
      month: unDia ? "long" : "short",
      year: "numeric",
    });
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={alVolver}
            disabled={ocupado}
            aria-label={t("volver")}
            className="control-suave-hortyfru inline-flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t("detalle")}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{propuesta.codigo}</span>
              <span aria-hidden="true">·</span>
              <span>{t("version", { numero: propuesta.numero_version })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EstadoPrecio estado={propuesta.estado} />
          <Button
            variant="outline"
            size="sm"
            startIcon={<History className="size-4" />}
            onClick={alHistorial}
            disabled={historialBloqueado}
          >
            {t("historial")}
          </Button>
        </div>
      </header>
      <section className={panelPrecio + " overflow-hidden"}>
        <div className="grid items-start gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)]">
          <div className="flex min-w-0 items-start gap-3 py-1">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <Store className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("supermercado")}
              </p>
              <h2 className="mt-1 text-lg font-semibold break-words">
                {propuesta.cliente_nombre}
              </h2>
              {!!propuesta.referencia_propuesta && (
                <p className="mt-2 text-sm break-words text-gray-600 dark:text-gray-300">
                  <span className="font-medium">
                    {t("referenciaResumen")}:{" "}
                  </span>
                  {propuesta.referencia_propuesta}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-800 dark:bg-brand-500/10">
            <div className="flex items-start gap-3">
              {porPedidos ? (
                <CalendarDays
                  className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300"
                  aria-hidden="true"
                />
              ) : (
                <ClipboardList
                  className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-brand-800 dark:text-brand-200">
                  {t(porPedidos ? "preciosParaPedidos" : "preciosParaEntregas")}
                </h2>
                <p className="mt-1 text-lg leading-snug font-semibold text-gray-900 dark:text-white">
                  {porPedidos && propuesta.desde && propuesta.hasta ? (
                    unDia ? (
                      <time dateTime={propuesta.desde}>
                        {fecha(propuesta.desde)}
                      </time>
                    ) : (
                      <>
                        <time dateTime={propuesta.desde}>
                          {fecha(propuesta.desde)}
                        </time>
                        <span className="mx-1.5 text-gray-500 dark:text-gray-400">
                          {t("hastaPeriodo")}
                        </span>
                        <time dateTime={propuesta.hasta}>
                          {fecha(propuesta.hasta)}
                        </time>
                      </>
                    )
                  ) : porPedidos ? (
                    t("periodoSinDefinir")
                  ) : (
                    t("entregasSeleccionadas", {
                      total: propuesta.entregas.length,
                    })
                  )}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                  {t(
                    porPedidos
                      ? "fechaRequeridaResumen"
                      : "entregasResumenAyuda",
                  )}
                </p>
                {!porPedidos && alEntregas && (
                  <button
                    type="button"
                    onClick={alEntregas}
                    disabled={historialBloqueado}
                    className="mt-2 inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-brand-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                  >
                    {t("verEntregas")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {(propuesta.propuesto_en || propuesta.revisado_en) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 px-4 py-3 text-xs leading-5 text-gray-500 sm:px-5 dark:border-gray-800 dark:text-gray-400">
            {propuesta.propuesto_en && (
              <p>
                {t("propuestaRegistradaPor", {
                  nombre: propuesta.propuesto_por_nombre,
                  fecha: new Date(propuesta.propuesto_en).toLocaleString(
                    idioma,
                  ),
                })}
              </p>
            )}
            {propuesta.revisado_en && (
              <p>
                {t(
                  propuesta.estado === "aceptado"
                    ? "aceptadoPor"
                    : "rechazadoPor",
                  {
                    nombre: propuesta.revisado_por_nombre,
                    fecha: new Date(propuesta.revisado_en).toLocaleString(
                      idioma,
                    ),
                  },
                )}
              </p>
            )}
          </div>
        )}
      </section>
      {propuesta.anterior && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          <p className="font-medium">
            {t("correccionPrecios")} ·{" "}
            {t("version", { numero: propuesta.numero_version })}
          </p>
          <p className="mt-1">{propuesta.motivo_version}</p>
        </div>
      )}
      {propuesta.estado === "aceptado" && !propuesta.es_actual && (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {t("versionAnteriorAyuda")}
        </p>
      )}
      {propuesta.motivo_rechazo && (
        <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-300">
          <span className="font-medium">{t("motivoRechazo")}: </span>
          {propuesta.motivo_rechazo}
        </p>
      )}
    </>
  );
}
