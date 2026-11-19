"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, RefreshCw } from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import EstadoCobroVenta from "@/components/ventas/EstadoCobroVenta";
import { panelVenta, campoVenta } from "@/components/ventas/tipos";
import { mostrarBolivianos } from "@/lib/moneda";
import { mostrarFechaVenta } from "@/components/ventas/calculosVenta";
import type { PaginaPagos, VentaPropia } from "./tipos";

export default function VentasSupermercado() {
  const t = useTranslations("pagos"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1),
    [pendientes, establecerPendientes] = useState(false);
  const consulta = useConsultaComercial<PaginaPagos<VentaPropia>>(
    "mis-pagos/ventas/?" +
      new URLSearchParams({
        buscar,
        pagina: String(pagina),
        ...(pendientes ? {} : { historial: "1" }),
      }),
  );
  if (!consulta.sesionValida) return <p role="alert">{tc("sinAcceso")}</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        {(["saldo", "cobrado", "por_verificar"] as const).map((campo) => (
          <div key={campo} className={panelVenta + " p-4"}>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("resumen." + campo)}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {consulta.datos?.resumen
                ? mostrarBolivianos(consulta.datos.resumen[campo], idioma)
                : "—"}
            </p>
          </div>
        ))}
      </div>
      <section className={panelVenta + " overflow-hidden"}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="font-semibold">{t("ventas")}</h2>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
              <span className="sr-only">{t("buscarVenta")}</span>
              <Search
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
                aria-hidden="true"
              />
              <input
                type="search"
                maxLength={150}
                value={buscar}
                className={campoVenta + " ps-9"}
                placeholder={t("buscarVenta")}
                onChange={(e) => {
                  establecerBuscar(e.target.value);
                  establecerPagina(1);
                }}
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={pendientes}
              onClick={() => {
                establecerPendientes(!pendientes);
                establecerPagina(1);
              }}
            >
              {t("soloPendientes")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("actualizar")}
              onClick={consulta.recargar}
              startIcon={<RefreshCw className="size-4" />}
            >
              {t("actualizar")}
            </Button>
          </div>
        </div>
        <p className="border-b border-gray-100 px-5 pb-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {t("ayudaSaldos")}
        </p>
        {consulta.fallo ? (
          <div role="alert" className="space-y-3 p-6">
            <p>{tc("errorConsulta")}</p>
            <Button onClick={consulta.recargar}>{tc("reintentar")}</Button>
          </div>
        ) : !consulta.datos ? (
          <p role="status" className="p-8 text-center">
            {tc("cargando")}
          </p>
        ) : !consulta.datos.count ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("sinVentas")}
          </p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-500 lg:grid lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_8rem] dark:bg-gray-800 dark:text-gray-400"
            >
              <span>{t("venta")}</span>
              {["totalVenta", "pagado", "saldoActual", "porVerificar"].map(
                (c) => (
                  <span key={c} className="text-end">
                    {t(c)}
                  </span>
                ),
              )}
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((venta) => (
                <li
                  key={venta.id}
                  className="grid grid-cols-2 items-center gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_8rem]"
                >
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <p className="font-semibold">{venta.codigo}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {venta.cliente_nombre} ·{" "}
                      {mostrarFechaVenta(venta.fecha_emision, idioma)}
                    </p>
                    <div className="mt-2">
                      <EstadoCobroVenta estado={venta.estado_cobro} />
                    </div>
                  </div>
                  {(
                    [
                      ["totalVenta", venta.total],
                      ["pagado", venta.cobrado],
                      ["saldoActual", venta.saldo],
                      ["porVerificar", venta.por_verificar],
                    ] as const
                  ).map(([etiqueta, valor]) => (
                    <div
                      key={etiqueta}
                      className="text-sm tabular-nums lg:text-end"
                    >
                      <p className="mb-1 text-xs text-gray-500 lg:sr-only dark:text-gray-400">
                        {t(etiqueta)}
                      </p>
                      <p
                        className={
                          etiqueta === "saldoActual" ? "font-semibold" : ""
                        }
                      >
                        {mostrarBolivianos(valor, idioma)}
                      </p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
            {consulta.datos.count > 10 && (
              <PaginadorPedidos
                pagina={pagina}
                total={consulta.datos.count}
                alCambiar={establecerPagina}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
