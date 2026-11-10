"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { clasePanel, type OpcionCompra } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import {
  Building2 as IconoCliente,
  CalendarDays as IconoFecha,
  Warehouse as IconoAlmacen,
  ChevronDown as IconoAbrir,
} from "lucide-react";
import estilos from "./estilosTrabajo.module.css";

export default function CabeceraTrabajoPreparacion({
  cliente,
  fecha,
  almacen,
  ocupado,
  errores,
  alAlmacen,
  alError,
  controlesJornada,
  resumenJornada,
  compacta = false,
  codigo,
}: {
  cliente: string;
  fecha: string;
  almacen: OpcionCompra | null;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alAlmacen: (almacen: OpcionCompra | null) => void;
  alError: (error: unknown) => void;
  controlesJornada?: ReactNode;
  resumenJornada?: ReactNode;
  compacta?: boolean;
  codigo?: string;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  return (
    <section
      className={compacta ? "min-w-0 px-1" : `${clasePanel} px-4 py-2 sm:px-5`}
      aria-labelledby="contexto-preparacion"
    >
      <details
        data-contexto-preparacion
        className={`${estilos.desplegable} group/contexto`}
        open={!almacen || errores.almacen?.length ? true : undefined}
      >
        <summary
          id="contexto-preparacion"
          className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
            {codigo && (
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {codigo}
              </span>
            )}
            <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <IconoCliente
                className="size-4 text-brand-600 dark:text-brand-300"
                aria-hidden="true"
              />
              {cliente}
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <IconoFecha className="size-4 text-gray-400" aria-hidden="true" />
              {mostrarFecha(fecha, idioma)}
            </span>
            <span className="flex items-center gap-2">
              <IconoAlmacen
                className="size-4 text-gray-400"
                aria-hidden="true"
              />
              {almacen?.nombre || t("seleccionarAlmacen")}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
            {t("cambiarContextoTrabajo")}
            <IconoAbrir
              className="size-4 transition-transform duration-200 group-open/contexto:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className={`${estilos.contenidoOpcional} pt-3 pb-2`}>
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,1fr)]">
            {controlesJornada || (
              <>
                <div>
                  <h2 className="text-theme-xs text-gray-500 dark:text-gray-400">
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
              </>
            )}
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
        </div>
      </details>
      {resumenJornada}
    </section>
  );
}
