"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin as IconoSucursal } from "lucide-react";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import ProductoRevisionPreparacion from "./ProductoRevisionPreparacion";
import CajillasRevisionPreparacion from "./CajillasRevisionPreparacion";
import ConsumoRevisionPreparacion from "./ConsumoRevisionPreparacion";
import {
  agruparRevisionPreparacion,
  totalCajillasRevision,
  type SucursalRevisionPreparacion,
} from "./revisionPorSucursalPreparacion";
import type { DocumentoEditable } from "./tipos";

export function ResumenRevisionPreparacion({
  documento,
}: {
  documento: DocumentoEditable;
}) {
  const t = useTranslations("preparaciones");
  const sucursales = agruparRevisionPreparacion(documento);
  const productos = new Set([
    ...documento.lineas.map((fila) => fila.lote.producto),
    ...sucursales.flatMap((fila) =>
      fila.productos.map((producto) => producto.id),
    ),
  ]);
  const cajillas = totalCajillasRevision(documento);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
      <span>
        {t("conteoSucursalesRevision", { cantidad: sucursales.length })}
      </span>
      <span aria-hidden="true">·</span>
      <span>{t("conteoProductosRevision", { cantidad: productos.size })}</span>
      <span aria-hidden="true">·</span>
      <span>
        {cajillas === null
          ? t("cantidadPendienteRevision")
          : t("conteoCajillasRevision", { cantidad: cajillas })}
      </span>
    </p>
  );
}

function SucursalRevision({
  sucursal,
  documento,
}: {
  sucursal: SucursalRevisionPreparacion;
  documento: DocumentoEditable;
}) {
  const t = useTranslations("preparaciones");
  const [pagina, establecerPagina] = useState(1);
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(sucursal.productos.length / 10)),
  );
  return (
    <section className="@container/revision overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <IconoSucursal
            aria-hidden="true"
            className="size-4 shrink-0 text-gray-500 dark:text-gray-400"
          />
          {sucursal.nombre}
        </h3>
        {!!sucursal.pedidos.length && (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {sucursal.pedidos.length === 1
              ? sucursal.pedidos[0].codigo
              : t("conteoPedidosRevision", {
                  cantidad: sucursal.pedidos.length,
                })}
          </p>
        )}
      </header>
      {!!sucursal.productos.length && (
        <div
          role="table"
          aria-label={t("productosSucursalRevision", {
            sucursal: sucursal.nombre,
          })}
        >
          <div
            role="rowgroup"
            className="hidden border-t border-gray-100 bg-gray-50 @2xl/revision:block dark:border-gray-800 dark:bg-gray-800/40"
          >
            <div
              role="row"
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,1.2fr)] gap-4 px-4 py-2.5"
            >
              {[
                "producto",
                "preparadoRevision",
                "pesoRealRevision",
                "cajillasPrevistas",
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
          {sucursal.productos
            .slice((paginaActual - 1) * 10, paginaActual * 10)
            .map((producto) => (
              <ProductoRevisionPreparacion
                key={producto.id}
                producto={producto}
                documento={documento}
              />
            ))}
        </div>
      )}
      {sucursal.productos.length > 10 && (
        <div className="px-4 pb-4">
          <PaginadorCompras
            pagina={paginaActual}
            total={sucursal.productos.length}
            alCambiar={establecerPagina}
          />
        </div>
      )}
      {!!sucursal.cajillasHistoricas.length && (
        <section className="space-y-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <h4 className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            {t("cajillasHistoricasSinProducto")}
          </h4>
          <CajillasRevisionPreparacion filas={sucursal.cajillasHistoricas} />
        </section>
      )}
    </section>
  );
}

export default function RevisionPreparacion({
  documento,
  mostrarResumen = true,
}: {
  documento: DocumentoEditable;
  mostrarResumen?: boolean;
}) {
  const t = useTranslations("preparaciones");
  const [pagina, establecerPagina] = useState(1);
  const sucursales = agruparRevisionPreparacion(documento);
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(sucursales.length / 10)),
  );
  return (
    <div className="space-y-4">
      {mostrarResumen && <ResumenRevisionPreparacion documento={documento} />}
      {!sucursales.length && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("sinAsignaciones")}
        </p>
      )}
      {sucursales
        .slice((paginaActual - 1) * 10, paginaActual * 10)
        .map((sucursal) => (
          <SucursalRevision
            key={sucursal.id}
            sucursal={sucursal}
            documento={documento}
          />
        ))}
      {sucursales.length > 10 && (
        <div aria-label={t("paginacionSucursalesRevision")}>
          <PaginadorCompras
            pagina={paginaActual}
            total={sucursales.length}
            alCambiar={establecerPagina}
          />
        </div>
      )}
      <ConsumoRevisionPreparacion documento={documento} />
    </div>
  );
}
