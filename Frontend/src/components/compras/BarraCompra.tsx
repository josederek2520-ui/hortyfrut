"use client";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight as IconoRevisar, Save as IconoGuardar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { clasePanel, type LineaFormularioCompra } from "./tipos";
import { mostrarCentavos, totalCentavos } from "./calculos";

export default function BarraCompra({
  lineas,
  guardando,
  conflicto,
  puedeGuardar,
  puedeRegistrar,
  alSalir,
  alRevisar,
}: {
  lineas: LineaFormularioCompra[];
  guardando: boolean;
  conflicto: boolean;
  puedeGuardar: boolean;
  puedeRegistrar: boolean;
  alSalir: () => void;
  alRevisar: () => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  const productos = new Set(lineas.map((linea) => linea.producto.id)).size;
  const proveedores = new Set(
    lineas.flatMap((linea) => (linea.proveedor ? [linea.proveedor.id] : [])),
  ).size;
  return (
    <div
      className={`${clasePanel} sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 shadow-theme-md sm:bottom-4 sm:px-5`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <div aria-live="polite" aria-atomic="true">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("totalCompra")}
          </p>
          <p className="text-xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {mostrarCentavos(totalCentavos(lineas), idioma)}
          </p>
        </div>
        <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("resumenHoja", { productos, proveedores })}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          disabled={guardando}
          onClick={alSalir}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-500 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-gray-400 dark:hover:text-white"
        >
          {t("cancelarEdicion")}
        </button>
        {puedeGuardar && (
          <Button
            type="submit"
            size="sm"
            variant={puedeRegistrar ? "outline" : "primary"}
            disabled={guardando || conflicto}
            startIcon={<IconoGuardar className="size-4" />}
          >
            {t(guardando ? "guardando" : "guardarBorrador")}
          </Button>
        )}
        {puedeRegistrar && (
          <Button
            size="sm"
            disabled={guardando || conflicto}
            onClick={alRevisar}
            endIcon={<IconoRevisar className="size-4 rtl:rotate-180" />}
          >
            {t(guardando ? "guardando" : "revisarYRegistrar")}
          </Button>
        )}
      </div>
    </div>
  );
}
