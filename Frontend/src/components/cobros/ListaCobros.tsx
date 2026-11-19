"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Banknote, Search, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import { mostrarBolivianos } from "@/lib/moneda";
import { campoVenta, panelVenta, enlaceVenta } from "@/components/ventas/tipos";
import { mostrarFechaVenta } from "@/components/ventas/calculosVenta";
import type { Cobro, PaginaCobros } from "./tipos";

export default function ListaCobros({
  puedeRegistrar,
  venta,
}: {
  puedeRegistrar: boolean;
  venta?: string;
}) {
  const t = useTranslations("cobros"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [desde, establecerDesde] = useState(""),
    [hasta, establecerHasta] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const parametros = new URLSearchParams({ buscar, pagina: String(pagina) });
  if (desde) parametros.set("desde", desde);
  if (hasta) parametros.set("hasta", hasta);
  if (venta) parametros.set("venta", venta);
  const consulta = useConsultaComercial<PaginaCobros<Cobro>>(
    "cobros/?" + parametros,
  );
  if (!consulta.sesionValida) return <p role="alert">{tc("sinAcceso")}</p>;
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("titulo")}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        {puedeRegistrar && (
          <Link
            href="/cobros/nuevo"
            className={
              enlaceVenta +
              " control-suave-hortyfru border border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950"
            }
          >
            <Plus className="size-4" />
            {t("nuevoCobro")}
          </Link>
        )}
      </header>
      <div className={panelVenta + " overflow-hidden"}>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="relative self-end">
            <span className="sr-only">{t("buscar")}</span>
            <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500" />
            <input
              type="search"
              className={campoVenta + " ps-9"}
              placeholder={t("buscar")}
              value={buscar}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </label>
          {(["desde", "hasta"] as const).map((campo) => (
            <div key={campo}>
              <label
                className="mb-1.5 block text-xs font-medium"
                htmlFor={"cobros-" + campo}
              >
                {t(campo)}
              </label>
              <CampoFecha
                id={"cobros-" + campo}
                value={campo === "desde" ? desde : hasta}
                min={campo === "hasta" ? desde || undefined : undefined}
                alCambiar={(valor) => {
                  (campo === "desde" ? establecerDesde : establecerHasta)(
                    valor,
                  );
                  establecerPagina(1);
                }}
              />
            </div>
          ))}
        </div>
        {venta && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 text-sm dark:border-gray-800">
            <p>
              {t("filtradoVenta", { codigo: "VEN-" + venta.padStart(6, "0") })}
            </p>
            <Link href="/cobros" className={enlaceVenta}>
              {tc("verTodos")}
            </Link>
          </div>
        )}
        {consulta.fallo ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{tc("errorConsulta")}</p>
            <Button
              onClick={() => {
                establecerPagina(1);
                consulta.recargar();
              }}
            >
              {tc("reintentar")}
            </Button>
          </div>
        ) : !consulta.datos ? (
          <p role="status" className="p-10 text-center">
            {tc("cargando")}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-y border-gray-100 px-5 py-4 text-sm dark:border-gray-800">
              <p>{t("cantidadCobros", { cantidad: consulta.datos.count })}</p>
              <p className="font-semibold">
                {t("totalRecibido")}:{" "}
                {mostrarBolivianos(consulta.datos.total_cobrado ?? "0", idioma)}
              </p>
            </div>
            {!consulta.datos.count ? (
              <div className="p-10 text-center">
                <Banknote
                  className="mx-auto size-9 text-brand-700 dark:text-brand-300"
                  aria-hidden="true"
                />
                <h2 className="mt-3 font-semibold">{t("sinCobros")}</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("sinCobrosAyuda")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {consulta.datos.results.map((cobro) => (
                  <li key={cobro.id}>
                    <Link
                      href={"/cobros/" + cobro.id}
                      className="grid items-center gap-4 p-5 hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-brand-500 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_2rem] dark:hover:bg-gray-800"
                    >
                      <div>
                        <p className="font-semibold">{cobro.cliente_nombre}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {cobro.codigo} ·{" "}
                          {mostrarFechaVenta(cobro.fecha_cobro, idioma)}
                        </p>
                      </div>
                      <p className="text-sm">{t("medios." + cobro.medio)}</p>
                      <p className="font-semibold tabular-nums sm:text-end">
                        {mostrarBolivianos(cobro.importe, idioma)}
                      </p>
                      <ArrowRight
                        className="size-4 text-brand-700 rtl:rotate-180 dark:text-brand-300"
                        aria-label={tc("verDetalle")}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
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
