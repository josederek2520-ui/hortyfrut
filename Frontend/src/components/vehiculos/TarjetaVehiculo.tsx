import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight as IconoAbrir,
  Weight as IconoCapacidad,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { clasePanel } from "@/components/logistica/tipos";
import FotoVehiculo from "./FotoVehiculo";
import EstadoVehiculo from "./EstadoVehiculo";
import { formatearCapacidadToneladas } from "./capacidadVehiculo";
import type { Vehiculo } from "./tipos";

export default function TarjetaVehiculo({ vehiculo }: { vehiculo: Vehiculo }) {
  const t = useTranslations("vehiculos");
  const idioma = useLocale();
  const capacidad = formatearCapacidadToneladas(vehiculo.capacidad_kg, idioma);
  return (
    <Link
      href={`/vehiculos/${vehiculo.id}`}
      className={`${clasePanel} group flex min-w-0 flex-col p-2 transition-[border-color,box-shadow] duration-200 outline-none hover:border-brand-300 hover:shadow-theme-md focus-visible:ring-3 focus-visible:ring-brand-400 motion-reduce:transition-none dark:hover:border-brand-600`}
    >
      <FotoVehiculo imagen={vehiculo.imagen} placa={vehiculo.placa} />
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl leading-tight font-semibold break-all text-gray-900 dark:text-white">
            {vehiculo.placa}
          </h2>
          <EstadoVehiculo activo={vehiculo.activo} />
        </div>
        <p className="mt-2 text-sm break-words text-gray-600 dark:text-gray-300">
          {[vehiculo.tipo, vehiculo.marca].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-5 flex flex-1 flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div>
            <p className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              <IconoCapacidad className="size-3.5" aria-hidden="true" />
              {t("capacidad")}
            </p>
            <p
              className={`mt-1 font-semibold tabular-nums ${capacidad ? "text-lg text-gray-900 dark:text-white" : "text-sm text-gray-500 dark:text-gray-400"}`}
            >
              {capacidad || t("sinCapacidad")}
            </p>
          </div>
          <span className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-brand-700 group-hover:text-brand-800 dark:text-brand-300 dark:group-hover:text-brand-200">
            {t("verFicha")}
            <IconoAbrir className="size-4 rtl:rotate-180" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
