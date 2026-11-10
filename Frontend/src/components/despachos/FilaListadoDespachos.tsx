"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Truck as IconoVehiculo,
  ArrowRight as IconoAbrir,
  MapPin as IconoDestino,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { claseEstadoDespacho, type Despacho } from "./tipos";
import { accionListadoDespacho } from "./listadoDespachos";
import estilos from "./estilosListado.module.css";

export const columnasListadoDespachos =
  "@4xl:grid-cols-[minmax(10rem,1.1fr)_minmax(10rem,1fr)_minmax(12rem,1.4fr)_7rem_8rem]";

export default function FilaListadoDespachos({
  despacho,
  puedeEditar,
}: {
  despacho: Despacho;
  puedeEditar: boolean;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  const accion = accionListadoDespacho(despacho, puedeEditar);
  const { completadas, paradas } = despacho.resumen;
  const proporcion = paradas
    ? Math.min(1, Math.max(0, completadas / paradas))
    : 0;
  const mostrarAvance =
    (despacho.estado === "en_ruta" || despacho.estado === "finalizado") &&
    paradas > 0;
  const fecha = new Intl.DateTimeFormat(idioma, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${despacho.fecha_reparto}T12:00:00Z`));
  return (
    <div
      role="row"
      className={`${estilos.fila} grid grid-cols-2 items-center gap-4 px-5 py-5 sm:px-6 ${columnasListadoDespachos}`}
    >
      <div
        role="cell"
        className="col-span-2 flex min-w-0 items-start gap-3 @4xl:col-span-1"
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${despacho.estado === "en_ruta" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
        >
          <IconoVehiculo className="size-5" aria-hidden="true" />
        </span>
        <Link
          href={`/despachos/${despacho.id}`}
          className="min-h-11 min-w-0 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {despacho.codigo}
          </h3>
          <p className="mt-1 text-theme-xs text-gray-600 dark:text-gray-300">
            <span className="sr-only">{t("fecha_reparto")}: </span>
            {fecha}
          </p>
          <p className="mt-1 text-theme-xs break-words text-gray-500 dark:text-gray-400">
            {despacho.almacen_nombre}
          </p>
        </Link>
      </div>
      <div role="cell" className="min-w-0">
        <span className="mb-1 block text-theme-xs text-gray-600 @4xl:sr-only dark:text-gray-300">
          {t("transporte")}
        </span>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {despacho.vehiculo_placa}
        </p>
        <p className="mt-1 text-sm break-words text-gray-600 dark:text-gray-300">
          {despacho.chofer_nombre}
        </p>
      </div>
      <div role="cell" className="min-w-0 space-y-2">
        <span className="block text-theme-xs text-gray-600 @4xl:sr-only dark:text-gray-300">
          {t("destinosListado")}
        </span>
        <p className="text-sm font-medium text-gray-900 tabular-nums dark:text-gray-100">
          {mostrarAvance
            ? t("descargasListado", { completadas, total: paradas })
            : t("cantidadDestinosListado", { cantidad: paradas })}
        </p>
        {mostrarAvance && (
          <div
            role="progressbar"
            aria-label={t("avanceDescargasListado", {
              codigo: despacho.codigo,
            })}
            aria-valuemin={0}
            aria-valuemax={paradas}
            aria-valuenow={completadas}
            aria-valuetext={t("descargasListado", {
              completadas,
              total: paradas,
            })}
            className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
          >
            <span
              className={`${estilos.progreso} block h-full w-full rounded-full ${despacho.estado === "finalizado" ? "bg-brand-500" : "bg-orange-500"}`}
              style={{ transform: `scaleX(${proporcion})` }}
            />
          </div>
        )}
        {despacho.siguiente_destino && despacho.estado === "en_ruta" && (
          <p className="flex items-start gap-1.5 text-theme-xs leading-5 text-gray-600 dark:text-gray-300">
            <IconoDestino
              className="mt-0.5 size-3.5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <span>
              {t("siguienteDestinoListado", {
                cliente: despacho.siguiente_destino.cliente_nombre,
                sucursal: despacho.siguiente_destino.sucursal_nombre,
              })}
            </span>
          </p>
        )}
      </div>
      <div role="cell">
        <span className={claseEstadoDespacho(despacho.estado)}>
          {t(
            despacho.estado === "borrador" && despacho.enviado_en
              ? "pendienteSalida"
              : `estados.${despacho.estado}`,
          )}
        </span>
      </div>
      <div role="cell" className="flex justify-end @4xl:justify-start">
        <Link
          href={accion.ruta}
          aria-label={t(accion.descripcion, { codigo: despacho.codigo })}
          className={`${estilos.pulsable} boton-secundario-hortyfru inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-theme-xs font-medium text-gray-800 ring-1 ring-gray-200 ring-inset focus-visible:ring-3 focus-visible:ring-brand-400 dark:text-gray-100 dark:ring-gray-700`}
        >
          {t(accion.etiqueta)}
          <IconoAbrir
            className="size-4 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
        </Link>
      </div>
    </div>
  );
}
