"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import { panelVenta, campoVenta } from "@/components/ventas/tipos";
import { mostrarBolivianos } from "@/lib/moneda";
import { mostrarFechaVenta } from "@/components/ventas/calculosVenta";
import EstadoPago from "./EstadoPago";
import type { AvisoPago, PaginaPagos } from "./tipos";

export default function ListadoPagos({
  oficina = false,
}: {
  oficina?: boolean;
}) {
  const t = useTranslations("pagos"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState(oficina ? "por_verificar" : ""),
    [fecha, establecerFecha] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const ruta = oficina ? "pagos-por-verificar" : "mis-pagos";
  const consulta = useConsultaComercial<PaginaPagos<AvisoPago>>(
    ruta +
      "/?" +
      new URLSearchParams({
        buscar,
        pagina: String(pagina),
        ...(estado ? { estado } : {}),
        ...(fecha ? { desde: fecha, hasta: fecha } : {}),
      }),
  );
  if (!consulta.sesionValida) return <p role="alert">{tc("sinAcceso")}</p>;
  return (
    <section className="space-y-4">
      {oficina && (
        <header>
          <h1 className="text-2xl font-semibold">{t("oficina")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("ayudaOficina")}
          </p>
        </header>
      )}
      <div className={panelVenta + " overflow-hidden"}>
        <div className="grid items-end gap-4 p-5 md:grid-cols-[minmax(0,1fr)_13rem_13rem]">
          <label className="relative">
            <span className="sr-only">{t("buscarPago")}</span>
            <Search
              className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
              aria-hidden="true"
            />
            <input
              type="search"
              maxLength={150}
              className={campoVenta + " ps-9"}
              placeholder={t("buscarPago")}
              value={buscar}
              onChange={(e) => {
                establecerBuscar(e.target.value);
                establecerPagina(1);
              }}
            />
          </label>
          <label className="text-sm font-medium">
            {t("estado")}
            <select
              className={campoVenta + " mt-1.5"}
              value={estado}
              onChange={(e) => {
                establecerEstado(e.target.value);
                establecerPagina(1);
              }}
            >
              <option value="">{t("todosEstados")}</option>
              {["por_verificar", "confirmado", "observado"].map((c) => (
                <option key={c} value={c}>
                  {t("estados." + c)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              htmlFor="fecha-pagos-lista"
            >
              {t("fechaPago")}
            </label>
            <CampoFecha
              id="fecha-pagos-lista"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                establecerPagina(1);
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {consulta.datos
              ? t("cantidadPagos", { total: consulta.datos.count })
              : tc("cargando")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={consulta.recargar}
            startIcon={<RefreshCw className="size-4" />}
          >
            {t("actualizar")}
          </Button>
        </div>
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
            {t("sinPagos")}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((pago) => (
                <li key={pago.id}>
                  <Link
                    href={"/" + ruta + "/" + pago.id}
                    className="grid items-center gap-4 p-5 hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-brand-500 md:grid-cols-[minmax(0,1fr)_9rem_9rem_12rem_auto] dark:hover:bg-gray-800"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{pago.codigo}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {pago.cliente_nombre}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {mostrarFechaVenta(pago.fecha_cobro, idioma)}
                    </p>
                    <p className="font-semibold tabular-nums">
                      {mostrarBolivianos(pago.importe, idioma)}
                    </p>
                    <div>
                      <EstadoPago estado={pago.estado} />
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                      {t("verPago")}
                      <ArrowRight
                        className="size-4 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
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
      </div>
    </section>
  );
}
