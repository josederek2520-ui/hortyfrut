"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  Store as IconoProveedor,
  Pencil as IconoEditar,
  Power as IconoEstado,
  Phone as IconoTelefono,
  MapPin as IconoDireccion,
  CalendarDays as IconoFecha,
  Tags as IconoCategoria,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import { clasePanel, claseEstado, type Proveedor } from "./tipos";

export default function DetalleProveedor({
  proveedor,
  permisos,
  alEstado,
}: {
  proveedor: Proveedor;
  permisos: PermisosCatalogo;
  alEstado: () => void;
}) {
  const t = useTranslations("proveedores");
  const idioma = useLocale();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/proveedores"
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
              <IconoProveedor className="size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold break-words text-gray-900 sm:text-2xl dark:text-white">
                {proveedor.nombre}
              </h2>
              <span className={`${claseEstado(proveedor.activo)} mt-2`}>
                {t(proveedor.activo ? "activo" : "inactivo")}
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
                {t(proveedor.activo ? "desactivar" : "activar")}
              </Button>
            )}
            {permisos.editar && (
              <Link
                href={`/proveedores/${proveedor.id}/editar`}
                className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                <IconoEditar className="size-4" aria-hidden="true" />
                {t("editar")}
              </Link>
            )}
          </div>
        </div>
        <dl className="grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex gap-3">
            <IconoCategoria
              className="mt-0.5 size-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("categoria")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                {proveedor.categoria?.nombre || t("sinCategoria")}
                {proveedor.categoria && !proveedor.categoria.activo && (
                  <span className="mt-1 block text-theme-xs font-normal text-warning-600 dark:text-warning-400">
                    {t("categoriaInactiva")}
                  </span>
                )}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <IconoTelefono
              className="mt-0.5 size-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("telefono")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                {proveedor.telefono ? (
                  <a
                    href={`tel:${proveedor.telefono}`}
                    className="rounded hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-brand-300"
                  >
                    {proveedor.telefono}
                  </a>
                ) : (
                  t("sinTelefono")
                )}
              </dd>
            </div>
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <IconoDireccion
              className="mt-0.5 size-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("direccion")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                {proveedor.direccion || t("sinDireccion")}
              </dd>
            </div>
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <IconoFecha
              className="mt-0.5 size-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("fechaCreacion")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                <time dateTime={proveedor.creado_en}>
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/La_Paz",
                  }).format(new Date(proveedor.creado_en))}
                </time>
              </dd>
            </div>
          </div>
        </dl>
      </section>
    </div>
  );
}
