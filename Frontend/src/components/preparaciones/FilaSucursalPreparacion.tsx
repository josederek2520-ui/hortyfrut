"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  RotateCcw as IconoLimpiar,
  MapPin as IconoSucursal,
} from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import AportesSucursalPreparacion from "./AportesSucursalPreparacion";
import VistaAnimadaPreparacion from "./VistaAnimadaPreparacion";
import estilos from "./estilosTrabajo.module.css";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
} from "./tipos";

export default function FilaSucursalPreparacion({
  asignacion,
  documento,
  contexto,
  almacen,
  indice,
  ocupado,
  errores,
  alCambiar,
  alQuitar,
  alElegirLote,
  alError,
  cajillas,
  integrada = false,
  alCambiarDocumento,
}: {
  asignacion: AsignacionEditable;
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  indice: number;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (asignacion: AsignacionEditable) => void;
  alQuitar: () => void;
  alElegirLote: (lote: LotePreparacion) => void;
  alError: (error: unknown) => void;
  cajillas?: ReactNode;
  integrada?: boolean;
  alCambiarDocumento?: (documento: DocumentoEditable) => void;
}) {
  const t = useTranslations("preparaciones");
  const Titulo = integrada ? "h5" : "h4";
  const numero = new Intl.NumberFormat(useLocale());
  const prefijo =
    indice >= 0
      ? "asignaciones_" + indice
      : "asignaciones_nueva_" + asignacion.clave;
  const deshabilitado =
    ocupado || !asignacion.detalle || !asignacion.disponible;
  const conMedicion =
    Number(asignacion.cantidad) > 0 ||
    Object.keys(asignacion.aportes).length > 0;
  const restante = Math.max(
    0,
    asignacion.pendiente - (Number(asignacion.cantidad) || 0),
  );
  return (
    <article
      className={
        (integrada
          ? "border-t border-gray-100 first:border-t-0 dark:border-gray-800"
          : estilos.sucursal) + " @container/sucursal p-4"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Titulo className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            {!integrada && (
              <IconoSucursal
                className="size-4 shrink-0 text-gray-400"
                aria-hidden="true"
              />
            )}
            {integrada ? asignacion.codigo : asignacion.sucursalNombre}
          </Titulo>
          {!integrada && (
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {asignacion.codigo}
            </p>
          )}
          {asignacion.presentacion &&
            !/^(cajas?|unidades?)$/i.test(asignacion.presentacion) && (
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {asignacion.presentacion}
              </p>
            )}
          {["detalle_pedido", "pedido"].map((campo) =>
            errores[prefijo + "_" + campo]?.length ? (
              <p
                key={campo}
                role="alert"
                tabIndex={-1}
                data-invalido="true"
                className="mt-1 rounded text-theme-xs text-error-600 dark:text-error-400"
              >
                {errores[prefijo + "_" + campo].join(" ")}
              </p>
            ) : null,
          )}
          {!asignacion.disponible && (
            <p className="mt-2 text-theme-xs text-warning-600 dark:text-warning-400">
              {t("pedidoNoDisponibleTrabajo")}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={ocupado || indice < 0}
          aria-label={t("borrarSucursalTrabajo", {
            sucursal: asignacion.sucursalNombre,
          })}
          onClick={alQuitar}
          className={
            estilos.pulsable +
            " flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:hover:bg-error-500/10 dark:hover:text-error-400"
          }
        >
          <IconoLimpiar className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`${estilos.resumenPedido} mt-3 grid grid-cols-2 items-start gap-4 rounded-xl @md/sucursal:grid-cols-[minmax(0,1fr)_minmax(6rem,8rem)_minmax(0,1fr)]`}
      >
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t("solicitado")}
          </p>
          <p className="mt-2 text-base font-semibold text-gray-900 tabular-nums dark:text-white">
            {t(
              asignacion.columna === "cajas"
                ? "cantidadCajasClara"
                : "cantidadUnidadesClara",
              { cantidad: asignacion.solicitada },
            )}
          </p>
          {asignacion.pendiente !== asignacion.solicitada && (
            <p className="mt-1 text-theme-xs text-gray-600 dark:text-gray-300">
              {t("pendiente")} · {numero.format(asignacion.pendiente)}
            </p>
          )}
        </div>
        <CampoDirectorio
          id={prefijo + "_cantidad"}
          name={prefijo + "_cantidad"}
          etiqueta={t("prepararAhoraTrabajo")}
          aria-label={t("prepararSucursalMedidaTrabajo", {
            sucursal: asignacion.sucursalNombre,
            medida: t(
              asignacion.columna === "cajas"
                ? "cajasCantTrabajo"
                : "unidadesUniTrabajo",
            ),
          })}
          className="text-end text-base font-semibold tabular-nums"
          value={asignacion.cantidad}
          inputMode="numeric"
          pattern="[0-9]{1,6}"
          maxLength={6}
          placeholder="0"
          disabled={deshabilitado}
          errores={errores[prefijo + "_cantidad"]}
          onChange={(evento) =>
            alCambiar({ ...asignacion, cantidad: evento.target.value })
          }
        />
        <div className="col-span-full border-t border-gray-200 pt-3 @md/sucursal:col-span-1 @md/sucursal:border-t-0 @md/sucursal:pt-0 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t("pendienteTrasPrepararPanel")}
          </p>
          <p
            className="mt-2 text-base font-semibold text-gray-900 tabular-nums dark:text-white"
            aria-label={t("quedaPorPrepararTrabajo", {
              cantidad: numero.format(restante),
            })}
          >
            {t(
              asignacion.columna === "cajas"
                ? "cantidadCajasClara"
                : "cantidadUnidadesClara",
              { cantidad: restante },
            )}
          </p>
        </div>
      </div>
      {(conMedicion || cajillas) && (
        <div
          className={
            "mt-3 grid items-start gap-4 border-t border-gray-100 pt-3 dark:border-gray-800 " +
            (cajillas && conMedicion
              ? "@2xl/sucursal:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
              : "")
          }
        >
          <VistaAnimadaPreparacion
            visible={conMedicion}
            clave={"medicion-" + asignacion.clave}
          >
            <AportesSucursalPreparacion
              asignacion={asignacion}
              documento={documento}
              contexto={contexto}
              almacen={almacen}
              prefijo={prefijo}
              ocupado={ocupado}
              errores={errores}
              alCambiar={alCambiar}
              alElegirLote={alElegirLote}
              alError={alError}
              alCambiarDocumento={alCambiarDocumento}
            />
          </VistaAnimadaPreparacion>
          {cajillas}
        </div>
      )}
    </article>
  );
}
