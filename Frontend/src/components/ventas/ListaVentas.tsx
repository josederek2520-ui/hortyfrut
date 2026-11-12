"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight as IconoAbrir,
  Plus as IconoAgregar,
  ReceiptText as IconoVenta,
  Wallet as IconoSaldo,
  FilePenLine as IconoBorrador,
  Search as IconoBuscar,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada, {
  type PaginaNegocio,
} from "@/hooks/useConsultaPaginada";
import { mostrarBolivianos } from "@/lib/moneda";
import type { Session as Sesion } from "@/components/users/types";
import EstadoVenta from "./EstadoVenta";
import { mostrarFechaVenta } from "./calculosVenta";
import { panelVenta, campoVenta, enlaceVenta, type Venta } from "./tipos";

export default function ListaVentas({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("ventas"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState("");
  const [desde, establecerDesde] = useState(""),
    [hasta, establecerHasta] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<Venta>(
    "ventas/?" +
      new URLSearchParams({
        buscar,
        pagina: String(pagina),
        ...(estado ? { estado } : {}),
        ...(desde ? { desde } : {}),
        ...(hasta ? { hasta } : {}),
      }),
    () => establecerPagina(1),
  );
  const datos = consulta.datos as
    | (PaginaNegocio<Venta> & {
        resumen: { total: string; emitidas: number; borradores: number };
      })
    | undefined;
  const filtrado = !!(buscar || estado || desde || hasta);
  const nueva = (
    <Link
      href="/ventas/nueva"
      className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <IconoAgregar className="size-4" aria-hidden="true" />
      {t("nueva")}
    </Link>
  );
  return (
    <section className="space-y-6 text-gray-900 dark:text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("titulo")}
          </h1>
          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        {sesion.permisos_ventas?.crear && nueva}
      </div>
      <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        {[
          {
            etiqueta: "pendienteCobro",
            valor: datos ? mostrarBolivianos(datos.resumen.total, idioma) : "—",
            icono: IconoSaldo,
          },
          {
            etiqueta: "ventasEmitidas",
            valor: datos?.resumen.emitidas ?? "—",
            icono: IconoVenta,
          },
          {
            etiqueta: "borradores",
            valor: datos?.resumen.borradores ?? "—",
            icono: IconoBorrador,
          },
        ].map(({ etiqueta, valor, icono: Icono }) => (
          <div
            key={etiqueta}
            className={panelVenta + " flex items-center gap-4 p-5"}
          >
            <span className="rounded-2xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <Icono className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(etiqueta)}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={panelVenta}>
        <div className="grid items-end gap-4 p-5 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_11rem_11rem_11rem]">
          <label className="text-sm font-medium">
            {t("buscar")}
            <span className="relative mt-1.5 block">
              <IconoBuscar
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                maxLength={150}
                className={campoVenta + " ps-9"}
                placeholder={t("buscarAyuda")}
                value={buscar}
                onChange={(evento) => {
                  establecerBuscar(evento.target.value);
                  establecerPagina(1);
                }}
              />
            </span>
          </label>
          <label className="text-sm font-medium">
            {t("estado")}
            <select
              className={campoVenta + " mt-1.5"}
              value={estado}
              onChange={(evento) => {
                establecerEstado(evento.target.value);
                establecerPagina(1);
              }}
            >
              <option value="">{t("todos")}</option>
              {["emitida", "borrador", "cancelada"].map((valor) => (
                <option key={valor} value={valor}>
                  {t("estados." + valor)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <label
              htmlFor="ventas-desde"
              className="mb-1.5 block text-sm font-medium"
            >
              {t("desde")}
            </label>
            <CampoFecha
              id="ventas-desde"
              value={desde}
              max={hasta || undefined}
              alCambiar={(valor) => {
                establecerDesde(valor);
                establecerPagina(1);
              }}
            />
          </div>
          <div>
            <label
              htmlFor="ventas-hasta"
              className="mb-1.5 block text-sm font-medium"
            >
              {t("hasta")}
            </label>
            <CampoFecha
              id="ventas-hasta"
              value={hasta}
              min={desde || undefined}
              alCambiar={(valor) => {
                establecerHasta(valor);
                establecerPagina(1);
              }}
            />
          </div>
        </div>
        {filtrado && (
          <div className="flex justify-end px-5 pb-2">
            <button
              className={enlaceVenta}
              onClick={() => {
                establecerBuscar("");
                establecerEstado("");
                establecerDesde("");
                establecerHasta("");
                establecerPagina(1);
              }}
            >
              {t("limpiar")}
            </button>
          </div>
        )}
        {consulta.fallo ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{t("errorConsulta")}</p>
            <Button variant="outline" onClick={consulta.recargar}>
              {t("reintentar")}
            </Button>
          </div>
        ) : !datos ? (
          <p role="status" className="p-12 text-center text-sm text-gray-500">
            {t("cargando")}
          </p>
        ) : !datos.count ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <IconoVenta className="size-8" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">
              {t(filtrado ? "sinResultados" : "sinVentas")}
            </h2>
            <p className="mx-auto mt-2 mb-5 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t(filtrado ? "sinResultadosAyuda" : "sinVentasAyuda")}
            </p>
            {!filtrado && sesion.permisos_ventas?.crear && nueva}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(12rem,1fr)_10rem_9rem_9rem_8rem_3rem] gap-4 border-y border-gray-100 bg-gray-50/70 px-5 py-3 text-xs font-medium text-gray-500 xl:grid dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
              {[
                "supermercado",
                "recepciones",
                "total",
                "saldo",
                "estado",
                "",
              ].map((clave, indice) => (
                <span
                  key={indice}
                  className={indice === 2 || indice === 3 ? "text-end" : ""}
                >
                  {clave ? t(clave) : ""}
                </span>
              ))}
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {datos.results.map((venta) => (
                <li key={venta.id}>
                  <Link
                    href={"/ventas/" + venta.id}
                    className="grid items-center gap-4 p-5 hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-brand-500 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_10rem_9rem_9rem_8rem_3rem] dark:hover:bg-gray-800/60"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold break-words">
                        {venta.cliente_nombre}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {venta.codigo} ·{" "}
                        {t("cantidadEntregas", {
                          cantidad: venta.total_entregas,
                        })}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="mb-1 block text-xs xl:hidden">
                        {t("recepciones")}
                      </span>
                      {mostrarFechaVenta(venta.desde, idioma)}
                      {venta.hasta !== venta.desde && (
                        <>
                          <br />
                          {mostrarFechaVenta(venta.hasta, idioma)}
                        </>
                      )}
                    </div>
                    <div className="tabular-nums xl:text-end">
                      <span className="mb-1 block text-xs text-gray-500 xl:hidden">
                        {t("total")}
                      </span>
                      {venta.total === null
                        ? "—"
                        : mostrarBolivianos(venta.total, idioma)}
                    </div>
                    <div className="font-semibold tabular-nums xl:text-end">
                      <span className="mb-1 block text-xs font-normal text-gray-500 xl:hidden">
                        {t("saldo")}
                      </span>
                      {venta.saldo === null
                        ? "—"
                        : mostrarBolivianos(venta.saldo, idioma)}
                    </div>
                    <div>
                      <EstadoVenta estado={venta.estado} />
                    </div>
                    <span className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-300">
                      <span className="xl:sr-only">{t("verVenta")}</span>
                      <IconoAbrir
                        className="size-4 rtl:-scale-x-100"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
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
        )}
      </div>
    </section>
  );
}
