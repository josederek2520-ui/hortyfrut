import { useLocale, useTranslations } from "next-intl";
import {
  Pencil as IconoEditar,
  Power as IconoEstado,
  Weight as IconoCapacidad,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { clasePanel } from "@/components/logistica/tipos";
import FotoVehiculo from "./FotoVehiculo";
import EstadoVehiculo from "./EstadoVehiculo";
import { formatearCapacidadToneladas } from "./capacidadVehiculo";
import type { Vehiculo } from "./tipos";

export default function DetalleVehiculo({
  vehiculo,
  puedeEditar,
  puedeCambiarEstado,
  alCambiarEstado,
}: {
  vehiculo: Vehiculo;
  puedeEditar: boolean;
  puedeCambiarEstado: boolean;
  alCambiarEstado: () => void;
}) {
  const t = useTranslations("vehiculos");
  const comun = useTranslations("logistica");
  const idioma = useLocale();
  const capacidad = formatearCapacidadToneladas(vehiculo.capacidad_kg, idioma);
  return (
    <section
      className={`${clasePanel} overflow-hidden`}
      aria-labelledby="placa-vehiculo"
    >
      <div className="grid lg:grid-cols-5">
        <div className="flex items-center p-3 sm:p-5 lg:col-span-2">
          <FotoVehiculo
            imagen={vehiculo.imagen}
            placa={vehiculo.placa}
            amplia
          />
        </div>
        <div className="p-5 pt-2 sm:p-8 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                {t("placa")}
              </p>
              <h2
                id="placa-vehiculo"
                className="mt-1 text-3xl leading-tight font-semibold tracking-tight break-all text-gray-900 dark:text-white"
              >
                {vehiculo.placa}
              </h2>
              <p className="mt-2 text-sm break-words text-gray-600 dark:text-gray-300">
                {[vehiculo.tipo, vehiculo.marca].filter(Boolean).join(" · ")}
              </p>
            </div>
            <EstadoVehiculo activo={vehiculo.activo} />
          </div>
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-theme-xs dark:bg-brand-500/10 dark:text-brand-300">
              <IconoCapacidad className="size-5" aria-hidden="true" />
            </span>
            <dl className="min-w-0">
              <dt className="text-theme-xs text-brand-800 dark:text-brand-200">
                {t("capacidad")}
              </dt>
              <dd
                className={`mt-1 font-semibold break-words text-gray-900 tabular-nums dark:text-white ${capacidad ? "text-2xl leading-tight tracking-tight" : "text-sm"}`}
              >
                {capacidad || t("sinCapacidad")}
              </dd>
            </dl>
            {capacidad && (
              <span className="ms-auto hidden text-theme-xs text-brand-800 sm:inline dark:text-brand-200">
                {t("toneladas")}
              </span>
            )}
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            {[
              [comun("responsable"), vehiculo.responsable_nombre || "—"],
              [
                comun("creado"),
                new Intl.DateTimeFormat(idioma, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/La_Paz",
                }).format(new Date(vehiculo.creado_en)),
              ],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {etiqueta}
                </dt>
                <dd className="mt-1 text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {(puedeEditar || puedeCambiarEstado) && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-5 py-4 sm:px-8 dark:border-gray-800">
          {puedeCambiarEstado && (
            <Button
              size="sm"
              variant="outline"
              onClick={alCambiarEstado}
              startIcon={<IconoEstado className="size-4" aria-hidden="true" />}
            >
              {t(vehiculo.activo ? "desactivar" : "activar")}
            </Button>
          )}
          {puedeEditar && (
            <Link
              href={`/vehiculos/${vehiculo.id}/editar`}
              className="boton-principal-hortyfru inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-400"
            >
              <IconoEditar className="size-4" aria-hidden="true" />
              {t("editar")}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
