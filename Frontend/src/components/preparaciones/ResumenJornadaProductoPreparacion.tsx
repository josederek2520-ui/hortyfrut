"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2 as IconoCliente,
  CalendarDays as IconoFecha,
  Warehouse as IconoAlmacen,
} from "lucide-react";
import { mostrarFecha } from "@/components/compras/calculos";
import type { OpcionCompra } from "@/components/compras/tipos";

export default function ResumenJornadaProductoPreparacion({
  cliente,
  fecha,
  almacen,
  ocupado,
  alElegirAlmacen,
}: {
  cliente: string;
  fecha: string;
  almacen: OpcionCompra | null;
  ocupado: boolean;
  alElegirAlmacen: () => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  return (
    <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-3 text-theme-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
      <div className="flex min-w-0 items-center gap-2">
        <dt className="sr-only">{t("cliente")}</dt>
        <dd className="flex min-w-0 items-center gap-2 font-medium break-words">
          <IconoCliente
            className="size-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          {cliente}
        </dd>
      </div>
      <div className="flex items-center gap-2">
        <dt className="sr-only">{t("fechaPedidosCompacta")}</dt>
        <dd className="flex items-center gap-2">
          <IconoFecha
            className="size-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          {mostrarFecha(fecha, idioma)}
        </dd>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <dt className="sr-only">{t("almacen")}</dt>
        <dd className="flex min-w-0 items-center gap-2 break-words">
          <IconoAlmacen
            className="size-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          {almacen ? (
            almacen.nombre
          ) : (
            <button
              type="button"
              disabled={ocupado}
              onClick={alElegirAlmacen}
              className="min-h-11 rounded-lg font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-brand-300"
            >
              {t("seleccionarAlmacen")}
            </button>
          )}
        </dd>
      </div>
    </dl>
  );
}
