"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight as IconoAbrir,
  MapPin as IconoSucursal,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import EstadoEntrega from "./EstadoEntrega";
import type {
  FilaListadoEntrega as DatosFilaEntrega,
  PermisosEntregas,
} from "./tipos";

export default function FilaListadoEntrega({
  fila,
  permisos,
  oficina,
}: {
  fila: DatosFilaEntrega;
  permisos: PermisosEntregas;
  oficina: boolean;
}) {
  const t = useTranslations("entregas");
  const idioma = useLocale();
  const mostrarFecha = (valor: string, soloFecha = false) =>
    new Date(soloFecha ? valor + "T12:00:00" : valor).toLocaleDateString(
      idioma,
      { day: "numeric", month: "short", year: "numeric" },
    );
  const accion =
    fila.estado === "pendiente" && (fila.acciones?.registrar ?? permisos.crear)
      ? "accionRegistrar"
      : fila.estado === "borrador" && (fila.acciones?.editar ?? permisos.editar)
        ? "accionContinuar"
        : fila.estado === "revision" &&
            oficina &&
            (fila.acciones?.revisar ?? permisos.confirmar)
          ? "accionRevisar"
          : "accionConsultar";
  return (
    <li>
      <Link
        href={`/entregas/${fila.despacho}/${fila.pedido}`}
        className="grid items-center gap-3 px-5 py-4 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_11rem] dark:hover:bg-gray-800"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 sm:flex dark:bg-gray-800 dark:text-gray-300">
            <IconoSucursal className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{fila.sucursal_nombre}</p>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
              {fila.cliente_nombre}
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {fila.codigo_pedido} · {fila.codigo_despacho}
            </p>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 lg:flex-col dark:text-gray-300">
          {fila.fecha_reparto && (
            <div className="flex gap-1">
              <dt>{t("fechaReparto")}:</dt>
              <dd>{mostrarFecha(fila.fecha_reparto, true)}</dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt>{t("fechaDescarga")}:</dt>
            <dd>{mostrarFecha(fila.descargada_en)}</dd>
          </div>
        </dl>
        <div>
          <EstadoEntrega estado={fila.estado} />
        </div>
        <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 lg:justify-end dark:text-brand-300">
          {t(accion)}
          <IconoAbrir
            className="size-4 shrink-0 rtl:rotate-180"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}
