"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { clasePanel } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { Session as Sesion } from "@/components/users/types";
import { claseEnlaceInventario, type MovimientoInventario } from "./tipos";

export default function DetalleMovimiento({
  movimiento,
  sesion,
}: {
  movimiento: MovimientoInventario;
  sesion: Sesion;
}) {
  const t = useTranslations("inventario");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  return (
    <div className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
          {movimiento.codigo}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {t(`tiposMovimiento.${movimiento.tipo}`)}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(
            movimiento.referencia_tipo === "preparacion"
              ? "movimientoPreparacionAyuda"
              : "movimientoAyuda",
          )}
        </p>
        <dl className="my-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["almacen", movimiento.almacen_nombre],
            ["fecha", mostrarFecha(movimiento.fecha, idioma)],
            ["responsable", movimiento.responsable_nombre],
            [
              "creadoEn",
              new Intl.DateTimeFormat(idioma, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/La_Paz",
              }).format(new Date(movimiento.creado_en)),
            ],
          ].map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t(clave)}
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                {valor}
              </dd>
            </div>
          ))}
        </dl>
        {(
          movimiento.referencia_tipo === "preparacion"
            ? sesion.permisos_preparaciones?.ver
            : sesion.permisos_recepciones?.ver
        ) ? (
          <Link
            href={`/${movimiento.referencia_tipo === "preparacion" ? "preparaciones" : "recepciones"}/${movimiento.referencia_id}`}
            className={claseEnlaceInventario}
          >
            {movimiento.referencia_codigo}
          </Link>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("origen")}: {movimiento.referencia_codigo}
          </p>
        )}
      </section>
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
          {t("lotesMovimiento")}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-start text-sm">
            <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                {["lote", "producto", "cantidadMovimiento"].map((clave) => (
                  <th
                    key={clave}
                    scope="col"
                    className="px-4 py-3 text-start font-medium"
                  >
                    {t(clave)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimiento.detalles
                .slice((pagina - 1) * 10, pagina * 10)
                .map((linea) => (
                  <tr
                    key={linea.id}
                    className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      {sesion.permisos_inventario?.ver_lotes ? (
                        <Link
                          href={`/lotes/${linea.lote}`}
                          className="rounded text-brand-600 underline focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                        >
                          {linea.lote_codigo}
                        </Link>
                      ) : (
                        linea.lote_codigo
                      )}
                    </td>
                    <td className="min-w-40 px-4 py-4 font-medium">
                      {linea.producto_nombre}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                      {movimiento.naturaleza === "salida" ? "−" : "+"}
                      {new Intl.NumberFormat(idioma, {
                        maximumFractionDigits: 3,
                      }).format(Number(linea.cantidad))}{" "}
                      {linea.unidad_abreviatura}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <PaginadorCompras
          pagina={pagina}
          total={movimiento.detalles.length}
          alCambiar={establecerPagina}
        />
      </section>
    </div>
  );
}
