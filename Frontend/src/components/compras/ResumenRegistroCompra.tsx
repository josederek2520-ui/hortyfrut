"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PaginadorCompras from "./PaginadorCompras";
import { mostrarFecha, mostrarImporte } from "./calculos";
import type { Compra } from "./tipos";

export default function ResumenRegistroCompra({
  compra,
  ocupado,
}: {
  compra: Compra;
  ocupado: boolean;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("fechaPedidos")}
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {mostrarFecha(compra.fecha_pedidos, idioma)}
            </dd>
          </div>
          <div>
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("fechaCompra")}
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
              {mostrarFecha(compra.fecha_compra, idioma)}
            </dd>
          </div>
        </dl>
        <div className="text-start sm:text-end">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("totalCompra")}
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {mostrarImporte(compra.total, idioma)}
          </p>
        </div>
      </div>
      <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-start text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
            <tr>
              {[
                "producto",
                "proveedor",
                "presentacionCompra",
                "cantidadCorta",
                "precioCorto",
                "subtotal",
              ].map((campo) => (
                <th
                  key={campo}
                  scope="col"
                  className="px-3 py-3 text-start font-medium whitespace-nowrap"
                >
                  {t(campo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compra.detalles
              .slice((pagina - 1) * 10, pagina * 10)
              .map((linea) => (
                <tr
                  key={linea.id}
                  className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                >
                  <th
                    scope="row"
                    className="min-w-28 px-3 py-3 text-start font-medium text-gray-900 dark:text-white"
                  >
                    {linea.producto_nombre}
                  </th>
                  <td className="min-w-28 px-3 py-3">
                    {linea.proveedor_nombre || "—"}
                  </td>
                  <td className="px-3 py-3">
                    {linea.presentacion_nombre || linea.unidad_nombre}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {new Intl.NumberFormat(idioma, {
                      maximumFractionDigits: 3,
                    }).format(Number(linea.cantidad))}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                    {mostrarImporte(linea.precio_unitario, idioma)}
                  </td>
                  <td className="px-3 py-3 font-medium whitespace-nowrap tabular-nums">
                    {mostrarImporte(linea.subtotal, idioma)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <PaginadorCompras
        pagina={pagina}
        total={compra.detalles.length}
        alCambiar={establecerPagina}
        ocupado={ocupado}
      />
      <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
        {t("compraRegistradaAyuda")}
      </p>
    </div>
  );
}
