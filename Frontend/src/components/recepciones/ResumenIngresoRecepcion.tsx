"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import { mostrarFecha } from "@/components/compras/calculos";
import type { Recepcion } from "./tipos";

export default function ResumenIngresoRecepcion({
  recepcion,
  ocupado,
}: {
  recepcion: Recepcion;
  ocupado: boolean;
}) {
  const t = useTranslations("recepciones");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const numero = (valor: string) =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(valor),
    );
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
        {mostrarFecha(recepcion.fecha_recepcion, idioma)} ·{" "}
        {recepcion.compra_codigo || t("sinCompra")}
      </p>
      <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-start text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
            <tr>
              {["producto", "llegoHoy", "entraraAlAlmacen"].map((campo) => (
                <th
                  scope="col"
                  key={campo}
                  className="px-4 py-3 text-start font-medium"
                >
                  {t(campo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recepcion.detalles
              .slice((pagina - 1) * 10, pagina * 10)
              .map((linea) => (
                <tr
                  key={linea.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <th
                    scope="row"
                    className="min-w-36 px-4 py-3 text-start font-medium text-gray-900 dark:text-white"
                  >
                    {linea.producto_nombre}
                    {linea.proveedor_nombre && (
                      <span className="mt-1 block text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                        {linea.proveedor_nombre}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-3 text-gray-700 tabular-nums dark:text-gray-200">
                    {recepcion.compra
                      ? `${numero(linea.cantidad_compra)} ${linea.medida_compra_nombre}`
                      : "—"}
                  </td>
                  <td className="min-w-36 px-4 py-3 font-medium text-gray-900 tabular-nums dark:text-white">
                    {numero(linea.cantidad_inventario)}{" "}
                    {linea.unidad_abreviatura}
                    {linea.peso_kg && !linea.es_kg && (
                      <span className="mt-1 block text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                        {t("pesoMedido", { cantidad: numero(linea.peso_kg) })}
                      </span>
                    )}
                    {linea.fecha_vencimiento && (
                      <span className="mt-1 block text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                        {t("venceEl", {
                          fecha: mostrarFecha(linea.fecha_vencimiento, idioma),
                        })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <PaginadorCompras
        pagina={pagina}
        total={recepcion.detalles.length}
        ocupado={ocupado}
        alCambiar={establecerPagina}
      />
      {!!recepcion.observaciones.trim() && (
        <p className="text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-300">
          {recepcion.observaciones}
        </p>
      )}
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t("revisionIngresoAyuda")}
      </p>
    </div>
  );
}
