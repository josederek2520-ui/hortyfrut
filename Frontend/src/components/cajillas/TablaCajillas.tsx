"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight as IconoVer } from "lucide-react";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import ColorCajilla from "./ColorCajilla";
import type { Cajilla } from "./tipos";

export default function TablaCajillas({ registros }: { registros: Cajilla[] }) {
  const t = useTranslations("cajillas");
  const idioma = useLocale();
  const numero = (valor: number) => new Intl.NumberFormat(idioma).format(valor);
  const fecha = (valor: string) =>
    new Intl.DateTimeFormat(idioma, {
      dateStyle: "medium",
      timeZone: "America/La_Paz",
    }).format(new Date(valor));
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {registros.map((cajilla) => (
          <article
            key={cajilla.id}
            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <ColorCajilla color={cajilla.color} />
            <dl className="mt-5 grid grid-cols-3 gap-3">
              {["en_almacen", "en_sucursales", "total"].map((clave) => (
                <div key={clave}>
                  <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t(clave)}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 tabular-nums dark:text-white">
                    {numero(cajilla[clave as "total"])}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="my-4 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("creadaEl", { fecha: fecha(cajilla.creado_en) })}
            </p>
            <Link
              href={`/cajillas/${cajilla.id}`}
              className={`${claseEnlaceInventario} w-full`}
            >
              {t("verControl")}
              <IconoVer className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block dark:border-gray-800">
        <table className="w-full text-start text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              {[
                "color",
                "en_almacen",
                "en_sucursales",
                "total",
                "fechaCreacion",
                "acciones",
              ].map((clave) => (
                <th
                  key={clave}
                  scope="col"
                  className="px-4 py-3 text-start font-medium whitespace-nowrap"
                >
                  {t(clave)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.map((cajilla) => (
              <tr
                key={cajilla.id}
                className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
              >
                <td className="min-w-44 px-4 py-4">
                  <Link
                    href={`/cajillas/${cajilla.id}`}
                    className="rounded-xl focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <ColorCajilla color={cajilla.color} />
                  </Link>
                </td>
                {[cajilla.en_almacen, cajilla.en_sucursales, cajilla.total].map(
                  (cantidad, indice) => (
                    <td
                      key={indice}
                      className="px-4 py-4 font-medium tabular-nums"
                    >
                      {numero(cantidad)}
                    </td>
                  ),
                )}
                <td className="px-4 py-4 whitespace-nowrap">
                  {fecha(cajilla.creado_en)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <Link
                    href={`/cajillas/${cajilla.id}`}
                    className={claseEnlaceInventario}
                    aria-label={t("controlColor", { color: cajilla.color })}
                  >
                    {t("verControl")}
                    <IconoVer className="size-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
