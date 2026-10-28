"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  Pencil as IconoEditar,
  Check as IconoRegistrar,
  CalendarDays as IconoFecha,
  UserRound as IconoUsuario,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "./PaginadorCompras";
import { mostrarFecha, mostrarImporte } from "./calculos";
import {
  clasePanel,
  claseEstado,
  type Compra,
  type PermisosCompras,
} from "./tipos";

export default function DetalleCompra({
  compra,
  permisos,
  permisosRecepciones,
  alAccion,
}: {
  compra: Compra;
  permisos: PermisosCompras;
  permisosRecepciones?: import("@/components/recepciones/tipos").PermisosRecepciones;
  alAccion: (accion: "registrar" | "cancelar") => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  const [vista, establecerVista] = useState<"productos" | "pedidos">(
    "productos",
  );
  const [pagina, establecerPagina] = useState(1);
  const referencias = compra.pedidos_referencia.flatMap((pedido) =>
    pedido.detalles.map((linea) => ({ ...linea, pedido })),
  );
  const lista =
    compra.detalles.length > 0 &&
    compra.detalles.every(
      (linea) =>
        !!linea.proveedor &&
        Number(linea.cantidad) > 0 &&
        Number(linea.precio_unitario) > 0,
    );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/compras"
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4" aria-hidden="true" />
          {t("volver")}
        </Link>
        <MigasPagina pageTitle={compra.codigo} />
      </div>
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("detalleCompra")}
              </h2>
              <span className={claseEstado(compra.estado)}>
                {t(`estados.${compra.estado}`)}
              </span>
            </div>
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("creadaEl", {
                fecha: new Intl.DateTimeFormat(idioma, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/La_Paz",
                }).format(new Date(compra.creado_en)),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {compra.estado !== "cancelada" && permisos.cancelar && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => alAccion("cancelar")}
                disabled={compra.tiene_recepciones_activas}
              >
                {t("cancelarCompra")}
              </Button>
            )}
            {compra.estado === "borrador" && permisos.editar && (
              <Link
                href={`/compras/${compra.id}/editar`}
                className="boton-secundario-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-gray-300 focus-visible:ring-3 focus-visible:ring-brand-400 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
              >
                <IconoEditar className="size-4" aria-hidden="true" />
                {t("editar")}
              </Link>
            )}
            {compra.estado === "borrador" && permisos.registrar && (
              <Button
                size="sm"
                startIcon={<IconoRegistrar className="size-4" />}
                disabled={!lista}
                onClick={() => alAccion("registrar")}
              >
                {t("registrarCompra")}
              </Button>
            )}
          </div>
        </div>
        {compra.estado === "registrada" && permisosRecepciones?.ver && (
          <div className="mt-5 flex flex-wrap gap-3">
            {permisosRecepciones.crear &&
              compra.detalles.some(
                (linea) => Number(linea.cantidad_pendiente) > 0,
              ) && (
                <Link
                  href={`/recepciones/nuevo?compra=${compra.id}`}
                  className="boton-principal-hortyfru inline-flex min-h-11 items-center rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
                >
                  {t("registrarRecepcion")}
                </Link>
              )}
            <Link
              href={`/recepciones?compra=${compra.id}`}
              className="inline-flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-medium text-brand-700 ring-1 ring-brand-200 focus-visible:ring-3 focus-visible:ring-brand-400 dark:text-brand-300 dark:ring-brand-800"
            >
              {t("verRecepciones")}
            </Link>
          </div>
        )}
        {compra.tiene_recepciones_activas && (
          <p className="mt-4 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("compraConRecepciones")}
          </p>
        )}
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              etiqueta: "fechaPedidos",
              valor: mostrarFecha(compra.fecha_pedidos, idioma),
              Icono: IconoFecha,
            },
            {
              etiqueta: "fechaCompra",
              valor: mostrarFecha(compra.fecha_compra, idioma),
              Icono: IconoFecha,
            },
            {
              etiqueta: "responsable",
              valor: compra.responsable_nombre,
              Icono: IconoUsuario,
            },
          ].map(({ etiqueta, valor, Icono }) => (
            <div
              key={etiqueta}
              className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <dt className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
                <Icono className="size-4 shrink-0" aria-hidden="true" />
                {t(etiqueta)}
              </dt>
              <dd className="mt-2 text-sm font-semibold break-words text-gray-900 dark:text-white">
                {valor}
              </dd>
            </div>
          ))}
          <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-500/10">
            <dt className="text-theme-xs text-brand-600 dark:text-brand-400">
              {t("totalCompra")}
            </dt>
            <dd className="mt-2 text-xl font-semibold text-brand-800 tabular-nums dark:text-brand-200">
              {mostrarImporte(compra.total, idioma)}
            </dd>
          </div>
        </dl>
        {compra.estado === "borrador" && !lista && (
          <p className="mt-5 rounded-xl bg-warning-50 p-4 text-sm leading-6 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
            {t("borradorIncompleto")}
          </p>
        )}
        {compra.estado === "registrada" && (
          <p className="mt-5 rounded-xl bg-success-50 p-4 text-sm leading-6 text-success-700 dark:bg-success-500/10 dark:text-success-400">
            {t("compraRegistradaAyuda")}
          </p>
        )}
        {compra.estado === "cancelada" && (
          <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {t("motivoCancelacion")}
            </p>
            <p className="mt-2 text-sm break-words whitespace-pre-wrap text-gray-600 dark:text-gray-300">
              {compra.motivo_cancelacion}
            </p>
          </div>
        )}
        {compra.observaciones && (
          <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("observaciones")}
            </p>
            <p className="mt-2 text-sm break-words whitespace-pre-wrap text-gray-700 dark:text-gray-200">
              {compra.observaciones}
            </p>
          </div>
        )}
      </section>
      <section className={`${clasePanel} space-y-5 p-5 sm:p-6`}>
        <div
          role="group"
          aria-label={t("detalleCompra")}
          className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
        >
          {(["productos", "pedidos"] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              aria-pressed={vista === valor}
              onClick={() => {
                establecerVista(valor);
                establecerPagina(1);
              }}
              className={`pestana-hortyfru min-h-10 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand-400 ${vista === valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
            >
              {t(
                valor === "productos" ? "productosCompra" : "pedidosReferencia",
              )}
            </button>
          ))}
        </div>
        {vista === "productos" ? (
          compra.detalles.length ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-start text-sm">
                <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  <tr>
                    {[
                      "producto",
                      "proveedor",
                      "presentacionCompra",
                      "cantidadComprada",
                      "cantidadRecibida",
                      "cantidadPendiente",
                      "precioUnitario",
                      "subtotal",
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
                  {compra.detalles
                    .slice((pagina - 1) * 10, pagina * 10)
                    .map((linea) => (
                      <tr
                        key={linea.id}
                        className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                      >
                        <td className="min-w-36 px-4 py-4 font-medium break-words">
                          {linea.producto_nombre}
                        </td>
                        <td className="min-w-36 px-4 py-4 break-words">
                          {linea.proveedor_nombre || t("sinProveedor")}
                        </td>
                        <td className="px-4 py-4 break-words">
                          {linea.presentacion_nombre || linea.unidad_nombre}
                        </td>
                        <td className="px-4 py-4 tabular-nums">
                          {new Intl.NumberFormat(idioma, {
                            maximumFractionDigits: 3,
                          }).format(Number(linea.cantidad))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                          {new Intl.NumberFormat(idioma, {
                            maximumFractionDigits: 3,
                          }).format(Number(linea.cantidad_recibida))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                          {new Intl.NumberFormat(idioma, {
                            maximumFractionDigits: 3,
                          }).format(Number(linea.cantidad_pendiente))}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                          {mostrarImporte(linea.precio_unitario, idioma)}
                        </td>
                        <td className="px-4 py-4 font-medium whitespace-nowrap tabular-nums">
                          {mostrarImporte(linea.subtotal, idioma)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("sinProductosCompra")}
            </p>
          )
        ) : (
          <>
            <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("referenciasAyuda")}
            </p>
            {referencias.length ? (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-start text-sm">
                  <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                    <tr>
                      {["pedidoSucursal", "producto", "cajas", "unidades"].map(
                        (clave) => (
                          <th
                            key={clave}
                            scope="col"
                            className="px-4 py-3 text-start font-medium whitespace-nowrap"
                          >
                            {t(clave)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {referencias
                      .slice((pagina - 1) * 10, pagina * 10)
                      .map((linea) => (
                        <tr
                          key={linea.detalle_pedido}
                          className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                        >
                          <td className="min-w-44 px-4 py-4">
                            <p className="font-medium">{linea.pedido.codigo}</p>
                            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                              {linea.pedido.cliente_nombre} ·{" "}
                              {linea.pedido.sucursal_nombre}
                            </p>
                          </td>
                          <td className="min-w-36 px-4 py-4">
                            <p>{linea.producto_nombre}</p>
                            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                              {linea.presentacion_nombre}
                            </p>
                          </td>
                          <td className="px-4 py-4 tabular-nums">
                            {linea.columna === "cajas" ? linea.cantidad : "—"}
                          </td>
                          <td className="px-4 py-4 tabular-nums">
                            {linea.columna === "unidades"
                              ? linea.cantidad
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t("sinReferencias")}
              </p>
            )}
          </>
        )}
        <PaginadorCompras
          pagina={pagina}
          total={
            vista === "productos" ? compra.detalles.length : referencias.length
          }
          alCambiar={establecerPagina}
        />
      </section>
    </div>
  );
}
