"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Eye as IconoVer,
  Pencil as IconoEditar,
  ShoppingCart as IconoCompra,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { mostrarFecha, mostrarImporte } from "./calculos";
import {
  claseAccion,
  claseEstado,
  type ResumenCompra,
  type PermisosCompras,
} from "./tipos";

export default function TablaCompras({
  compras,
  cargando,
  filtrado,
  permisos,
  alCrear,
}: {
  compras: ResumenCompra[];
  cargando: boolean;
  filtrado: boolean;
  permisos: PermisosCompras;
  alCrear: () => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  const acciones = (compra: ResumenCompra) => (
    <div className="flex justify-end gap-1">
      <Link
        href={`/compras/${compra.id}`}
        className={claseAccion}
        title={t("verCompra")}
        aria-label={t("verRegistro", { codigo: compra.codigo })}
      >
        <IconoVer className="size-4.5" aria-hidden="true" />
      </Link>
      {compra.estado === "borrador" && permisos.editar && (
        <Link
          href={`/compras/${compra.id}/editar`}
          className={claseAccion}
          title={t("editar")}
          aria-label={t("editarRegistro", { codigo: compra.codigo })}
        >
          <IconoEditar className="size-4.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
  if (cargando)
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-3">
        {[0, 1, 2, 3].map((indice) => (
          <div
            key={indice}
            className="h-20 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          />
        ))}
      </div>
    );
  if (!compras.length)
    return (
      <div role="status" className="py-12 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <IconoCompra className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {t(filtrado ? "sinResultados" : "vacio")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(filtrado ? "sinResultadosAyuda" : "vacioAyuda")}
        </p>
        {!filtrado && permisos.crear && (
          <Button size="sm" className="mt-5" onClick={alCrear}>
            {t("nuevaCompra")}
          </Button>
        )}
      </div>
    );
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block dark:border-gray-800">
        <table className="w-full text-start text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
            <tr>
              {[
                "compra",
                "fechaPedidos",
                "fechaCompra",
                "totalCompra",
                "estado",
                "acciones",
              ].map((clave) => (
                <th
                  key={clave}
                  scope="col"
                  className={`px-4 py-3.5 font-medium whitespace-nowrap ${clave === "acciones" ? "text-end" : "text-start"}`}
                >
                  {t(clave)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compras.map((compra) => (
              <tr
                key={compra.id}
                className="border-t border-gray-100 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2"
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/compras/${compra.id}`}
                    className="rounded font-semibold text-gray-900 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white dark:hover:text-brand-300"
                  >
                    {compra.codigo}
                  </Link>
                  <p className="mt-1 max-w-48 text-theme-xs break-words text-gray-500 dark:text-gray-400">
                    {compra.responsable_nombre}
                  </p>
                  <p className="mt-1 text-theme-xs text-gray-400 dark:text-gray-500">
                    {t("lineasTotal", { cantidad: compra.cantidad_productos })}
                  </p>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-gray-700 dark:text-gray-200">
                  <time dateTime={compra.fecha_pedidos}>
                    {mostrarFecha(compra.fecha_pedidos, idioma)}
                  </time>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-gray-700 dark:text-gray-200">
                  <time dateTime={compra.fecha_compra}>
                    {mostrarFecha(compra.fecha_compra, idioma)}
                  </time>
                </td>
                <td className="px-4 py-4 font-medium whitespace-nowrap text-gray-800 tabular-nums dark:text-gray-100">
                  {mostrarImporte(compra.total, idioma)}
                </td>
                <td className="px-4 py-4">
                  <span className={claseEstado(compra.estado)}>
                    {t(`estados.${compra.estado}`)}
                  </span>
                </td>
                <td className="px-3 py-4">{acciones(compra)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {compras.map((compra) => (
          <article
            key={compra.id}
            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/compras/${compra.id}`}
                className="rounded text-sm font-semibold text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white"
              >
                {compra.codigo}
              </Link>
              <span className={claseEstado(compra.estado)}>
                {t(`estados.${compra.estado}`)}
              </span>
            </div>
            <p className="mt-2 text-theme-xs break-words text-gray-500 dark:text-gray-400">
              {compra.responsable_nombre}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("fechaPedidos")}
                </dt>
                <dd className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                  {mostrarFecha(compra.fecha_pedidos, idioma)}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("fechaCompra")}
                </dt>
                <dd className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                  {mostrarFecha(compra.fecha_compra, idioma)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("totalCompra")}
                </dt>
                <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                  {mostrarImporte(compra.total, idioma)}
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
              {acciones(compra)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
