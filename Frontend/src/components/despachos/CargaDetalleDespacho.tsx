"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Paginador from "@/components/compras/PaginadorCompras";
import type { CargaPreparada } from "./tipos";

export default function CargaDetalleDespacho({
  cargas,
}: {
  cargas: CargaPreparada[];
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  return (
    <div className="space-y-4">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {cargas.slice((pagina - 1) * 10, pagina * 10).map((fila) => (
          <div key={fila.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {fila.producto_nombre}
                </h4>
                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {fila.codigo_pedido} · {fila.codigo_preparacion} ·{" "}
                  {fila.presentacion_nombre}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-gray-100">
                {t(
                  fila.columna === "cajas"
                    ? "cajasCargaValor"
                    : "unidadesCargaValor",
                  { cantidad: fila.cantidad },
                )}
                <span className="ms-3 font-normal text-gray-500 dark:text-gray-400">
                  {new Intl.NumberFormat(idioma, {
                    maximumFractionDigits: 3,
                  }).format(Number(fila.peso_kg))}{" "}
                  kg
                </span>
              </p>
            </div>
            <details className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              <summary className="min-h-8 cursor-pointer">
                {t("verLotes", { cantidad: fila.aportes.length })}
              </summary>
              <ul className="space-y-1">
                {fila.aportes.map((aporte) => (
                  <li key={aporte.lote}>
                    {aporte.codigo_lote} ·{" "}
                    {new Intl.NumberFormat(idioma, {
                      maximumFractionDigits: 3,
                    }).format(Number(aporte.cantidad))}{" "}
                    {aporte.unidad} ·{" "}
                    {new Intl.NumberFormat(idioma, {
                      maximumFractionDigits: 3,
                    }).format(Number(aporte.peso_kg))}{" "}
                    kg
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
      {cargas.length > 10 && (
        <Paginador
          pagina={pagina}
          total={cargas.length}
          alCambiar={establecerPagina}
        />
      )}
    </div>
  );
}
