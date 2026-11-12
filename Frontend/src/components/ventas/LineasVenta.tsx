"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada, {
  type PaginaNegocio,
} from "@/hooks/useConsultaPaginada";
import { mostrarBolivianos } from "@/lib/moneda";
import { mostrarFechaVenta, mostrarPesoVenta } from "./calculosVenta";
import type { LineaVenta as TipoLinea, Venta } from "./tipos";

export default function LineasVenta({
  venta,
  alRevisionDistinta,
}: {
  venta: Venta;
  alRevisionDistinta: (distinta: boolean) => void;
}) {
  const t = useTranslations("ventas"),
    idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<TipoLinea>(
    `ventas/${venta.id}/lineas/?pagina=${pagina}&version=${venta.revision || venta.version}`,
    () => establecerPagina(1),
  );
  const datos = consulta.datos as
    (PaginaNegocio<TipoLinea> & { revision: string }) | undefined;
  const distinta =
    venta.estado === "borrador" && !!datos && datos.revision !== venta.revision;
  useEffect(() => {
    alRevisionDistinta(distinta || !!consulta.fallo || !datos);
  }, [distinta, consulta.fallo, datos, alRevisionDistinta]);
  if (consulta.fallo)
    return (
      <div role="alert" className="space-y-3 p-8">
        <p>{t("errorConsulta")}</p>
        <Button variant="outline" onClick={consulta.recargar}>
          {t("reintentar")}
        </Button>
      </div>
    );
  if (!datos)
    return (
      <p role="status" className="p-10 text-center text-sm">
        {t("cargando")}
      </p>
    );
  if (distinta)
    return (
      <p
        role="alert"
        className="p-8 text-sm text-orange-700 dark:text-orange-300"
      >
        {t("revisionCambio")}
      </p>
    );
  if (!datos.count)
    return (
      <p className="p-10 text-center text-sm text-gray-500">
        {t("sinElegidas")}
      </p>
    );
  return (
    <>
      <div className="hidden grid-cols-[minmax(12rem,1fr)_9rem_9rem_9rem] gap-4 border-y border-gray-100 bg-gray-50/70 px-5 py-3 text-xs text-gray-500 2xl:grid dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
        <span>{t("productoDestino")}</span>
        <span className="text-end">{t("kgAceptados")}</span>
        <span className="text-end">{t("precioKg")}</span>
        <span className="text-end">{t("importe")}</span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {datos.results.map((fila) => (
          <li key={fila.linea_entrega} className="p-5">
            <div className="grid items-center gap-3 2xl:grid-cols-[minmax(12rem,1fr)_9rem_9rem_9rem] 2xl:gap-4">
              <div>
                <p className="font-semibold">{fila.producto_nombre}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {fila.sucursal_nombre}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("fechaRecepcion")}:{" "}
                  {mostrarFechaVenta(fila.fecha_recepcion, idioma)}
                </p>
              </div>
              <p className="flex justify-between gap-3 text-sm tabular-nums 2xl:block 2xl:text-end">
                <span className="text-gray-500 2xl:hidden">
                  {t("kgAceptados")}
                </span>
                {mostrarPesoVenta(fila.peso_aceptado_kg)} kg
              </p>
              <p className="flex justify-between gap-3 text-sm tabular-nums 2xl:block 2xl:text-end">
                <span className="text-gray-500 2xl:hidden">
                  {t("precioKg")}
                </span>
                {fila.precio_kg === null
                  ? t("sinPrecio")
                  : mostrarBolivianos(fila.precio_kg, idioma)}
              </p>
              <p className="flex justify-between gap-3 font-semibold tabular-nums 2xl:block 2xl:text-end">
                <span className="text-sm font-normal text-gray-500 2xl:hidden">
                  {t("importe")}
                </span>
                {fila.importe === null
                  ? "—"
                  : mostrarBolivianos(fila.importe, idioma)}
              </p>
            </div>
            <details className="mt-3 text-xs">
              <summary className="w-fit cursor-pointer rounded py-1 font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300">
                {t("trazabilidad")}
              </summary>
              <div className="mt-2 space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p>
                  {fila.codigo_pedido} · {fila.codigo_entrega} ·{" "}
                  {fila.codigo_acuerdo ?? t("sinPrecio")}
                  {fila.version_acuerdo ? ` / v${fila.version_acuerdo}` : ""}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  {t("fechaPrecio")}:{" "}
                  {mostrarFechaVenta(fila.fecha_requerida, idioma)}
                </p>
                <ul className="space-y-1">
                  {fila.aportes.map((aporte) => (
                    <li
                      key={aporte.aporte}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <span>
                        {aporte.codigo_lote} ·{" "}
                        {mostrarPesoVenta(aporte.peso_aceptado_kg)} kg
                      </span>
                      <span>
                        {aporte.importe === null
                          ? "—"
                          : mostrarBolivianos(aporte.importe, idioma)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {datos.count > 10 && (
        <PaginadorPedidos
          pagina={pagina}
          total={datos.count}
          alCambiar={establecerPagina}
        />
      )}
    </>
  );
}
