"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  ShoppingBasket as IconoProducto,
  Trash2 as IconoQuitar,
  CopyPlus as IconoDuplicar,
} from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import DesplegableCompra from "./DesplegableCompra";
import PaginadorCompras from "./PaginadorCompras";
import { subtotalCentavos, mostrarCentavos } from "./calculos";
import {
  clasePanel,
  type LineaFormularioCompra,
  type OpcionCompra,
} from "./tipos";

const columnas =
  "lg:grid-cols-[minmax(6.5rem,1.1fr)_minmax(7rem,1.3fr)_minmax(6.5rem,1.1fr)_4.5rem_5.5rem_6rem_4.5rem]";

export default function LineasCompra({
  lineas,
  alCambiar,
  alAgregar,
  alDuplicar,
  alQuitar,
  pagina,
  alPagina,
  errores,
  deshabilitado,
  puedeAgregar,
  alError,
}: {
  lineas: LineaFormularioCompra[];
  alCambiar: (clave: string, cambio: Partial<LineaFormularioCompra>) => void;
  alAgregar: (producto: OpcionCompra) => void;
  alDuplicar: (linea: LineaFormularioCompra) => void;
  alQuitar: (clave: string) => void;
  pagina: number;
  alPagina: (pagina: number) => void;
  errores: Record<string, string[]>;
  deshabilitado: boolean;
  puedeAgregar: boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  return (
    <section
      className={`${clasePanel} min-w-0 overflow-hidden`}
      aria-labelledby="titulo-productos-compra"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
        <div className="max-w-xl">
          <h2
            id="titulo-productos-compra"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {t("miCompra")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("hojaCompraAyuda")}
          </p>
        </div>
        <DesplegableCompra
          tipo="producto"
          ruta="compras/productos/"
          etiqueta={t("agregarProducto")}
          valor={null}
          alElegir={(producto) => {
            if (producto) alAgregar(producto);
          }}
          alError={alError}
          agregar
          deshabilitado={deshabilitado || !puedeAgregar}
        />
      </div>
      {!!errores.detalles?.length && (
        <p
          role="alert"
          className="px-5 pt-4 text-sm text-error-500 dark:text-error-400"
        >
          {errores.detalles.join(" ")}
        </p>
      )}
      {!lineas.length ? (
        <div className="m-5 rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
          <IconoProducto
            className="mx-auto mb-3 size-9 text-brand-500"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t("sinProductosCompra")}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("sinProductosCompraAyuda")}
          </p>
        </div>
      ) : (
        <div className="custom-scrollbar overflow-x-auto">
          <div
            role="table"
            aria-label={t("productosCompra")}
            className="lg:min-w-188"
          >
            <div
              role="rowgroup"
              className="hidden border-b border-gray-200 bg-gray-50 px-4 py-3 lg:block dark:border-gray-800 dark:bg-gray-800/50"
            >
              <div role="row" className={`grid gap-3 ${columnas}`}>
                {[
                  "producto",
                  "proveedor",
                  "presentacionCompra",
                  "cantidadCorta",
                  "precioCorto",
                  "subtotal",
                  "acciones",
                ].map((clave) => (
                  <div
                    role="columnheader"
                    key={clave}
                    className="text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    {t(clave)}
                  </div>
                ))}
              </div>
            </div>
            <div
              role="rowgroup"
              className="divide-y divide-gray-100 dark:divide-gray-800"
            >
              {lineas
                .slice((pagina - 1) * 10, pagina * 10)
                .map((linea, posicion) => {
                  const indice = (pagina - 1) * 10 + posicion;
                  const campo = (nombre: string) =>
                    `detalle_${indice}_${nombre}`;
                  const etiquetaUnidad =
                    linea.presentacion?.nombre ||
                    linea.producto.unidad_nombre ||
                    "—";
                  return (
                    <div
                      role="row"
                      key={linea.clave}
                      className={`grid grid-cols-2 items-start gap-4 p-4 focus-within:bg-orange-25 lg:gap-3 dark:focus-within:bg-orange-500/5 ${columnas}`}
                    >
                      <div
                        role="cell"
                        className="col-span-2 min-w-0 lg:col-span-1 lg:pt-2"
                      >
                        <p className="text-sm font-semibold break-words text-gray-900 dark:text-white">
                          {linea.producto.nombre}
                        </p>
                        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                          {t("lineaNumero", { numero: indice + 1 })}
                        </p>
                        {!!errores[campo("producto")]?.length && (
                          <p
                            role="alert"
                            className="mt-2 text-theme-xs text-error-500 dark:text-error-400"
                          >
                            {errores[campo("producto")].join(" ")}
                          </p>
                        )}
                      </div>
                      <div
                        role="cell"
                        className="col-span-2 min-w-0 sm:col-span-1 lg:[&_label]:sr-only"
                      >
                        <DesplegableCompra
                          tipo="proveedor"
                          ruta={`compras/proveedores/?producto=${linea.producto.id}`}
                          etiqueta={t("proveedor")}
                          nombre={campo("proveedor")}
                          valor={linea.proveedor}
                          alElegir={(proveedor) =>
                            alCambiar(linea.clave, { proveedor })
                          }
                          alError={alError}
                          deshabilitado={deshabilitado}
                          opcionVacia={t("sinProveedor")}
                          error={errores[campo("proveedor")]?.join(" ")}
                        />
                      </div>
                      <div
                        role="cell"
                        className="col-span-2 min-w-0 sm:col-span-1 lg:[&_label]:sr-only"
                      >
                        <DesplegableCompra
                          tipo="presentacion"
                          ruta={`compras/presentaciones/?producto=${linea.producto.id}`}
                          etiqueta={t("presentacionCompra")}
                          nombre={campo("presentacion")}
                          valor={linea.presentacion}
                          alElegir={(presentacion) =>
                            alCambiar(linea.clave, { presentacion })
                          }
                          alError={alError}
                          deshabilitado={deshabilitado}
                          opcionVacia={t("unidadBase", {
                            unidad: linea.producto.unidad_nombre || "—",
                          })}
                          error={errores[campo("presentacion")]?.join(" ")}
                        />
                      </div>
                      <div role="cell" className="min-w-0 lg:[&_label]:sr-only">
                        <CampoDirectorio
                          id={campo("cantidad")}
                          name={campo("cantidad")}
                          etiqueta={t("cantidadComprada")}
                          inputMode="decimal"
                          pattern="[0-9]{1,9}([.,][0-9]{1,3})?"
                          maxLength={13}
                          placeholder="0"
                          value={linea.cantidad}
                          disabled={deshabilitado}
                          errores={errores[campo("cantidad")]}
                          onChange={(evento) =>
                            alCambiar(linea.clave, {
                              cantidad: evento.target.value,
                            })
                          }
                          title={t("cantidadAyuda")}
                        />
                      </div>
                      <div role="cell" className="min-w-0 lg:[&_label]:sr-only">
                        <CampoDirectorio
                          id={campo("precio_unitario")}
                          name={campo("precio_unitario")}
                          etiqueta={t("precioUnitario")}
                          inputMode="decimal"
                          pattern="[0-9]{1,10}([.,][0-9]{1,2})?"
                          maxLength={13}
                          placeholder="0.00"
                          value={linea.precioUnitario}
                          disabled={deshabilitado}
                          errores={errores[campo("precio_unitario")]}
                          onChange={(evento) =>
                            alCambiar(linea.clave, {
                              precioUnitario: evento.target.value,
                            })
                          }
                          title={t("precioAyuda", { unidad: etiquetaUnidad })}
                        />
                      </div>
                      <div role="cell" className="self-center">
                        <span className="mb-1 block text-theme-xs text-gray-500 lg:sr-only dark:text-gray-400">
                          {t("subtotal")}
                        </span>
                        <span className="text-sm font-semibold break-words text-gray-900 tabular-nums dark:text-white">
                          {mostrarCentavos(
                            subtotalCentavos(
                              linea.cantidad,
                              linea.precioUnitario,
                            ),
                            idioma,
                          )}
                        </span>
                      </div>
                      <div
                        role="cell"
                        className="flex justify-end gap-1 lg:pt-0.5"
                      >
                        <button
                          type="button"
                          disabled={deshabilitado || lineas.length >= 500}
                          onClick={() => alDuplicar(linea)}
                          title={t("otroProveedor", {
                            nombre: linea.producto.nombre,
                          })}
                          aria-label={t("otroProveedor", {
                            nombre: linea.producto.nombre,
                          })}
                          className="inline-flex min-h-11 min-w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                        >
                          <IconoDuplicar
                            className="size-4"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => alQuitar(linea.clave)}
                          title={t("quitarProducto", {
                            nombre: linea.producto.nombre,
                          })}
                          aria-label={t("quitarProducto", {
                            nombre: linea.producto.nombre,
                          })}
                          className="inline-flex min-h-11 min-w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 disabled:opacity-40 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                        >
                          <IconoQuitar className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {lineas.length > 0 && (
        <div className="px-5 pb-5">
          <PaginadorCompras
            pagina={pagina}
            total={lineas.length}
            alCambiar={alPagina}
            ocupado={deshabilitado}
          />
        </div>
      )}
    </section>
  );
}
