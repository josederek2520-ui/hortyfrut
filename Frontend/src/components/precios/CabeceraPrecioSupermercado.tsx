"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, History, Store, RefreshCw } from "lucide-react";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import EstadoPrecio from "./EstadoPrecio";
import ResumenPropuestaPrecio from "./ResumenPropuestaPrecio";
import { panelPrecio } from "./tipos";
import type useGestionPrecio from "./useGestionPrecio";

export default function CabeceraPrecioSupermercado({
  gestion,
  editable,
  cargando,
  falloOrigen,
  alVolver,
  alCliente,
  alPeriodo,
  alActualizar,
  alReintentar,
  alHistorial,
}: {
  gestion: ReturnType<typeof useGestionPrecio>;
  editable: boolean;
  cargando: boolean;
  falloOrigen?: string;
  alVolver: () => void;
  alCliente: () => void;
  alPeriodo: (desde: string, hasta: string) => void;
  alActualizar: () => void;
  alReintentar: () => void;
  alHistorial: () => void;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const { documento, formulario, ocupado, incierto, errores } = gestion;
  const [variosDias, establecerVariosDias] = useState(
    !!documento && formulario.desde !== formulario.hasta,
  );
  const bloqueado = ocupado || incierto;
  const mostrarVariosDias = variosDias || formulario.desde !== formulario.hasta;
  const puedePeriodo = editable && !documento?.anterior;
  const fecha = (valor: string) =>
    valor ? new Date(valor + "T12:00:00").toLocaleDateString(idioma) : "—";
  if (documento && !editable)
    return (
      <ResumenPropuestaPrecio
        propuesta={documento}
        ocupado={ocupado}
        historialBloqueado={bloqueado || gestion.modificado}
        alVolver={alVolver}
        alHistorial={alHistorial}
      />
    );
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={alVolver}
            disabled={ocupado}
            aria-label={t("volver")}
            className="control-suave-hortyfru inline-flex size-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <h1 className="text-xl font-semibold sm:text-2xl">
            {t(documento ? "detalleSupermercado" : "proponerPrecios")}
          </h1>
          {documento ? (
            <>
              <span className="text-sm text-gray-500">{documento.codigo}</span>
              <EstadoPrecio estado={documento.estado} />
            </>
          ) : (
            <EstadoPrecio estado="borrador" />
          )}
        </div>
        {documento && (
          <Button
            variant="outline"
            startIcon={<History className="size-4" />}
            onClick={alHistorial}
            disabled={bloqueado || gestion.modificado}
          >
            {t("historial")}
          </Button>
        )}
      </header>
      <div className={panelPrecio + " space-y-4 p-4 sm:p-5"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("periodoPedidos")}</h2>
            {!documento && editable ? (
              <button
                type="button"
                data-campo-precio="cliente"
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                disabled={bloqueado || cargando}
                onClick={alCliente}
              >
                <Store className="size-4" aria-hidden="true" />
                {formulario.cliente?.nombre ?? t("elegirSupermercado")}
              </button>
            ) : (
              <p className="mt-1 font-medium">{formulario.cliente?.nombre}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("todasMisSucursales")}
            </p>
          </div>
          {puedePeriodo && (
            <div
              role="group"
              aria-label={t("periodoPedidos")}
              className="inline-flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
            >
              {[false, true].map((varios) => (
                <Button
                  key={String(varios)}
                  size="sm"
                  variant="outline"
                  aria-pressed={mostrarVariosDias === varios}
                  disabled={bloqueado || cargando}
                  onClick={() => {
                    establecerVariosDias(varios);
                    if (!varios) alPeriodo(formulario.desde, formulario.desde);
                  }}
                >
                  {t(varios ? "variosDias" : "unDia")}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          {(mostrarVariosDias
            ? (["desde", "hasta"] as const)
            : (["desde"] as const)
          ).map((campo) => (
            <div key={campo}>
              <label
                className="mb-1.5 block text-sm font-medium"
                htmlFor={puedePeriodo ? "precio-super-" + campo : undefined}
              >
                {t(
                  !mostrarVariosDias &&
                    campo === "desde" &&
                    formulario.desde === formulario.hasta
                    ? "fechaPedidos"
                    : campo,
                )}
              </label>
              {puedePeriodo ? (
                <CampoFecha
                  id={"precio-super-" + campo}
                  data-campo-precio={campo}
                  value={formulario[campo]}
                  min={
                    campo === "hasta"
                      ? formulario.desde || undefined
                      : undefined
                  }
                  disabled={bloqueado || cargando}
                  error={!!errores[campo]}
                  alCambiar={(valor) =>
                    alPeriodo(
                      campo === "desde" ? valor : formulario.desde,
                      !mostrarVariosDias
                        ? valor
                        : campo === "hasta"
                          ? valor
                          : formulario.hasta,
                    )
                  }
                />
              ) : (
                <p className="text-sm">{fecha(formulario[campo])}</p>
              )}
            </div>
          ))}
          {puedePeriodo && (
            <Button
              variant="outline"
              startIcon={
                <RefreshCw
                  className={`size-4 ${cargando ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
              }
              disabled={
                bloqueado ||
                cargando ||
                !formulario.cliente ||
                !formulario.desde ||
                !formulario.hasta ||
                formulario.desde > formulario.hasta
              }
              onClick={alActualizar}
            >
              {t("actualizarProductosPedidos")}
            </Button>
          )}
        </div>
        {cargando && (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {t("cargandoProductosPedidos")}
          </p>
        )}
        {falloOrigen && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-950 dark:text-error-200"
          >
            <p>{t(falloOrigen)}</p>
            <Button size="sm" variant="outline" onClick={alReintentar}>
              {t("reintentar")}
            </Button>
          </div>
        )}
        {documento?.motivo_version && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {documento.motivo_version}
          </p>
        )}
        {documento?.motivo_rechazo && (
          <p className="rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-950 dark:text-error-200">
            {t("motivoRechazo")}: {documento.motivo_rechazo}
          </p>
        )}
        {documento?.revisado_en && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t(
              documento.estado === "aceptado" ? "aceptadoPor" : "rechazadoPor",
              {
                nombre: documento.revisado_por_nombre,
                fecha: new Date(documento.revisado_en).toLocaleString(idioma),
              },
            )}
          </p>
        )}
      </div>
    </>
  );
}
