"use client";
import { useLocale, useTranslations } from "next-intl";
import { Package, Plus, Trash2, Search } from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import { mostrarBolivianos } from "@/lib/moneda";
import { campoPrecio, panelPrecio, type LineaPrecio } from "./tipos";
import { normalizarPrecio } from "./calculosPrecio";

export default function ProductosPrecio({
  lineas,
  pagina,
  buscar,
  editable,
  version,
  bloqueado,
  errores,
  alPagina,
  alBuscar,
  alAgregar,
  alQuitar,
  alPrecio,
}: {
  lineas: LineaPrecio[];
  pagina: number;
  buscar: string;
  editable: boolean;
  version: boolean;
  bloqueado: boolean;
  errores: Record<string, string[]>;
  alPagina: (pagina: number) => void;
  alBuscar: (buscar: string) => void;
  alAgregar: () => void;
  alQuitar: (id: number) => void;
  alPrecio: (id: number, valor: string) => void;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const filtradas = lineas.filter((f) =>
    `${f.producto_nombre} ${f.categoria_nombre}`
      .toLocaleLowerCase(idioma)
      .includes(buscar.toLocaleLowerCase(idioma)),
  );
  return (
    <div className={panelPrecio}>
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2
            data-campo-precio="lineas"
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            {t("productosPrecios")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("productosAnotados", { total: lineas.length })}
          </p>
        </div>
        {editable && !version && (
          <Button
            variant="outline"
            onClick={alAgregar}
            disabled={bloqueado || lineas.length >= 500}
            startIcon={<Plus className="size-4" />}
          >
            {t("agregarProductos")}
          </Button>
        )}
      </div>
      {!!lineas.length && (
        <label className="relative mx-5 mb-4 block">
          <span className="sr-only">{t("buscarProducto")}</span>
          <Search
            className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
            aria-hidden="true"
          />
          <input
            type="search"
            autoComplete="off"
            className={campoPrecio + " ps-9"}
            placeholder={t("buscarProducto")}
            value={buscar}
            onChange={(e) => alBuscar(e.target.value)}
          />
        </label>
      )}
      {!lineas.length ? (
        <div className="border-t border-gray-100 px-5 py-10 text-center dark:border-gray-800">
          <Package
            className="mx-auto size-9 text-brand-600 dark:text-brand-300"
            aria-hidden="true"
          />
          <p className="mt-3 font-medium">{t("sinProductos")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {t("sinProductosAyuda")}
          </p>
          {editable && !version && (
            <div className="mt-5">
              <Button onClick={alAgregar} disabled={bloqueado}>
                {t("agregarPrimerProducto")}
              </Button>
            </div>
          )}
        </div>
      ) : !filtradas.length ? (
        <p className="p-8 text-center text-gray-500">{t("sinResultados")}</p>
      ) : (
        <>
          <div
            className={
              "hidden gap-4 border-y border-gray-100 bg-gray-50 px-5 py-3 text-xs font-medium text-gray-500 sm:grid dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400 " +
              (version
                ? "sm:grid-cols-[1fr_9rem_12rem_3rem]"
                : "sm:grid-cols-[1fr_12rem_3rem]")
            }
          >
            <span>{t("producto")}</span>
            {version && <span className="text-end">{t("precioAnterior")}</span>}
            <span className="text-end">
              {t(editable ? "precioPropuesto" : "precioKg")}
            </span>
            <span className="sr-only">{t("acciones")}</span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtradas.slice((pagina - 1) * 10, pagina * 10).map((fila) => {
              const clave = `${fila.producto}_precio_kg`,
                id = "precio-producto-" + fila.producto;
              return (
                <li
                  key={fila.producto}
                  className={
                    "grid items-start gap-4 p-5 " +
                    (version
                      ? "sm:grid-cols-[1fr_9rem_12rem_3rem]"
                      : "sm:grid-cols-[1fr_12rem_3rem]")
                  }
                >
                  <div>
                    <p className="font-medium">{fila.producto_nombre}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {fila.categoria_nombre}
                    </p>
                  </div>
                  {version && (
                    <div className="text-sm sm:pt-3 sm:text-end">
                      <span className="me-2 text-xs text-gray-500 sm:hidden">
                        {t("precioAnterior")}
                      </span>
                      {fila.precio_anterior
                        ? mostrarBolivianos(fila.precio_anterior, idioma)
                        : "—"}
                    </div>
                  )}
                  <div>
                    {editable ? (
                      <>
                        <label
                          className="mb-1.5 block text-xs font-medium sm:sr-only"
                          htmlFor={id}
                        >
                          {t("precioPropuesto")}
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute start-3 top-3 text-sm text-gray-500">
                            Bs
                          </span>
                          <input
                            id={id}
                            data-campo-precio={clave}
                            aria-label={t("precioProducto", {
                              producto: fila.producto_nombre,
                            })}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            maxLength={14}
                            className={
                              campoPrecio +
                              " ps-10 text-end tabular-nums " +
                              (errores[clave] ? "border-error-500" : "")
                            }
                            placeholder="0,00"
                            value={fila.precio_kg}
                            disabled={bloqueado}
                            aria-invalid={!!errores[clave]}
                            aria-describedby={
                              errores[clave] ? id + "-error" : id + "-unidad"
                            }
                            onChange={(e) =>
                              alPrecio(fila.producto, e.target.value)
                            }
                            onBlur={() => {
                              const normal = normalizarPrecio(fila.precio_kg);
                              if (normal && normal !== fila.precio_kg)
                                alPrecio(fila.producto, normal);
                            }}
                          />
                        </div>
                        <p
                          id={id + "-unidad"}
                          className="mt-1 text-end text-xs text-gray-500 dark:text-gray-400"
                        >
                          {t("porKilogramo")}
                        </p>
                        {errores[clave] && (
                          <p
                            id={id + "-error"}
                            className="mt-1 text-xs text-error-600 dark:text-error-300"
                          >
                            {t("precioValido")}
                          </p>
                        )}
                      </>
                    ) : (
                      <p
                        data-campo-precio={clave}
                        tabIndex={-1}
                        className="text-sm font-semibold tabular-nums sm:pt-3 sm:text-end"
                      >
                        {fila.precio_kg
                          ? mostrarBolivianos(fila.precio_kg, idioma)
                          : "—"}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          / kg
                        </span>
                      </p>
                    )}
                  </div>
                  {editable && !version ? (
                    <button
                      type="button"
                      className="inline-flex size-11 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-error-500 dark:hover:bg-error-500/15 dark:hover:text-error-300"
                      aria-label={t("quitarProducto", {
                        producto: fila.producto_nombre,
                      })}
                      disabled={bloqueado}
                      onClick={() => alQuitar(fila.producto)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
          {filtradas.length > 10 && (
            <PaginadorPedidos
              pagina={pagina}
              total={filtradas.length}
              alCambiar={alPagina}
              ocupado={bloqueado}
            />
          )}
        </>
      )}
    </div>
  );
}
