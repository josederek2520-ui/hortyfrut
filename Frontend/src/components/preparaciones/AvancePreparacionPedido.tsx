"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LineaPedido } from "@/components/pedidos/tipos";
import { clasePanel } from "@/components/compras/tipos";
import PaginadorCompras from "@/components/compras/PaginadorCompras";

export default function AvancePreparacionPedido({
  detalles,
}: {
  detalles: LineaPedido[];
}) {
  const t = useTranslations("preparaciones");
  const [pagina, establecerPagina] = useState(1);
  return (
    <section className={`${clasePanel} space-y-4 p-5 sm:p-6`}>
      <h3 className="font-semibold text-gray-900 dark:text-white">
        {t("avancePedido")}
      </h3>
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t("pedidoBloqueado")}
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-start text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              {[
                "producto",
                "medidaPedido",
                "solicitado",
                "preparado",
                "pendiente",
              ].map((clave) => (
                <th
                  scope="col"
                  key={clave}
                  className="px-4 py-3 text-start font-medium"
                >
                  {t(clave)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detalles.slice((pagina - 1) * 10, pagina * 10).map((linea) => (
              <tr
                key={linea.id}
                className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
              >
                <td className="px-4 py-3 font-medium">
                  {linea.producto_nombre}
                </td>
                <td className="px-4 py-3">
                  {linea.columna === "cajas" ? "CANT" : "UNI"} ·{" "}
                  {linea.presentacion_nombre}
                </td>
                <td className="px-4 py-3 tabular-nums">{linea.cantidad}</td>
                <td className="px-4 py-3 tabular-nums">
                  {linea.cantidad_preparada}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {linea.cantidad_pendiente}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginadorCompras
        pagina={pagina}
        total={detalles.length}
        alCambiar={establecerPagina}
      />
    </section>
  );
}
