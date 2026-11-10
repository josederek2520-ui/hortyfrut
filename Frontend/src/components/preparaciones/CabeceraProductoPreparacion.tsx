"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  ChevronLeft as IconoAnterior,
  ChevronRight as IconoSiguiente,
} from "lucide-react";
import ImagenProducto from "@/components/productos/ImagenProducto";
import { mostrarFecha } from "@/components/compras/calculos";
import type { OpcionCompra } from "@/components/compras/tipos";
import type { ProductoPreparacion } from "./tipos";
import type { ConsultaProductosTrabajoPreparacion } from "./useProductosTrabajoPreparacion";
export default function CabeceraProductoPreparacion({
  producto,
  modelo,
  ocupado,
  alVolver,
  cliente,
  fecha,
  almacen,
  alElegirAlmacen,
}: {
  producto: ProductoPreparacion;
  modelo: ConsultaProductosTrabajoPreparacion;
  ocupado: boolean;
  alVolver: () => void;
  cliente: string;
  fecha: string;
  almacen: OpcionCompra | null;
  alElegirAlmacen: () => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const bloqueado =
    ocupado || modelo.cargando || modelo.navegando || modelo.fallo;
  return (
    <header className="min-w-0 shrink-0 border-b border-gray-100 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          disabled={ocupado}
          onClick={alVolver}
          aria-label={t("volverProductosTrabajo")}
          title={t("volverProductosTrabajo")}
          className="control-suave-hortyfru flex size-11 shrink-0 items-center justify-center rounded-xl text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:text-brand-300"
        >
          <IconoVolver className="size-5 rtl:rotate-180" aria-hidden="true" />
        </button>
        <div className="size-14 shrink-0 [&_img]:object-contain">
          <ImagenProducto
            origen={producto.imagen || null}
            nombre={producto.nombre}
            grande
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="nombre-producto-preparacion"
            data-foco-inicial
            tabIndex={-1}
            className="rounded text-lg font-semibold tracking-tight break-words text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:text-xl dark:text-white"
          >
            {t("prepararProductoTrabajo", { producto: producto.nombre })}
          </h2>
        </div>
        <nav
          aria-label={t("navegarProductosTrabajo")}
          className="hidden shrink-0 items-center gap-1 sm:flex"
        >
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:text-gray-300"
            disabled={bloqueado || !modelo.puedeAnterior}
            onClick={() => modelo.mover(-1)}
            aria-label={t("productoAnteriorTrabajo")}
          >
            <IconoAnterior
              className="size-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:text-gray-300"
            disabled={bloqueado || !modelo.puedeSiguiente}
            onClick={() => modelo.mover(1)}
            aria-label={t("productoSiguienteTrabajo")}
          >
            <IconoSiguiente
              className="size-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </button>
        </nav>
      </div>
      <p className="mt-2 text-theme-xs break-words text-gray-600 dark:text-gray-300">
        {cliente} · {mostrarFecha(fecha, idioma)} ·{" "}
        {almacen?.nombre || t("seleccionarAlmacen")}
      </p>
      {!almacen && (
        <button
          type="button"
          onClick={alElegirAlmacen}
          disabled={ocupado}
          className="mt-2 min-h-11 rounded-lg text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
        >
          {t("seleccionarAlmacen")}
        </button>
      )}
      {modelo.navegando && (
        <p role="status" className="mt-2 text-theme-xs text-gray-500">
          {t("cargando")}
        </p>
      )}
      {modelo.fallo && (
        <button
          type="button"
          onClick={modelo.recargar}
          className="mt-2 min-h-11 rounded-lg text-sm text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {t("errorNavegarProductoTrabajo")} · {t("recargar")}
        </button>
      )}
    </header>
  );
}
