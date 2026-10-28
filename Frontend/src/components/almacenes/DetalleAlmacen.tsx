"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  Warehouse as IconoAlmacen,
  Pencil as IconoEditar,
  Power as IconoEstado,
  MapPin as IconoUbicacion,
  CalendarDays as IconoFecha,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import UbicacionAlmacen from "./UbicacionAlmacen";
import { clasePanel, claseEstado, type Almacen } from "./tipos";

export default function DetalleAlmacen({
  almacen,
  permisos,
  alEstado,
}: {
  almacen: Almacen;
  permisos: PermisosCatalogo;
  alEstado: () => void;
}) {
  const t = useTranslations("almacenes"),
    idioma = useLocale();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/almacenes"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4" aria-hidden="true" />
          {t("volver")}
        </Link>
        <MigasPagina pageTitle={t("detalle")} />
      </div>
      <section className={`${clasePanel} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-gray-100 p-6 sm:p-8 dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <IconoAlmacen className="size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold break-words text-gray-900 sm:text-2xl dark:text-white">
                {almacen.nombre}
              </h2>
              <span className={`${claseEstado(almacen.activo)} mt-2`}>
                {t(almacen.activo ? "activo" : "inactivo")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {permisos.cambiar_estado && (
              <Button
                size="sm"
                variant="outline"
                startIcon={<IconoEstado className="size-4" />}
                onClick={alEstado}
              >
                {t(almacen.activo ? "desactivar" : "activar")}
              </Button>
            )}
            {permisos.editar && (
              <Link
                href={`/almacenes/${almacen.id}/editar`}
                className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                <IconoEditar className="size-4" aria-hidden="true" />
                {t("editar")}
              </Link>
            )}
          </div>
        </div>
        <dl className="grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex gap-3 sm:col-span-2">
            <IconoUbicacion
              className="mt-0.5 size-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("direccion")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                {almacen.direccion}
              </dd>
            </div>
          </div>
          <div>
            <dt className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {t("ubicacionGeografica")}
            </dt>
            <dd>
              <UbicacionAlmacen
                nombre={almacen.nombre}
                latitud={almacen.latitud}
                longitud={almacen.longitud}
              />
            </dd>
          </div>
          <div className="flex gap-3">
            <IconoFecha
              className="mt-0.5 size-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("fechaCreacion")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                <time dateTime={almacen.creado_en}>
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/La_Paz",
                  }).format(new Date(almacen.creado_en))}
                </time>
              </dd>
            </div>
          </div>
        </dl>
      </section>
    </div>
  );
}
