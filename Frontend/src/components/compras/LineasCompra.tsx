"use client";
import { useTranslations } from "next-intl";
import {
  ShoppingBasket as IconoCompra,
  PackagePlus as IconoAgregar,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "./PaginadorCompras";
import FilaCompra, { columnasCompra } from "./FilaCompra";
import ReferenciaPedidoProductoCompra from "./ReferenciaPedidoProductoCompra";
import useReferenciasPedidosCompra from "./useReferenciasPedidosCompra";
import { clasePanel, type LineaFormularioCompra } from "./tipos";

export default function LineasCompra({
  lineas,
  fechaPedidos,
  alCambiar,
  alAbrirAgregar,
  alAgregarProveedor,
  alQuitar,
  pagina,
  alPagina,
  errores,
  deshabilitado,
  puedeAgregar,
  alError,
}: {
  lineas: LineaFormularioCompra[];
  fechaPedidos: string;
  alCambiar: (clave: string, cambio: Partial<LineaFormularioCompra>) => void;
  alAbrirAgregar: () => void;
  alAgregarProveedor: (linea: LineaFormularioCompra) => void;
  alQuitar: (clave: string) => void;
  pagina: number;
  alPagina: (pagina: number) => void;
  errores: Record<string, string[]>;
  deshabilitado: boolean;
  puedeAgregar: boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const lineasPagina = lineas.slice((pagina - 1) * 10, pagina * 10);
  const referencias = useReferenciasPedidosCompra(
    fechaPedidos,
    lineasPagina,
    alError,
  );
  return (
    <section
      className={clasePanel + " min-w-0 overflow-hidden"}
      aria-labelledby="titulo-productos-compra"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <IconoCompra className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="titulo-productos-compra"
              className="font-semibold text-gray-900 dark:text-white"
            >
              {t("productosCompra")}
            </h2>
            <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("capturaCompraAyuda")}
            </p>
          </div>
        </div>
        {!!lineas.length && (
          <Button
            size="sm"
            variant="outline"
            onClick={alAbrirAgregar}
            startIcon={<IconoAgregar className="size-4" aria-hidden="true" />}
            disabled={deshabilitado || !puedeAgregar || lineas.length >= 500}
          >
            {t("agregarProducto")}
          </Button>
        )}
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
        <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <IconoAgregar className="size-6" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("empiezaCompra")}
            </p>
            <p className="mt-1 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t(puedeAgregar ? "empiezaCompraAyuda" : "eligeFechaCompraAyuda")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={alAbrirAgregar}
            startIcon={<IconoAgregar className="size-4" aria-hidden="true" />}
            disabled={deshabilitado || !puedeAgregar}
          >
            {t("agregarPrimerProducto")}
          </Button>
        </div>
      ) : (
        <>
          <div className="custom-scrollbar overflow-x-auto">
            <div
              role="table"
              aria-label={t("productosCompra")}
              className="lg:min-w-264"
            >
              <div
                role="rowgroup"
                className="hidden border-b border-gray-200 bg-gray-50/80 px-5 py-3 lg:block dark:border-gray-800 dark:bg-gray-800/50"
              >
                <div
                  role="row"
                  className={"grid items-center gap-3 " + columnasCompra}
                >
                  {[
                    "producto",
                    "proveedor",
                    "presentacionCompra",
                    "cantidadCorta",
                    "totalProductoPagado",
                    "acciones",
                  ].map((clave, indice) => (
                    <div
                      role="columnheader"
                      key={clave}
                      className={
                        "text-theme-xs font-medium text-gray-500 dark:text-gray-400 " +
                        (indice === 3 || indice === 4
                          ? "pe-2 text-end"
                          : indice === 5
                            ? "text-end"
                            : "")
                      }
                    >
                      {clave === "acciones" ? (
                        <span className="sr-only">{t(clave)}</span>
                      ) : (
                        t(clave)
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div
                role="rowgroup"
                className="divide-y divide-gray-100 dark:divide-gray-800"
              >
                {lineasPagina.map((linea, posicion) => (
                  <FilaCompra
                    key={linea.clave}
                    linea={linea}
                    referenciaPedidos={
                      <ReferenciaPedidoProductoCompra
                        fecha={fechaPedidos}
                        necesidad={referencias.necesidades?.[linea.producto.id]}
                        cargando={referencias.cargando}
                        fallo={referencias.fallo}
                        alReintentar={referencias.reintentar}
                      />
                    }
                    indice={(pagina - 1) * 10 + posicion}
                    errores={errores}
                    deshabilitado={deshabilitado}
                    puedeAgregarProveedor={puedeAgregar && lineas.length < 500}
                    alCambiar={alCambiar}
                    alAgregarProveedor={alAgregarProveedor}
                    alQuitar={alQuitar}
                    alError={alError}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <PaginadorCompras
              pagina={pagina}
              total={lineas.length}
              alCambiar={alPagina}
              ocupado={deshabilitado}
            />
          </div>
        </>
      )}
    </section>
  );
}
