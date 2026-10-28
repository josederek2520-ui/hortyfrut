"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check as IconoConfirmar, Pencil as IconoEditar } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import { clasePanel, claseEstado } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import type { Session as Sesion } from "@/components/users/types";
import type { Recepcion } from "./tipos";

export default function DetalleRecepcion({
  recepcion,
  sesion,
  alAccion,
}: {
  recepcion: Recepcion;
  sesion: Sesion;
  alAccion: (accion: "confirmar" | "cancelar") => void;
}) {
  const t = useTranslations("recepciones");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const permisos = sesion.permisos_recepciones;
  const lista =
    recepcion.detalles.length > 0 &&
    recepcion.detalles.every(
      (linea) =>
        Number(linea.cantidad_inventario) > 0 &&
        (!recepcion.compra || Number(linea.cantidad_compra) > 0),
    );
  const numero = (valor: string) =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(valor),
    );
  return (
    <div className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {recepcion.codigo}
              </h2>
              <span
                className={claseEstado(
                  recepcion.estado === "confirmada"
                    ? "registrada"
                    : recepcion.estado,
                )}
              >
                {t(`estados.${recepcion.estado}`)}
              </span>
            </div>
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("creadaEl", {
                fecha: new Intl.DateTimeFormat(idioma, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/La_Paz",
                }).format(new Date(recepcion.creado_en)),
              })}
            </p>
          </div>
          {recepcion.estado === "borrador" && (
            <div className="flex flex-wrap gap-3">
              {permisos.cancelar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => alAccion("cancelar")}
                >
                  {t("cancelarBorrador")}
                </Button>
              )}
              {permisos.editar && (
                <Link
                  href={`/recepciones/${recepcion.id}/editar`}
                  className={claseEnlaceInventario}
                >
                  <IconoEditar className="size-4" aria-hidden="true" />
                  {t("editar")}
                </Link>
              )}
              {permisos.confirmar && (
                <Button
                  size="sm"
                  disabled={!lista}
                  startIcon={<IconoConfirmar className="size-4" />}
                  onClick={() => alAccion("confirmar")}
                >
                  {t("confirmarIngreso")}
                </Button>
              )}
            </div>
          )}
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["almacen", recepcion.almacen_nombre],
            ["fechaRecepcion", mostrarFecha(recepcion.fecha_recepcion, idioma)],
            ["responsable", recepcion.responsable_nombre],
            ["origen", recepcion.compra_codigo || t("ingresoDirecto")],
          ].map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t(clave)}
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                {valor}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
          {t(
            recepcion.estado === "confirmada"
              ? "confirmadaAyuda"
              : recepcion.estado === "cancelada"
                ? "canceladaAyuda"
                : lista
                  ? "listaAyuda"
                  : "completarAyuda",
          )}
        </p>
        {recepcion.observaciones && (
          <p className="mt-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {recepcion.observaciones}
          </p>
        )}
        {recepcion.motivo_cancelacion && (
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
            {t("motivo")}: {recepcion.motivo_cancelacion}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {recepcion.compra && sesion.permisos_compras?.ver && (
            <Link
              href={`/compras/${recepcion.compra}`}
              className={claseEnlaceInventario}
            >
              {recepcion.compra_codigo}
            </Link>
          )}
          {recepcion.movimiento &&
            sesion.permisos_inventario?.ver_movimientos && (
              <Link
                href={`/movimientos-inventario/${recepcion.movimiento}`}
                className={claseEnlaceInventario}
              >
                {recepcion.movimiento_codigo}
              </Link>
            )}
        </div>
      </section>
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">
          {t("productosRecibidos")}
        </h2>
        {!recepcion.detalles.length ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("sinProductos")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-start text-sm">
              <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  {[
                    "producto",
                    ...(recepcion.compra ? ["cantidadCompra"] : []),
                    "cantidadInventario",
                    "pesoKg",
                    "vencimiento",
                    "lote",
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
                {recepcion.detalles
                  .slice((pagina - 1) * 10, pagina * 10)
                  .map((linea) => (
                    <tr
                      key={linea.id}
                      className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                    >
                      <td className="min-w-40 px-4 py-4 font-medium">
                        {linea.producto_nombre}
                      </td>
                      {recepcion.compra && (
                        <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                          {numero(linea.cantidad_compra)}{" "}
                          {linea.medida_compra_nombre}
                        </td>
                      )}
                      <td className="px-4 py-4 font-medium whitespace-nowrap tabular-nums">
                        {numero(linea.cantidad_inventario)}{" "}
                        {linea.unidad_abreviatura}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                        {linea.peso_kg ? `${numero(linea.peso_kg)} kg` : "—"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {linea.fecha_vencimiento
                          ? mostrarFecha(linea.fecha_vencimiento, idioma)
                          : "—"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {linea.lote && sesion.permisos_inventario?.ver_lotes ? (
                          <Link
                            href={`/lotes/${linea.lote}`}
                            className="rounded text-brand-600 underline focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                          >
                            {linea.lote_codigo}
                          </Link>
                        ) : (
                          linea.lote_codigo || "—"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginadorCompras
          pagina={pagina}
          total={recepcion.detalles.length}
          alCambiar={establecerPagina}
        />
      </section>
    </div>
  );
}
