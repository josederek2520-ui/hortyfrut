"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, RefreshCw, Route } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { clasePanel } from "@/components/logistica/tipos";
import type { DetalleDespacho } from "./tipos";
import type { DocumentoRuta } from "./tiposRuta";
import SeguimientoEnVivoDespacho from "./SeguimientoEnVivoDespacho";

export default function RutaDespacho({
  despacho,
  alError,
  alActualizar,
  supervisar = false,
}: {
  despacho: DetalleDespacho;
  alError: (error: unknown) => void;
  alActualizar?: (datos: DetalleDespacho) => void;
  supervisar?: boolean;
}) {
  const t = useTranslations("rutas"),
    idioma = useLocale();
  const clave = `${despacho.id}:${despacho.version}`;
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: DocumentoRuta;
  } | null>(null);
  const [revision, establecerRevision] = useState(0);
  const [error, establecerError] = useState(false);
  const visible =
    !!despacho.enviado_en ||
    despacho.estado === "en_ruta" ||
    despacho.estado === "finalizado";
  useEffect(() => {
    if (!visible) return;
    const controlador = new AbortController();
    void api<DocumentoRuta>(`despachos/${despacho.id}/ruta/`, {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted) {
          establecerRespuesta({ clave, datos });
          establecerError(false);
        }
      })
      .catch((problema) => {
        if (!controlador.signal.aborted) {
          if (problema instanceof ErrorApi && problema.status === 409) {
            establecerRevision((valor) => valor + 1);
            return;
          }
          establecerError(true);
          alError(problema);
        }
      });
    return () => controlador.abort();
  }, [despacho.id, clave, revision, visible, alError]);
  const datos =
      respuesta?.datos.despacho === despacho.id ? respuesta.datos : null,
    plan = datos?.plan;
  useEffect(() => {
    if (
      !["pendiente", "calculando"].includes(
        datos?.optimizacion?.estado ?? "",
      ) ||
      error
    )
      return;
    const temporizador = setTimeout(
      () => establecerRevision((valor) => valor + 1),
      2000,
    );
    return () => clearTimeout(temporizador);
  }, [datos, error]);
  if (!visible) return null;
  return (
    <section className={`${clasePanel} space-y-3 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Route className="size-4 text-brand-600 dark:text-brand-300" />
            {t("tituloChofer")}
          </h2>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {error
              ? t("errorConsulta")
              : ["pendiente", "calculando"].includes(
                    datos?.optimizacion?.estado ?? "",
                  )
                ? t("estados.calculando")
                : datos
                  ? t(plan ? `estados.${datos.estado}` : "loPreparaChofer")
                  : t("cargando")}
          </p>
          {plan && datos?.estado !== "obsoleta" && (
            <span className="text-theme-xs text-gray-600 tabular-nums dark:text-gray-300">
              {new Intl.NumberFormat(idioma, {
                maximumFractionDigits: 1,
              }).format(Number(plan.distancia_m) / 1000)}{" "}
              km · {Math.ceil(Number(plan.duracion_s) / 60)} min
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!supervisar && (
            <Link
              href={`/seguimiento-camiones?viaje=${despacho.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              {t("abrirSeguimiento")}
              <ArrowUpRight className="size-4" />
            </Link>
          )}
          <button
            type="button"
            aria-label={t("actualizar")}
            onClick={() => establecerRevision((valor) => valor + 1)}
            className="inline-flex size-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>
      {!!plan?.optimizacion &&
        datos?.estado !== "obsoleta" &&
        !["pendiente", "calculando"].includes(
          datos?.optimizacion?.estado ?? "",
        ) && (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {Number(plan.optimizacion.mejora_s) > 0
              ? t("mejoraOptimizacion", {
                  minutos: new Intl.NumberFormat(idioma, {
                    maximumFractionDigits: 1,
                  }).format(Number(plan.optimizacion.mejora_s) / 60),
                  porcentaje: new Intl.NumberFormat(idioma, {
                    maximumFractionDigits: 1,
                  }).format(Number(plan.optimizacion.mejora_porcentaje)),
                })
              : t("ordenActualConservado")}
          </p>
        )}
      {datos?.optimizacion?.estado === "error" && (
        <p
          role="status"
          className="text-theme-xs text-gray-500 dark:text-gray-400"
        >
          {t("errorOptimizacion")}
        </p>
      )}
      {supervisar && datos && (
        <SeguimientoEnVivoDespacho
          documento={datos}
          despacho={despacho}
          alActualizar={alActualizar}
          alError={alError}
        />
      )}
      {supervisar && !datos && (
        <div
          role="status"
          className="flex min-h-96 items-center justify-center rounded-2xl bg-gray-50 p-6 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300"
        >
          {t(error ? "errorConsulta" : "cargandoMapa")}
        </div>
      )}
    </section>
  );
}
