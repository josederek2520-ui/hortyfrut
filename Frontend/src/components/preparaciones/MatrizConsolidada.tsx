"use client";
import { useLocale, useTranslations } from "next-intl";
import type { HojaConsolidada } from "./tipos";
import ImagenProducto from "@/components/productos/ImagenProducto";

export default function MatrizConsolidada({
  hoja,
  vista,
}: {
  hoja: HojaConsolidada;
  vista: "solicitado" | "pendiente";
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const numero = (valor = 0) => new Intl.NumberFormat(idioma).format(valor);
  const medida = vista === "solicitado" ? "solicitada" : "pendiente";
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full border-separate border-spacing-0 text-start text-sm">
        <caption className="sr-only">{t("matrizAyuda")}</caption>
        <thead>
          <tr className="text-theme-xs text-gray-500 dark:text-gray-400">
            <th
              rowSpan={2}
              scope="col"
              className="sticky start-0 z-1 min-w-40 border-b border-gray-200 bg-gray-50 px-4 py-3 text-start font-medium dark:border-gray-700 dark:bg-gray-900"
            >
              {t("producto")}
            </th>
            {hoja.sucursales.results.map((sucursal) => (
              <th
                key={sucursal.id}
                scope="colgroup"
                colSpan={2}
                className="min-w-32 border-s border-b border-gray-200 bg-gray-50 px-3 py-3 text-center font-medium dark:border-gray-700 dark:bg-gray-900"
              >
                {sucursal.nombre}
                {sucursal.activo === false && (
                  <span className="block text-warning-700 dark:text-warning-400">
                    {t("inactiva")}
                  </span>
                )}
              </th>
            ))}
            <th
              colSpan={2}
              scope="colgroup"
              className="min-w-32 border-s border-b border-brand-200 bg-brand-50 px-3 py-3 text-center font-semibold text-brand-800 dark:border-brand-800 dark:bg-gray-900 dark:text-brand-300"
            >
              {t("totalCliente")}
            </th>
          </tr>
          <tr className="text-theme-xs text-gray-500 dark:text-gray-400">
            {hoja.sucursales.results.map((sucursal) => (
              <FragmentoMedidas key={sucursal.id} />
            ))}
            <th
              scope="col"
              className="border-b border-brand-200 bg-brand-50 px-3 py-2 text-center dark:border-brand-800 dark:bg-gray-900"
            >
              CANT
            </th>
            <th
              scope="col"
              className="border-b border-brand-200 bg-brand-50 px-3 py-2 text-center dark:border-brand-800 dark:bg-gray-900"
            >
              UNI
            </th>
          </tr>
        </thead>
        <tbody>
          {hoja.results.map((producto) => (
            <tr key={producto.id} className="text-gray-700 dark:text-gray-200">
              <th
                scope="row"
                className="sticky start-0 z-1 border-b border-gray-100 bg-white px-4 py-4 text-start font-medium dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3">
                  <ImagenProducto
                    origen={producto.imagen || null}
                    nombre={producto.nombre}
                  />
                  <div>
                    <p>{producto.nombre}</p>
                    <p className="mt-1 text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                      {producto.categoria}
                    </p>
                  </div>
                </div>
              </th>
              {hoja.sucursales.results.map((sucursal) => (
                <FragmentoCantidades
                  key={sucursal.id}
                  cajas={
                    producto.sucursales[String(sucursal.id)]?.cajas?.[medida] ||
                    0
                  }
                  unidades={
                    producto.sucursales[String(sucursal.id)]?.unidades?.[
                      medida
                    ] || 0
                  }
                  numero={numero}
                />
              ))}
              <td className="border-s border-b border-brand-100 bg-brand-50/70 px-3 py-4 text-center font-semibold tabular-nums dark:border-brand-900 dark:bg-brand-500/10">
                {numero(
                  vista === "solicitado"
                    ? producto.cajas
                    : producto.pendientes_cajas,
                )}
              </td>
              <td className="border-b border-brand-100 bg-brand-50/70 px-3 py-4 text-center font-semibold tabular-nums dark:border-brand-900 dark:bg-brand-500/10">
                {numero(
                  vista === "solicitado"
                    ? producto.unidades
                    : producto.pendientes_unidades,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function FragmentoMedidas() {
  return (
    <>
      <th
        scope="col"
        className="border-s border-b border-gray-200 bg-gray-50 px-3 py-2 text-center font-medium dark:border-gray-700 dark:bg-gray-900"
      >
        CANT
      </th>
      <th
        scope="col"
        className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-center font-medium dark:border-gray-700 dark:bg-gray-900"
      >
        UNI
      </th>
    </>
  );
}
function FragmentoCantidades({
  cajas,
  unidades,
  numero,
}: {
  cajas: number;
  unidades: number;
  numero: (valor: number) => string;
}) {
  return (
    <>
      <td className="border-s border-b border-gray-100 px-3 py-4 text-center tabular-nums dark:border-gray-800">
        {cajas ? numero(cajas) : "—"}
      </td>
      <td className="border-b border-gray-100 px-3 py-4 text-center tabular-nums dark:border-gray-800">
        {unidades ? numero(unidades) : "—"}
      </td>
    </>
  );
}
