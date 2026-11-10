"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft as IconoAnterior,
  ArrowRight as IconoSiguiente,
  MapPin as IconoSucursal,
  Info as IconoAyuda,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import FilaSucursalPreparacion from "./FilaSucursalPreparacion";
import CargaTrabajoPreparacion from "./CargaTrabajoPreparacion";
import CajillasProductoPreparacion, {
  type EntradaCajillasProducto,
} from "./CajillasProductoPreparacion";
import SelectorSucursalesPreparacion from "./SelectorSucursalesPreparacion";
import useRepartoSucursalPreparacion from "./useRepartoSucursalPreparacion";
import estilos from "./estilosTrabajo.module.css";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
  ProductoPreparacion,
} from "./tipos";

interface PropiedadesReparto {
  producto: ProductoPreparacion;
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (asignacion: AsignacionEditable) => void;
  alCambiarDocumento: (documento: DocumentoEditable) => void;
  alQuitar: (clave: string) => void;
  alElegirLote: (asignacion: AsignacionEditable, lote: LotePreparacion) => void;
  alError: (error: unknown) => void;
  paginaInicial?: number;
  mostrarAnotadas?: boolean;
}

export default function RepartoProductoPreparacion(
  propiedades: PropiedadesReparto,
) {
  const {
    producto,
    documento,
    contexto,
    almacen,
    ocupado,
    errores,
    alCambiar,
    alCambiarDocumento,
    alQuitar,
    alElegirLote,
    alError,
  } = propiedades;
  const t = useTranslations("preparaciones");
  const reparto = useRepartoSucursalPreparacion(propiedades);
  const [entradasCajillas, establecerEntradasCajillas] = useState<
    Partial<Record<number, EntradaCajillasProducto>>
  >({});
  const sucursal = reparto.elegida;
  const anotadas = new Set(reparto.delProducto.map((fila) => fila.sucursal));
  documento.cajillas
    .filter((fila) => fila.producto?.id === producto.id)
    .forEach((fila) => anotadas.add(fila.sucursal.id));
  const mostrarCajillas =
    !!sucursal &&
    (reparto.delProducto.some(
      (fila) => fila.sucursal === sucursal.id && Number(fila.cantidad) > 0,
    ) ||
      documento.cajillas.some(
        (fila) =>
          fila.producto?.id === producto.id && fila.sucursal.id === sucursal.id,
      ));
  const cargando = reparto.cargandoSucursales || reparto.cargandoPedidos;
  return (
    <section
      className="border-t border-gray-100 dark:border-gray-800"
      aria-labelledby="pedidos-producto-preparacion"
    >
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="pedidos-producto-preparacion"
            className={`${estilos.titulo} text-base font-semibold text-gray-900 dark:text-white`}
          >
            {t("sucursalProductoTitulo")}
          </h3>
          <button
            type="button"
            disabled={ocupado}
            onClick={reparto.cambiarVista}
            className="min-h-11 rounded-lg px-2 text-theme-xs font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-brand-300"
          >
            {t(
              reparto.anotadas
                ? "verPendientesProducto"
                : "verAnotadasProducto",
              { cantidad: reparto.totalAnotadas },
            )}
          </button>
        </div>
        {reparto.anotadas && (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("anotadasBorradorProducto")}
          </p>
        )}
        {reparto.cargandoSucursales ? (
          <CargaTrabajoPreparacion />
        ) : reparto.falloSucursales ? (
          <div role="alert" className="space-y-2">
            <p>{t("errorCarga")}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={reparto.recargarSucursales}
            >
              {t("recargar")}
            </Button>
          </div>
        ) : !reparto.sucursales.length ? (
          <p
            role="status"
            className="py-4 text-sm text-gray-500 dark:text-gray-400"
          >
            {t(reparto.anotadas ? "sinAsignaciones" : "sinPendientes")}
          </p>
        ) : (
          <>
            <SelectorSucursalesPreparacion
              sucursales={reparto.sucursales}
              elegida={sucursal?.id ?? null}
              anotadas={anotadas}
              ocupado={ocupado}
              alElegir={reparto.elegir}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
              <span role="status">
                {t("posicionSucursalProducto", {
                  actual: reparto.posicionSucursal + 1,
                  total: reparto.totalSucursales,
                })}
              </span>
              {reparto.totalSucursales > 10 && (
                <PaginadorCompras
                  pagina={reparto.pagina}
                  total={reparto.totalSucursales}
                  ocupado={ocupado || reparto.cargandoSucursales}
                  alCambiar={reparto.cambiarPagina}
                />
              )}
            </div>
          </>
        )}
        {!!errores.asignaciones?.length && (
          <p
            role="alert"
            className="text-sm text-error-600 dark:text-error-400"
          >
            {errores.asignaciones.join(" ")}
          </p>
        )}
      </div>
      {sucursal && !reparto.falloSucursales && (
        <div className="px-4 pb-4">
          <section
            id="ficha-sucursal-producto"
            aria-labelledby="nombre-sucursal-producto"
            className="@container/ficha overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <IconoSucursal
                className="size-5 shrink-0 text-brand-600 dark:text-brand-400"
                aria-hidden="true"
              />
              <h4
                id="nombre-sucursal-producto"
                aria-live="polite"
                aria-atomic="true"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {sucursal.nombre}
              </h4>
            </header>
            {reparto.cargandoPedidos ? (
              <CargaTrabajoPreparacion />
            ) : reparto.falloPedidos ? (
              <div role="alert" className="space-y-3 p-4">
                <p>{t("errorCarga")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={reparto.recargarPedidos}
                >
                  {t("recargar")}
                </Button>
              </div>
            ) : (
              <>
                {!reparto.filas.length && (
                  <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {t(
                      reparto.anotadas
                        ? "sinAsignacionesSucursalProducto"
                        : "sinPendientes",
                    )}
                  </p>
                )}
                <div
                  className={`grid items-start ${mostrarCajillas ? "@4xl/ficha:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}
                >
                  <div>
                    <div key={sucursal.id}>
                      {reparto.filas.map((asignacion) => (
                        <FilaSucursalPreparacion
                          key={asignacion.clave}
                          integrada
                          asignacion={asignacion}
                          documento={documento}
                          contexto={contexto}
                          almacen={almacen}
                          indice={reparto.guardadas.findIndex(
                            (fila) => fila.clave === asignacion.clave,
                          )}
                          ocupado={ocupado}
                          errores={errores}
                          alError={alError}
                          alCambiar={alCambiar}
                          alCambiarDocumento={alCambiarDocumento}
                          alQuitar={() => alQuitar(asignacion.clave)}
                          alElegirLote={(lote) =>
                            alElegirLote(asignacion, lote)
                          }
                        />
                      ))}
                    </div>
                    {reparto.totalPedidos > 10 && (
                      <div
                        className="space-y-2 px-4 pb-4"
                        aria-label={t("pedidosSucursalProducto")}
                      >
                        <p className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">
                          {t("pedidosSucursalProducto")}
                        </p>
                        <PaginadorCompras
                          pagina={reparto.paginaPedidos}
                          total={reparto.totalPedidos}
                          ocupado={ocupado}
                          alCambiar={reparto.cambiarPaginaPedidos}
                        />
                      </div>
                    )}
                  </div>
                  {mostrarCajillas && (
                    <div
                      className={`${estilos.panelCajillas} m-4 mt-0 p-4 @4xl/ficha:ms-0 @4xl/ficha:mt-4`}
                    >
                      <CajillasProductoPreparacion
                        key={`${producto.id}:${sucursal.id}`}
                        documento={documento}
                        producto={{ id: producto.id, nombre: producto.nombre }}
                        sucursal={{ id: sucursal.id, nombre: sucursal.nombre }}
                        almacen={almacen}
                        ocupado={ocupado}
                        errores={errores}
                        alCambiar={alCambiarDocumento}
                        alError={alError}
                        entrada={
                          entradasCajillas[sucursal.id] ?? {
                            cantidadManual: null,
                            agregando: false,
                          }
                        }
                        alEntrada={(cambio) =>
                          establecerEntradasCajillas((anteriores) => ({
                            ...anteriores,
                            [sucursal.id]: {
                              cantidadManual: null,
                              agregando: false,
                              ...anteriores[sucursal.id],
                              ...cambio,
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
              <IconoAyuda className="size-4 shrink-0" aria-hidden="true" />
              {t("conservarSucursalProducto")}
            </p>
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 min-w-11"
                disabled={ocupado || cargando || reparto.posicionSucursal === 0}
                aria-label={t("sucursalAnteriorProducto")}
                onClick={() => reparto.moverSucursal(-1)}
              >
                <IconoAnterior className="size-4 rtl:rotate-180" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={
                  ocupado ||
                  cargando ||
                  reparto.posicionSucursal + 1 >= reparto.totalSucursales
                }
                onClick={() => reparto.moverSucursal(1)}
                endIcon={<IconoSiguiente className="size-4 rtl:rotate-180" />}
              >
                {t("siguienteSucursalProducto")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
