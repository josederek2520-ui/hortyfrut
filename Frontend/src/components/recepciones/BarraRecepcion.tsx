"use client";
import { useTranslations } from "next-intl";
import { Save as IconoGuardar, ArrowRight as IconoRevisar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { clasePanel } from "@/components/compras/tipos";

export default function BarraRecepcion({
  cantidad,
  almacen,
  ocupado,
  conflicto,
  puedeGuardar,
  puedeConfirmar,
  alSalir,
  alRevisar,
}: {
  cantidad: number;
  almacen?: string;
  ocupado: boolean;
  conflicto: boolean;
  puedeGuardar: boolean;
  puedeConfirmar: boolean;
  alSalir: () => void;
  alRevisar: () => void;
}) {
  const t = useTranslations("recepciones");
  return (
    <div
      className={`${clasePanel} sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 p-4 shadow-theme-md sm:bottom-4 sm:px-5`}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("lineasAnotadas", { cantidad })}
        </p>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {almacen || t("seleccionAlmacen")} · {t("sinEntradaHastaConfirmar")}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          disabled={ocupado}
          onClick={alSalir}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-gray-400"
        >
          {t("salir")}
        </button>
        {puedeGuardar && (
          <Button
            type="submit"
            size="sm"
            variant={puedeConfirmar ? "outline" : "primary"}
            disabled={ocupado || conflicto}
            startIcon={<IconoGuardar className="size-4" />}
          >
            {t(ocupado ? "guardando" : "guardarBorrador")}
          </Button>
        )}
        {puedeConfirmar && (
          <Button
            size="sm"
            disabled={ocupado || conflicto}
            onClick={alRevisar}
            endIcon={<IconoRevisar className="size-4 rtl:rotate-180" />}
          >
            {t(ocupado ? "guardando" : "revisarIngreso")}
          </Button>
        )}
      </div>
    </div>
  );
}
