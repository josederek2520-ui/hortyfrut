"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { mostrarFecha } from "@/components/compras/calculos";
import type { Lote, MovimientoInventario } from "./tipos";

export default function ListaInventario({
  registros,
  lotes,
}: {
  registros: (Lote | MovimientoInventario)[];
  lotes: boolean;
}) {
  const t = useTranslations("inventario");
  const idioma = useLocale();
  const tituloEstado = (lote: Lote) =>
    t(
      lote.vencido
        ? "vencido"
        : lote.estado === "bloqueado"
          ? "bloqueado"
          : lote.disponible
            ? "disponible"
            : "noDisponible",
    );
  const enlace = (registro: Lote | MovimientoInventario) => (
    <Link
      href={`/${lotes ? "lotes" : "movimientos-inventario"}/${registro.id}`}
      className="rounded font-semibold text-brand-700 underline focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
    >
      {registro.codigo}
    </Link>
  );
  const saldo = (lote: Lote) =>
    `${new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(Number(lote.saldo))} ${lote.unidad_abreviatura}`;
  return (
    <>
      <div className="space-y-3 md:hidden">
        {registros.map((registro) => (
          <article
            key={registro.id}
            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {enlace(registro)}
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {"saldo" in registro
                  ? tituloEstado(registro)
                  : t(`tiposMovimiento.${registro.tipo}`)}
              </span>
            </div>
            <p className="mt-3 font-medium text-gray-800 dark:text-gray-100">
              {"saldo" in registro
                ? registro.producto_nombre
                : registro.referencia_codigo}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {registro.almacen_nombre} ·{" "}
              {mostrarFecha(
                "saldo" in registro ? registro.fecha_ingreso : registro.fecha,
                idioma,
              )}
            </p>
            {"saldo" in registro && (
              <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
                {saldo(registro)}
              </p>
            )}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block dark:border-gray-800">
        <table className="w-full text-start text-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              {(lotes
                ? [
                    "lote",
                    "producto",
                    "almacen",
                    "saldoFisico",
                    "vencimiento",
                    "estado",
                  ]
                : [
                    "movimiento",
                    "fecha",
                    "almacen",
                    "origen",
                    "lotesCantidad",
                    "responsable",
                  ]
              ).map((clave) => (
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
            {registros.map((registro) => (
              <tr
                key={registro.id}
                className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  {enlace(registro)}
                </td>
                {"saldo" in registro ? (
                  <>
                    <td className="min-w-40 px-4 py-4 font-medium">
                      {registro.producto_nombre}
                    </td>
                    <td className="px-4 py-4">{registro.almacen_nombre}</td>
                    <td className="px-4 py-4 font-medium whitespace-nowrap tabular-nums">
                      {saldo(registro)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {registro.fecha_vencimiento
                        ? mostrarFecha(registro.fecha_vencimiento, idioma)
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium whitespace-nowrap ${registro.disponible ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"}`}
                      >
                        {tituloEstado(registro)}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {mostrarFecha(registro.fecha, idioma)}
                    </td>
                    <td className="px-4 py-4">{registro.almacen_nombre}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p>{registro.referencia_codigo}</p>
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        {t(`tiposMovimiento.${registro.tipo}`)}
                      </p>
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {registro.cantidad_lotes}
                    </td>
                    <td className="px-4 py-4">{registro.responsable_nombre}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
