"use client";
import { useTranslations } from "next-intl";
import { Save as IconoGuardar, ArrowRight as IconoRevisar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { clasePanel } from "@/components/compras/tipos";
import type { DocumentoEditable, ProductoPreparacion } from "./tipos";
import estilos from "./estilosTrabajo.module.css";
import EstadoBorradorPreparacion, {
  type SituacionBorradorPreparacion,
} from "./EstadoBorradorPreparacion";

export default function BarraTrabajoPreparacion({
  documento,
  guardando,
  conflicto,
  puedeGuardar,
  puedeConfirmar,
  alSalir,
  alRevisar,
  estado,
  situacion,
  producto = null,
  alVolverProductos,
  navegando = false,
  compacta = false,
  ayudaEstado,
}: {
  documento: DocumentoEditable;
  guardando: boolean;
  conflicto: boolean;
  puedeGuardar: boolean;
  puedeConfirmar: boolean;
  alSalir: () => void;
  alRevisar: () => void;
  estado: string;
  situacion: SituacionBorradorPreparacion;
  producto?: ProductoPreparacion | null;
  alVolverProductos: () => void;
  navegando?: boolean;
  compacta?: boolean;
  ayudaEstado?: string;
}) {
  const t = useTranslations("preparaciones");
  const asignaciones = Object.values(documento.asignaciones).filter(
    (fila) =>
      Number(fila.cantidad) > 0 && (!producto || fila.producto === producto.id),
  );
  const cajas = asignaciones
    .filter((fila) => fila.columna === "cajas")
    .reduce((total, fila) => total + Number(fila.cantidad), 0);
  const unidades = asignaciones
    .filter((fila) => fila.columna === "unidades")
    .reduce((total, fila) => total + Number(fila.cantidad), 0);
  return (
    <div
      className={
        compacta
          ? `${estilos.barra} flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900`
          : `${clasePanel} ${estilos.barra} sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-4 p-4 sm:bottom-4 sm:px-5`
      }
    >
      <div className="min-w-0">
        {compacta && (
          <EstadoBorradorPreparacion
            situacion={situacion}
            estado={estado}
            ayuda={ayudaEstado}
          />
        )}
        <p
          className={`${compacta ? "sr-only" : ""} text-sm font-semibold text-gray-900 tabular-nums dark:text-white`}
        >
          {producto && <span>{producto.nombre} · </span>}
          {[
            cajas > 0 ? t("cantidadCajasClara", { cantidad: cajas }) : "",
            unidades > 0
              ? t("cantidadUnidadesClara", { cantidad: unidades })
              : "",
          ]
            .filter(Boolean)
            .join(" · ") || t("sinCantidadesPreparadas")}
        </p>
        <p
          className={`${compacta ? "sr-only" : ""} mt-1 text-theme-xs text-gray-600 dark:text-gray-300`}
        >
          {producto
            ? t("resumenSucursalesProductoTrabajo", {
                cantidad: new Set(asignaciones.map((fila) => fila.sucursal))
                  .size,
              })
            : t("resumenProductosSucursalesTrabajo", {
                productos: new Set(asignaciones.map((fila) => fila.producto))
                  .size,
                sucursales: new Set(asignaciones.map((fila) => fila.sucursal))
                  .size,
              })}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          disabled={guardando}
          onClick={producto ? alVolverProductos : alSalir}
          aria-label={producto ? t("volverProductosTrabajo") : undefined}
          className={`${estilos.pulsable} min-h-11 rounded-lg px-3 text-sm font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-gray-300`}
        >
          {t(producto ? "volverProductosTrabajo" : "salirTrabajo")}
        </button>
        {!compacta && situacion !== "vacio" && (
          <div className="order-first flex w-full sm:order-none sm:me-1 sm:w-auto">
            <EstadoBorradorPreparacion
              situacion={situacion}
              estado={estado}
              ayuda={ayudaEstado}
            />
          </div>
        )}
        {puedeGuardar && (
          <Button
            type="submit"
            size="sm"
            variant={producto || !puedeConfirmar ? "primary" : "outline"}
            className={`${estilos.pulsable} min-h-11 flex-1 sm:flex-none`}
            disabled={guardando || conflicto || navegando}
            startIcon={<IconoGuardar className="size-4" />}
          >
            {t(
              guardando
                ? "guardando"
                : producto
                  ? "guardarProductoPanel"
                  : "guardarBorrador",
            )}
          </Button>
        )}
        {!producto && puedeConfirmar && (
          <Button
            size="sm"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={guardando || conflicto || navegando}
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
