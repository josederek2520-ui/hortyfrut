"use client";
import { useLocale, useTranslations } from "next-intl";
import { Package, Plus, Search } from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import { campoPrecio, panelPrecio, type LineaPrecio } from "./tipos";
import TarjetaProductoPrecio from "./TarjetaProductoPrecio";

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
  origenPedidos = false,
  cargando = false,
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
  origenPedidos?: boolean;
  cargando?: boolean;
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2
            data-campo-precio="lineas"
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            {t("productosPrecios")}
          </h2>
          <p className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {t("productosAnotados", { total: lineas.length })}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {!!lineas.length && (
            <label className="relative block min-w-0 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">{t("buscarProducto")}</span>
              <Search
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500 dark:text-gray-400"
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
          {editable && !version && !origenPedidos && (
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
      </div>
      {cargando ? (
        <p
          role="status"
          className="p-8 text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargandoProductosPedidos")}
        </p>
      ) : !lineas.length ? (
        <div className="border-t border-gray-100 px-5 py-10 text-center dark:border-gray-800">
          <Package
            className="mx-auto size-9 text-brand-600 dark:text-brand-300"
            aria-hidden="true"
          />
          <p className="mt-3 font-medium">
            {t(origenPedidos ? "sinProductosPedidos" : "sinProductos")}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {t(
              origenPedidos ? "sinProductosPedidosAyuda" : "sinProductosAyuda",
            )}
          </p>
          {editable && !version && !origenPedidos && (
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
          <ul className="grid grid-cols-1 gap-4 border-t border-gray-100 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 dark:border-gray-800">
            {filtradas.slice((pagina - 1) * 10, pagina * 10).map((fila) => (
              <TarjetaProductoPrecio
                key={fila.producto}
                fila={fila}
                editable={editable}
                version={version}
                bloqueado={bloqueado}
                errores={errores}
                alQuitar={alQuitar}
                alPrecio={alPrecio}
              />
            ))}
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
