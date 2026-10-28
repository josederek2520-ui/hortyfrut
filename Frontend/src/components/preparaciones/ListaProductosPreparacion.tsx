"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check as IconoAnotado } from "lucide-react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import ImagenProducto from "@/components/productos/ImagenProducto";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  clasePanel,
  type OpcionCompra,
  type PaginaCompra,
} from "@/components/compras/tipos";
import useConsultaPreparacion from "./useConsultaPreparacion";
import { productosDelDocumento } from "./calculos";
import type { DocumentoEditable, ProductoPreparacion } from "./tipos";

export default function ListaProductosPreparacion({
  contexto,
  documento,
  seleccionado,
  alElegir,
  ocupado,
  alError,
}: {
  contexto: string;
  documento: DocumentoEditable;
  seleccionado: ProductoPreparacion | null;
  alElegir: (producto: ProductoPreparacion) => void;
  ocupado: boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [vista, establecerVista] = useState<"pendientes" | "anotados">(
    "pendientes",
  );
  const [pagina, establecerPagina] = useState(1);
  const [buscar, establecerBuscar] = useState("");
  const [categoria, establecerCategoria] = useState<OpcionCompra | null>(null);
  const parametros = new URLSearchParams(contexto);
  parametros.set("pagina", String(pagina));
  parametros.set("buscar", buscar);
  if (categoria) parametros.set("categoria", String(categoria.id));
  const { datos, cargando, fallo, recargar } = useConsultaPreparacion<
    PaginaCompra<ProductoPreparacion>
  >(
    vista === "pendientes" ? `preparaciones/productos/?${parametros}` : null,
    alError,
  );
  const anotados = productosDelDocumento(documento).filter(
    (producto) =>
      (!categoria || producto.categoria?.id === categoria.id) &&
      producto.nombre
        .toLocaleLowerCase(idioma)
        .includes(buscar.toLocaleLowerCase(idioma)),
  );
  const paginaActual = vista === "anotados"
    ? Math.min(pagina, Math.max(1, Math.ceil(anotados.length / 10))) : pagina;
  const filas =
    vista === "pendientes"
      ? datos?.results || []
      : anotados.slice((paginaActual - 1) * 10, paginaActual * 10);
  const numero = (valor: number) => new Intl.NumberFormat(idioma).format(valor);
  return (
    <section
      className={`${clasePanel} min-w-0 space-y-4 p-4`}
      aria-labelledby="productos-por-preparar"
    >
      <div>
        <h2
          id="productos-por-preparar"
          className="font-semibold text-gray-900 dark:text-white"
        >
          {t("productosPorPreparar")}
        </h2>
        <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("eligeProductoAyuda")}
        </p>
      </div>
      <div
        role="group"
        aria-label={t("vistaProductosTrabajo")}
        className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
      >
        {(["pendientes", "anotados"] as const).map((valor) => (
          <Button
            key={valor}
            size="sm"
            variant="outline"
            className="pestana-hortyfru flex-1 px-2!"
            aria-pressed={vista === valor}
            onClick={() => {
              establecerVista(valor);
              establecerPagina(1);
            }}
          >
            {t(valor === "pendientes" ? "pendientes" : "enEstaHoja")}
          </Button>
        ))}
      </div>
      <Input
        type="search"
        value={buscar}
        maxLength={150}
        aria-label={t("buscarProductoTrabajo")}
        placeholder={t("buscarProductoTrabajo")}
        disabled={ocupado}
        onChange={(evento) => {
          establecerBuscar(evento.target.value);
          establecerPagina(1);
        }}
      />
      <DesplegableCompra
        tipo="general"
        ruta={`preparaciones/categorias/?${contexto}`}
        etiqueta={t("categoria")}
        valor={categoria}
        opcionVacia={t("todasCategorias")}
        deshabilitado={ocupado}
        alError={alError}
        alElegir={(elegida) => {
          establecerCategoria(elegida);
          establecerPagina(1);
        }}
      />
      {cargando ? (
        <p
          role="status"
          className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : fallo ? (
        <div
          role="alert"
          className="space-y-3 text-sm text-error-600 dark:text-error-400"
        >
          <p>{t("errorCarga")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              establecerPagina(1);
              recargar();
            }}
          >
            {t("recargar")}
          </Button>
        </div>
      ) : !filas.length ? (
        <p
          role="status"
          className="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t(
            vista === "pendientes"
              ? "sinProductosFiltro"
              : "sinProductosAnotados",
          )}
        </p>
      ) : (
        <div className="custom-scrollbar max-h-152 space-y-2 overflow-y-auto">
          {filas.map((producto) => {
            const anotado = Object.values(documento.asignaciones).some(
              (fila) =>
                fila.producto === producto.id && Number(fila.cantidad) > 0,
            );
            const activo = seleccionado?.id === producto.id;
            return (
              <button
                key={producto.id}
                type="button"
                disabled={ocupado}
                aria-pressed={activo}
                aria-controls="ficha-producto-preparacion"
                onClick={() => alElegir(producto)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start transition focus-visible:ring-3 focus-visible:ring-brand-400 focus-visible:outline-none motion-reduce:transition-none ${activo ? "border-orange-300 bg-orange-25 dark:border-orange-400/40 dark:bg-orange-500/5" : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"}`}
              >
                <ImagenProducto
                  origen={producto.imagen || null}
                  nombre={producto.nombre}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold break-words text-gray-900 dark:text-white">
                    {producto.nombre}
                  </span>
                  <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                    {producto.categoria?.nombre || producto.subtitulo}
                  </span>
                  {producto.pendientes_cajas !== undefined && (
                    <span className="mt-2 block text-theme-xs text-gray-600 tabular-nums dark:text-gray-300">
                      {t("cantUniPendientes", {
                        cajas: numero(producto.pendientes_cajas),
                        unidades: numero(producto.pendientes_unidades || 0),
                      })}
                    </span>
                  )}
                  {anotado && (
                    <span className="mt-2 inline-flex items-center gap-1 text-theme-xs font-medium text-brand-700 dark:text-brand-300">
                      <IconoAnotado className="size-3.5" aria-hidden="true" />
                      {t("conCantidadesAnotadas")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <PaginadorCompras
        pagina={paginaActual}
        total={vista === "pendientes" ? datos?.count || 0 : anotados.length}
        ocupado={ocupado || cargando || fallo}
        alCambiar={establecerPagina}
      />
    </section>
  );
}
