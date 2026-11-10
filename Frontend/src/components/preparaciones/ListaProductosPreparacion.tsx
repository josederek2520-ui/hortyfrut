"use client";
import { useTranslations } from "next-intl";
import {
  ArrowRight as IconoAbrir,
  Search as IconoBuscar,
  PackageSearch as IconoSinProductos,
} from "lucide-react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import ImagenProducto from "@/components/productos/ImagenProducto";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import { clasePanel } from "@/components/compras/tipos";
import CantidadesPedidoPreparacion from "./CantidadesPedidoPreparacion";
import CargaTrabajoPreparacion from "./CargaTrabajoPreparacion";
import estilos from "./estilosTrabajo.module.css";
import type { DocumentoEditable, ProductoPreparacion } from "./tipos";
import type { ConsultaProductosTrabajoPreparacion } from "./useProductosTrabajoPreparacion";

const columnasProductos =
  "@4xl:grid-cols-[minmax(12rem,1.8fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_9rem]";

export default function ListaProductosPreparacion({
  modelo,
  documento,
  alElegir,
  ocupado,
  alError,
}: {
  modelo: ConsultaProductosTrabajoPreparacion;
  documento: DocumentoEditable;
  alElegir: (producto: ProductoPreparacion) => void;
  ocupado: boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const anotados = new Set([
    ...Object.values(documento.asignaciones)
      .filter(
        (fila) =>
          fila.cantidad.trim() ||
          Object.values(fila.aportes).some(
            (aporte) => aporte.cantidad.trim() || aporte.pesoKg.trim(),
          ),
      )
      .map((fila) => fila.producto),
    ...documento.lineas
      .filter(
        (fila) =>
          fila.merma.trim() || fila.aprovechable.trim() || fila.motivo.trim(),
      )
      .map((fila) => fila.lote.producto),
    ...documento.cajillas
      .filter((fila) => fila.cantidad.trim())
      .flatMap((fila) => (fila.producto ? [fila.producto.id] : [])),
  ]);
  return (
    <section
      className={clasePanel + " @container min-w-0 overflow-hidden"}
      aria-labelledby="productos-por-preparar"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2
              id="productos-por-preparar"
              tabIndex={-1}
              className={`${estilos.titulo} scroll-mt-32 rounded text-xl font-semibold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white`}
            >
              {t("productosJornada")}
            </h2>
            {!modelo.cargando && !modelo.fallo && (
              <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                {modelo.total}
              </span>
            )}
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-gray-600 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:text-gray-300">
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={modelo.vista === "pendientes"}
              disabled={ocupado}
              onChange={(evento) =>
                modelo.alVista(evento.target.checked ? "pendientes" : "todos")
              }
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-gray-700 dark:peer-focus-visible:ring-offset-gray-900 peer-checked:[&>span]:translate-x-5 rtl:peer-checked:[&>span]:-translate-x-5"
            >
              <span className="absolute inset-y-0.5 start-0.5 size-5 rounded-full bg-white shadow-theme-xs transition-transform motion-reduce:transition-none" />
            </span>
            {t("soloPendientesProductos")}
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3.5 z-10 flex items-center text-gray-400">
              <IconoBuscar className="size-4" aria-hidden="true" />
            </span>
            <Input
              type="search"
              value={modelo.buscar}
              maxLength={150}
              aria-label={t("buscarProductoTrabajo")}
              placeholder={t("buscarProductoTrabajo")}
              className="ps-10"
              disabled={ocupado}
              onChange={(evento) => modelo.alBuscar(evento.target.value)}
            />
          </div>
          <div className="[&_label]:sr-only">
            <DesplegableCompra
              tipo="general"
              ruta={`preparaciones/categorias/?${modelo.contexto}`}
              etiqueta={t("categoria")}
              valor={modelo.categoria}
              opcionVacia={t("todasCategorias")}
              deshabilitado={ocupado}
              alError={alError}
              alElegir={modelo.alCategoria}
            />
          </div>
        </div>
      </div>
      {modelo.cargando ? (
        <CargaTrabajoPreparacion />
      ) : modelo.fallo ? (
        <div
          role="alert"
          className="space-y-3 p-5 text-center text-sm text-error-600 dark:text-error-400"
        >
          <p>{t("errorCarga")}</p>
          <Button size="sm" variant="outline" onClick={modelo.recargar}>
            {t("recargar")}
          </Button>
        </div>
      ) : !modelo.filas.length ? (
        <div
          role="status"
          className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
            <IconoSinProductos className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {t("sinProductosFiltro")}
          </p>
          <p className="max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t("sinResultadosProductosAyuda")}
          </p>
        </div>
      ) : (
        <div className="custom-scrollbar overflow-x-auto">
          <div
            role="table"
            aria-label={t("productosJornadaTrabajo")}
            className="min-w-0"
          >
            <div
              role="rowgroup"
              className="hidden border-y border-gray-100 bg-gray-50 px-5 py-3 sm:px-6 @4xl:block dark:border-gray-800 dark:bg-gray-800/40"
            >
              <div
                role="row"
                className={`grid items-center gap-4 ${columnasProductos}`}
              >
                {[
                  "producto",
                  "solicitado",
                  "pendiente",
                  "accionProductoTrabajo",
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
              {modelo.filas.map((producto) => (
                <div
                  key={producto.id}
                  role="row"
                  className={`${estilos.filaProducto} grid grid-cols-2 items-center gap-4 px-5 py-4 sm:px-6 ${columnasProductos}`}
                >
                  <div
                    role="cell"
                    className="col-span-2 flex min-w-0 items-center gap-3 @4xl:col-span-1"
                  >
                    <ImagenProducto
                      origen={producto.imagen || null}
                      nombre={producto.nombre}
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold break-words text-gray-900 dark:text-white">
                        {producto.nombre}
                      </h3>
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        {producto.categoria?.nombre || producto.subtitulo}
                      </p>
                    </div>
                  </div>
                  <div role="cell">
                    <span className="mb-1 block text-theme-xs text-gray-500 @4xl:sr-only dark:text-gray-400">
                      {t("solicitado")}
                    </span>
                    <CantidadesPedidoPreparacion
                      cajas={producto.cajas}
                      unidades={producto.unidades}
                    />
                  </div>
                  <div role="cell">
                    <span className="mb-1 block text-theme-xs text-gray-500 @4xl:sr-only dark:text-gray-400">
                      {t("pendiente")}
                    </span>
                    <div title={t("pendienteConfirmadoTrabajo")}>
                      <CantidadesPedidoPreparacion
                        cajas={producto.pendientes_cajas}
                        unidades={producto.pendientes_unidades}
                        solicitadas={producto}
                      />
                    </div>
                  </div>
                  <div
                    role="cell"
                    className="col-span-2 flex justify-end @4xl:col-span-1"
                  >
                    <Button
                      size="sm"
                      variant="primary"
                      className={`${estilos.pulsable} min-h-11 w-full scroll-mt-36 scroll-mb-36 @4xl:w-auto`}
                      data-producto-preparacion={producto.id}
                      disabled={ocupado}
                      aria-label={t(
                        anotados.has(producto.id)
                          ? "continuarProductoAccesible"
                          : "abrirProductoTrabajo",
                        {
                          producto: producto.nombre,
                        },
                      )}
                      aria-controls="ficha-producto-preparacion"
                      onClick={() => alElegir(producto)}
                      endIcon={<IconoAbrir className="size-4 rtl:rotate-180" />}
                    >
                      {t(
                        anotados.has(producto.id)
                          ? "continuarProductoTrabajo"
                          : "prepararTrabajo",
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {!modelo.cargando && !modelo.fallo && modelo.total > 10 && (
        <div className="px-5 pb-4 sm:px-6">
          <PaginadorCompras
            pagina={modelo.pagina}
            total={modelo.total}
            ocupado={ocupado || modelo.cargando || modelo.fallo}
            alCambiar={modelo.alPagina}
          />
        </div>
      )}
    </section>
  );
}
