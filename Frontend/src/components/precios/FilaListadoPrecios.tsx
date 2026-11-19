import { ArrowRight, CalendarDays, Package, Tags } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import EstadoPrecio from "./EstadoPrecio";
import type { AcuerdoPrecio, PermisosPrecios } from "./tipos";

export const columnasListadoPrecios =
  "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,.65fr)_minmax(0,1fr)_10rem]";

export default function FilaListadoPrecios({
  propuesta,
  permisos,
}: {
  propuesta: AcuerdoPrecio;
  permisos?: PermisosPrecios;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const fecha = (valor: string) =>
    new Date(valor + "T12:00:00").toLocaleDateString(idioma, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return (
    <li>
      <Link
        href={"/precios-acordados/" + propuesta.id}
        className={
          "group grid grid-cols-2 items-center gap-x-4 gap-y-4 p-4 hover:bg-brand-25/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 sm:p-5 dark:hover:bg-brand-500/5 " +
          columnasListadoPrecios
        }
      >
        <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Tags className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{propuesta.codigo}</p>
            <p className="mt-0.5 text-sm break-words text-gray-600 dark:text-gray-300">
              {propuesta.cliente_nombre}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("version", { numero: propuesta.numero_version })}
            </p>
            {propuesta.referencia_propuesta && (
              <p className="mt-1 text-xs break-words text-gray-500 dark:text-gray-400">
                {propuesta.referencia_propuesta}
              </p>
            )}
          </div>
        </div>
        <div className="min-w-0 self-start xl:self-center">
          <p className="mb-1.5 text-xs text-gray-500 xl:sr-only dark:text-gray-400">
            {t("periodoListado")}
          </p>
          <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <CalendarDays
              className="mt-0.5 size-4 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <div>
              {propuesta.alcance === "periodo" &&
              propuesta.desde &&
              propuesta.hasta ? (
                <>
                  <time dateTime={propuesta.desde}>
                    {fecha(propuesta.desde)}
                  </time>
                  {propuesta.desde !== propuesta.hasta && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t("hasta")}{" "}
                      <time dateTime={propuesta.hasta}>
                        {fecha(propuesta.hasta)}
                      </time>
                    </p>
                  )}
                </>
              ) : (
                t("alcances." + propuesta.alcance)
              )}
            </div>
          </div>
        </div>
        <div className="self-start xl:self-center">
          <p className="mb-1.5 text-xs text-gray-500 xl:sr-only dark:text-gray-400">
            {t("productosListado")}
          </p>
          <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100/80 px-2.5 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <Package className="size-4 text-gray-400" aria-hidden="true" />
            <span aria-hidden="true">{propuesta.total_productos}</span>
            <span className="sr-only">
              {t("productosAnotados", { total: propuesta.total_productos })}
            </span>
          </span>
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 xl:contents">
          <div className="min-w-0">
            <span className="sr-only">{t("estado")}: </span>
            <EstadoPrecio estado={propuesta.estado} />
            {propuesta.estado === "aceptado" && !propuesta.es_actual && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {t("versionAnterior")}
              </p>
            )}
          </div>
          <span className="inline-flex min-h-11 items-center gap-2 justify-self-end rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-brand-700 shadow-theme-xs group-hover:border-brand-200 group-hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-900 dark:text-brand-300 dark:group-hover:border-brand-800 dark:group-hover:bg-brand-500/10">
            {t(
              propuesta.estado === "borrador" && permisos?.editar
                ? "continuar"
                : propuesta.estado === "propuesta" && permisos?.aceptar
                  ? "revisarPrecios"
                  : "verPropuesta",
            )}
            <ArrowRight
              className="size-4 shrink-0 rtl:rotate-180"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}
