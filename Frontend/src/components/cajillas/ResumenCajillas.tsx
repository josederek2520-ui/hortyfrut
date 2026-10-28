"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Warehouse as IconoAlmacen,
  Store as IconoSucursal,
  Container as IconoCajilla,
} from "lucide-react";
import type { ResumenCajillas as DatosResumen } from "./tipos";

export default function ResumenCajillas({
  resumen,
}: {
  resumen?: DatosResumen | null;
}) {
  const t = useTranslations("cajillas");
  const idioma = useLocale();
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {[
        { clave: "en_almacen", Icono: IconoAlmacen, ayuda: "disponiblesAyuda" },
        {
          clave: "en_sucursales",
          Icono: IconoSucursal,
          ayuda: "prestadasAyuda",
        },
        { clave: "total", Icono: IconoCajilla, ayuda: "totalAyuda" },
      ].map(({ clave, Icono, ayuda }) => (
        <div
          key={clave}
          className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <dt className="flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
            {t(clave)}
            <span
              className={`rounded-lg p-2 ${clave === "en_sucursales" ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"}`}
            >
              <Icono className="size-5" aria-hidden="true" />
            </span>
          </dt>
          <dd className="mt-3 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {resumen
              ? new Intl.NumberFormat(idioma).format(
                  resumen[clave as keyof DatosResumen] || 0,
                )
              : "—"}
          </dd>
          <p className="mt-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t(ayuda)}
          </p>
        </div>
      ))}
    </dl>
  );
}
