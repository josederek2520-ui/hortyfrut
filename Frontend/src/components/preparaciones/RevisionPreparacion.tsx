"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import ImagenProducto from "@/components/productos/ImagenProducto";
import type { DocumentoEditable } from "./tipos";
import { aMiles, deMiles, asignadoLote } from "./calculos";

export default function RevisionPreparacion({
  documento,
}: {
  documento: DocumentoEditable;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [paginaLotes, establecerPaginaLotes] = useState(1);
  const [paginaAsignaciones, establecerPaginaAsignaciones] = useState(1);
  const [paginaCajillas, establecerPaginaCajillas] = useState(1);
  const numero = (valor: string | number) =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(valor),
    );
  const asignaciones = Object.values(documento.asignaciones);
  return (
    <div className="space-y-7">
      <p className="rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
        {t("revisionAyuda")}
      </p>
      <section>
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
          {t("lotesMediciones")}
        </h3>
        {!documento.lineas.length && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("sinLotes")}
          </p>
        )}
        <div className="space-y-3">
          {documento.lineas
            .slice((paginaLotes - 1) * 10, paginaLotes * 10)
            .map((linea) => {
              const asignado = asignadoLote(documento, linea.lote.id);
              const utilizada =
                asignado + aMiles(linea.merma) + aMiles(linea.aprovechable);
              return (
                <article
                  key={linea.lote.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <ImagenProducto origen={linea.lote.producto_imagen || null} nombre={linea.lote.producto_nombre} />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{linea.lote.producto_nombre}</h4>
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{linea.lote.nombre}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {[
                      ["utilizada", deMiles(utilizada)],
                      ["asignadoPedidos", deMiles(asignado)],
                      ["merma", linea.merma || "0"],
                      ["aprovechable", linea.aprovechable || "0"],
                    ].map(([clave, valor]) => (
                      <div key={clave}>
                        <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {t(clave)}
                        </dt>
                        <dd className="mt-1 font-medium text-gray-800 tabular-nums dark:text-gray-100">
                          {numero(valor)} {linea.lote.unidad_abreviatura}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {linea.motivo && (
                    <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                      {linea.motivo}
                    </p>
                  )}
                </article>
              );
            })}
        </div>
        <PaginadorCompras
          pagina={paginaLotes}
          total={documento.lineas.length}
          alCambiar={establecerPaginaLotes}
        />
      </section>
      <section>
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
          {t("repartoSucursal")}
        </h3>
        {!asignaciones.length && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("sinAsignaciones")}
          </p>
        )}
        <div className="space-y-3">
          {asignaciones
            .slice((paginaAsignaciones - 1) * 10, paginaAsignaciones * 10)
            .map((asignacion) => (
              <article
                key={asignacion.clave}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <ImagenProducto origen={asignacion.imagen || null} nombre={asignacion.productoNombre} />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{asignacion.sucursalNombre}</h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{asignacion.productoNombre}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  {asignacion.codigo} · {numero(asignacion.cantidad || "0")}{" "}
                  {asignacion.columna === "cajas" ? "CANT" : "UNI"} ·{" "}
                  {asignacion.presentacion}
                </p>
                <ul className="mt-3 space-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {Object.entries(asignacion.aportes)
                    .filter(([, aporte]) => Number(aporte.cantidad) > 0)
                    .map(([lote, aporte]) => {
                      const linea = documento.lineas.find(
                        (fila) => fila.lote.id === Number(lote),
                      );
                      const peso = linea?.lote.es_kg
                        ? aporte.cantidad
                        : aporte.pesoKg;
                      return (
                        <li key={lote}>
                          {linea?.lote.nombre || t("loteRetirado")} ·{" "}
                          {numero(aporte.cantidad)}{" "}
                          {linea?.lote.unidad_abreviatura} ·{" "}
                          {peso
                            ? t("pesoKgValor", { cantidad: numero(peso) })
                            : t("pesoFaltante")}
                        </li>
                      );
                    })}
                </ul>
                {!asignacion.detalle && (
                  <p className="mt-2 text-sm text-error-500 dark:text-error-400">
                    {t("origenAsignacionCambio")}
                  </p>
                )}
              </article>
            ))}
        </div>
        <PaginadorCompras
          pagina={paginaAsignaciones}
          total={asignaciones.length}
          alCambiar={establecerPaginaAsignaciones}
        />
      </section>
      <section>
        <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
          {t("cajillasPrevistas")}
        </h3>
        <p className="mb-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("cajillasAyuda")}
        </p>
        {documento.cajillas
          .slice((paginaCajillas - 1) * 10, paginaCajillas * 10)
          .map((fila) => (
            <p
              key={fila.clave}
              className="border-b border-gray-100 py-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
            >
              {fila.sucursal.nombre} · {fila.color.nombre} ·{" "}
              {t("cantidadCajillasValor", {
                cantidad: Number(fila.cantidad) || 0,
              })}
            </p>
          ))}
        <PaginadorCompras
          pagina={paginaCajillas}
          total={documento.cajillas.length}
          alCambiar={establecerPaginaCajillas}
        />
      </section>
    </div>
  );
}
