"use client";
import { useLocale, useTranslations } from "next-intl";
import { RotateCw as IconoReintentar } from "lucide-react";
import { mostrarFecha } from "./calculos";
import type { NecesidadProducto } from "./tipos";
import CantidadesSolicitadasCompra from "./CantidadesSolicitadasCompra";

export default function ReferenciaPedidoProductoCompra({
  fecha,
  necesidad,
  cargando,
  fallo,
  alReintentar,
}: {
  fecha: string;
  necesidad?: NecesidadProducto;
  cargando: boolean;
  fallo: boolean;
  alReintentar: () => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  if (!fecha)
    return (
      <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
        {t("elegirFechaPedidos")}
      </p>
    );
  if (cargando)
    return (
      <p
        role="status"
        className="flex min-h-9 items-center text-theme-xs text-gray-500 dark:text-gray-400"
      >
        {t("cargando")}
      </p>
    );
  if (fallo)
    return (
      <button
        type="button"
        onClick={alReintentar}
        title={t("errorReferenciaProducto")}
        aria-label={`${t("errorReferenciaProducto")}. ${t("reintentar")}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-theme-xs text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 dark:text-error-400"
      >
        <IconoReintentar className="size-3.5" aria-hidden="true" />
        {t("reintentar")}
      </button>
    );
  return (
    <p
      className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs leading-5"
      title={t("solicitadoFechaAgregar", {
        fecha: mostrarFecha(fecha, idioma),
      })}
    >
      <span className="text-gray-500 dark:text-gray-400">
        {t("solicitadoAgregar")}:
      </span>
      {necesidad && (necesidad.cajas > 0 || necesidad.unidades > 0) ? (
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <CantidadesSolicitadasCompra
            cajas={necesidad.cajas}
            unidades={necesidad.unidades}
          />
        </span>
      ) : (
        <span className="text-gray-500 dark:text-gray-400">
          {t("sinPedidosProductoFecha")}
        </span>
      )}
    </p>
  );
}
