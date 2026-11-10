"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown as IconoDesplegar } from "lucide-react";
import ImagenProducto from "@/components/productos/ImagenProducto";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import CajillasRevisionPreparacion from "./CajillasRevisionPreparacion";
import {
  numeroRevisionPreparacion,
  type CantidadRevisionPreparacion,
  type ProductoRevisionPreparacion as ProductoRevision,
} from "./revisionPorSucursalPreparacion";
import type { DocumentoEditable } from "./tipos";

export default function ProductoRevisionPreparacion({
  producto,
  documento,
}: {
  producto: ProductoRevision;
  documento: DocumentoEditable;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const identificador = useId();
  const [abierta, establecerAbierta] = useState(false);
  const [pagina, establecerPagina] = useState(1);
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(producto.asignaciones.length / 10)),
  );
  const cantidadClara = (cantidad: CantidadRevisionPreparacion) => {
    if (cantidad.cantidad === null) return "—";
    const presentacion = cantidad.presentacion.trim().toLocaleLowerCase();
    if (
      cantidad.columna === "cajas" &&
      (!presentacion || ["caja", "cajas"].includes(presentacion))
    )
      return t("cantidadCajasClara", { cantidad: Number(cantidad.cantidad) });
    if (
      cantidad.columna === "unidades" &&
      (!presentacion || ["unidad", "unidades"].includes(presentacion))
    )
      return t("cantidadUnidadesClara", {
        cantidad: Number(cantidad.cantidad),
      });
    const medida = t(
      cantidad.columna === "cajas"
        ? "cantidadCajasClara"
        : "cantidadUnidadesClara",
      { cantidad: Number(cantidad.cantidad) },
    );
    return `${medida} · ${cantidad.presentacion}`;
  };
  const origenIncompleto = producto.asignaciones.some((fila) => !fila.detalle);
  return (
    <div
      role="rowgroup"
      className="border-t border-gray-100 dark:border-gray-800"
    >
      <div
        role="row"
        className="grid grid-cols-2 items-start gap-x-4 gap-y-3 px-4 py-4 @2xl/revision:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,1.2fr)]"
      >
        <div
          role="cell"
          className="col-span-2 flex min-w-0 items-start gap-3 @2xl/revision:col-span-1"
        >
          <ImagenProducto origen={producto.imagen} nombre={producto.nombre} />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold break-words text-gray-900 dark:text-white">
              {producto.nombre}
            </h4>
            <button
              type="button"
              aria-expanded={abierta}
              aria-controls={identificador}
              onClick={() => establecerAbierta(!abierta)}
              className="mt-1 inline-flex min-h-9 items-center gap-1 rounded text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300"
            >
              {t("verTrazabilidadRevision")}
              <IconoDesplegar
                aria-hidden="true"
                className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${abierta ? "rotate-180" : ""}`}
              />
            </button>
            {origenIncompleto && (
              <p className="mt-1 text-theme-xs text-error-600 dark:text-error-400">
                {t("origenAsignacionCambio")}
              </p>
            )}
          </div>
        </div>
        <div
          role="cell"
          className="space-y-1 text-sm font-medium text-gray-800 tabular-nums dark:text-gray-100"
        >
          <span className="mb-1 block text-theme-xs font-normal text-gray-500 @2xl/revision:sr-only dark:text-gray-400">
            {t("preparadoRevision")}
          </span>
          {producto.cantidades.map((cantidad, indice) => (
            <p key={indice}>{cantidadClara(cantidad)}</p>
          ))}
          {!producto.cantidades.length && (
            <span className="text-gray-500 dark:text-gray-400">
              {t("sinCantidadesPreparadas")}
            </span>
          )}
        </div>
        <div role="cell" className="text-sm font-medium tabular-nums">
          <span className="mb-1 block text-theme-xs font-normal text-gray-500 @2xl/revision:sr-only dark:text-gray-400">
            {t("pesoRealRevision")}
          </span>
          {producto.pesoKg === null ? (
            <span className="text-orange-700 dark:text-orange-300">
              {t("pesoFaltante")}
            </span>
          ) : (
            <span className="text-gray-800 dark:text-gray-100">
              {numeroRevisionPreparacion(producto.pesoKg, idioma)} kg
            </span>
          )}
        </div>
        <div
          role="cell"
          className="col-span-2 min-w-0 @2xl/revision:col-span-1"
        >
          <span className="mb-1 block text-theme-xs text-gray-500 @2xl/revision:sr-only dark:text-gray-400">
            {t("cajillasPrevistas")}
          </span>
          <CajillasRevisionPreparacion filas={producto.cajillas} />
        </div>
      </div>
      <div role="row" hidden={!abierta} id={identificador}>
        <div
          role="cell"
          aria-colspan={4}
          className="space-y-3 bg-gray-50 px-4 py-4 dark:bg-gray-950/50"
        >
          {!producto.asignaciones.length && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("sinAsignaciones")}
            </p>
          )}
          {producto.asignaciones
            .slice((paginaActual - 1) * 10, paginaActual * 10)
            .map((asignacion) => (
              <div
                key={asignacion.clave}
                className="space-y-2 border-b border-gray-200 pb-3 last:border-b-0 last:pb-0 dark:border-gray-800"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {asignacion.codigo} ·{" "}
                  {cantidadClara({
                    columna: asignacion.columna,
                    presentacion: asignacion.presentacion,
                    cantidad: asignacion.cantidad,
                  })}
                </p>
                <ul className="space-y-1 text-theme-xs text-gray-600 dark:text-gray-300">
                  {Object.entries(asignacion.aportes)
                    .filter(([, aporte]) => Number(aporte.cantidad) > 0)
                    .map(([lote, aporte]) => {
                      const linea = documento.lineas.find(
                        (fila) => fila.lote.id === Number(lote),
                      );
                      return (
                        <li key={lote}>
                          {linea?.lote.nombre || t("loteRetirado")} ·{" "}
                          {numeroRevisionPreparacion(aporte.cantidad, idioma)}{" "}
                          {linea?.lote.unidad_abreviatura}
                          {!linea?.lote.es_kg && (
                            <>
                              {" "}
                              ·{" "}
                              {aporte.pesoKg
                                ? t("pesoKgValor", {
                                    cantidad: numeroRevisionPreparacion(
                                      aporte.pesoKg,
                                      idioma,
                                    ),
                                  })
                                : t("pesoFaltante")}
                            </>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          {producto.asignaciones.length > 10 && (
            <PaginadorCompras
              pagina={paginaActual}
              total={producto.asignaciones.length}
              alCambiar={establecerPagina}
            />
          )}
        </div>
      </div>
    </div>
  );
}
