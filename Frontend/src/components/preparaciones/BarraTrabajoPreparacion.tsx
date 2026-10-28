"use client";
import { useLocale, useTranslations } from "next-intl";
import { Save as IconoGuardar, ArrowRight as IconoRevisar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { clasePanel } from "@/components/compras/tipos";
import type { DocumentoEditable } from "./tipos";

export default function BarraTrabajoPreparacion({
  documento,
  guardando,
  conflicto,
  puedeGuardar,
  puedeConfirmar,
  alSalir,
  alRevisar,
}: {
  documento: DocumentoEditable;
  guardando: boolean;
  conflicto: boolean;
  puedeGuardar: boolean;
  puedeConfirmar: boolean;
  alSalir: () => void;
  alRevisar: () => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const asignaciones = Object.values(documento.asignaciones).filter(
    (fila) => Number(fila.cantidad) > 0,
  );
  const cajas = asignaciones
    .filter((fila) => fila.columna === "cajas")
    .reduce((total, fila) => total + Number(fila.cantidad), 0);
  const unidades = asignaciones
    .filter((fila) => fila.columna === "unidades")
    .reduce((total, fila) => total + Number(fila.cantidad), 0);
  const numero = (valor: number) => new Intl.NumberFormat(idioma).format(valor);
  return (
    <div
      className={`${clasePanel} sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-4 p-4 shadow-theme-md sm:bottom-4 sm:px-5`}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
          {t("resumenCantUniTrabajo", {
            cajas: numero(cajas),
            unidades: numero(unidades),
          })}
        </p>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {t("resumenProductosSucursalesTrabajo", {
            productos: new Set(asignaciones.map((fila) => fila.producto)).size,
            sucursales: new Set(asignaciones.map((fila) => fila.sucursal)).size,
          })}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          disabled={guardando}
          onClick={alSalir}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-gray-400"
        >
          {t("salirTrabajo")}
        </button>
        {puedeGuardar && (
          <Button
            type="submit"
            size="sm"
            variant={puedeConfirmar ? "outline" : "primary"}
            disabled={guardando || conflicto}
            startIcon={<IconoGuardar className="size-4" />}
          >
            {t(guardando ? "guardando" : "guardarBorrador")}
          </Button>
        )}
        {puedeConfirmar && (
          <Button
            size="sm"
            disabled={guardando || conflicto}
            onClick={alRevisar}
            endIcon={<IconoRevisar className="size-4 rtl:rotate-180" />}
          >
            {t(guardando ? "guardando" : "revisarTrabajo")}
          </Button>
        )}
      </div>
    </div>
  );
}
