"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeftIcon as IconoVolver,
  PencilIcon as IconoEditar,
} from "@/icons";
import MigasPagina from "@/components/common/PageBreadCrumb";
import ImagenProducto from "./ImagenProducto";
import type { Producto } from "./tipos";

export default function EncabezadoProducto({
  producto,
  editar,
}: {
  producto: Producto;
  editar: boolean;
}) {
  const t = useTranslations("productos");
  const idioma = useLocale();
  return (
    <header className="space-y-5">
      <div>
        <Link
          href="/productos"
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" />
          {t("volver")}
        </Link>
        <MigasPagina pageTitle={t("ficha")} />
      </div>
      <div className="superficie-cristal flex flex-wrap items-start gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 dark:border-gray-800 dark:bg-gray-900">
        <div className="w-20 shrink-0">
          <ImagenProducto
            origen={producto.imagen}
            nombre={producto.nombre}
            grande
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold break-words text-gray-900 dark:text-white">
              {producto.nombre}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-theme-xs font-medium ${producto.activo ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
            >
              {t(producto.activo ? "activo" : "inactivo")}
            </span>
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t("categoria")}
              </dt>
              <dd className="mt-1 font-medium text-gray-700 dark:text-gray-200">
                {producto.categoria.nombre}
              </dd>
            </div>
            <div>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t("unidadMedida")}
              </dt>
              <dd className="mt-1 font-medium text-gray-700 dark:text-gray-200">
                {producto.unidad_medida.nombre} (
                {producto.unidad_medida.abreviatura})
              </dd>
            </div>
            <div>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t("fechaCreacion")}
              </dt>
              <dd className="mt-1 text-gray-700 dark:text-gray-200">
                <time dateTime={producto.creado_en}>
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "medium",
                    timeZone: "America/La_Paz",
                  }).format(new Date(producto.creado_en))}
                </time>
              </dd>
            </div>
          </dl>
        </div>
        {editar && (
          <Link
            href={`/productos/${producto.id}/editar`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <IconoEditar className="size-4" />
            {t("editarDatos")}
          </Link>
        )}
      </div>
    </header>
  );
}
