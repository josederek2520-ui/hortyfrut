"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, RefreshCw } from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import { campoVenta, panelVenta } from "@/components/ventas/tipos";
import { mostrarBolivianos } from "@/lib/moneda";
import type { PaginaCobros, SaldoCobro, SeleccionCobro } from "./tipos";

export default function SeleccionVentasCobro({
  cliente,
  seleccion,
  bloqueado,
  alCambiar,
  alActualizar,
  ruta = "cobros",
}: {
  cliente: number | undefined;
  seleccion: SeleccionCobro[];
  bloqueado: boolean;
  alCambiar: (filas: SeleccionCobro[]) => void;
  alActualizar: () => void;
  ruta?: "cobros" | "mis-pagos";
}) {
  const t = useTranslations("cobros"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1),
    [elegidas, establecerElegidas] = useState(false);
  const consulta = useConsultaComercial<PaginaCobros<SaldoCobro>>(
    cliente && !elegidas
      ? ruta +
          "/ventas/?" +
          new URLSearchParams({
            cliente: String(cliente),
            buscar,
            pagina: String(pagina),
          })
      : null,
  );
  const filtradas = seleccion.filter((fila) =>
    fila.codigo.toLowerCase().includes(buscar.toLowerCase()),
  );
  const filas = elegidas
    ? filtradas.slice((pagina - 1) * 10, pagina * 10)
    : consulta.datos?.results;
  const total = elegidas ? filtradas.length : (consulta.datos?.count ?? 0);
  return (
    <section className={panelVenta + " overflow-hidden"}>
      <header className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">{t("distribuir")}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("ayudaDistribucion")}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={bloqueado || !seleccion.length}
          onClick={alActualizar}
          startIcon={<RefreshCw className="size-4" />}
        >
          {t("actualizarSaldos")}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3 border-y border-gray-100 px-5 py-3 dark:border-gray-800">
        <div role="group" aria-label={t("ventas")} className="flex gap-1">
          {[false, true].map((valor) => (
            <button
              key={String(valor)}
              type="button"
              aria-pressed={elegidas === valor}
              className="pestana-hortyfru min-h-11 rounded-xl px-3 text-sm"
              disabled={bloqueado}
              onClick={() => {
                establecerElegidas(valor);
                establecerPagina(1);
                establecerBuscar("");
              }}
            >
              {t(valor ? "elegidas" : "pendientes")}
              {valor ? ` (${seleccion.length})` : ""}
            </button>
          ))}
        </div>
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{t("buscarVenta")}</span>
          <Search
            className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
            aria-hidden="true"
          />
          <input
            type="search"
            className={campoVenta + " ps-9"}
            disabled={bloqueado}
            value={buscar}
            placeholder={t("buscarVenta")}
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              establecerPagina(1);
            }}
          />
        </label>
      </div>
      {!cliente ? (
        <p className="p-8 text-sm text-gray-500 dark:text-gray-400">
          {t("eligePrimeroCliente")}
        </p>
      ) : !elegidas && consulta.fallo ? (
        <div role="alert" className="space-y-3 p-6">
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
      ) : !filas ? (
        <p role="status" className="p-8">
          {tc("cargando")}
        </p>
      ) : !filas.length ? (
        <p className="p-8 text-sm text-gray-500 dark:text-gray-400">
          {t("sinVentas")}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {filas.map((fila) => {
            const anotada = seleccion.find((s) => s.id === fila.id),
              saldo = anotada ?? fila;
            return (
              <li
                key={fila.id}
                className="grid items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_9rem_11rem]"
              >
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-600"
                    checked={!!anotada}
                    disabled={
                      bloqueado || (!anotada && seleccion.length >= 100)
                    }
                    onChange={() =>
                      alCambiar(
                        anotada
                          ? seleccion.filter((s) => s.id !== fila.id)
                          : [...seleccion, { ...fila, importeAplicado: "" }],
                      )
                    }
                  />
                  <span>
                    <span className="block font-medium">{fila.codigo}</span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {t("total")}: {mostrarBolivianos(fila.total, idioma)}
                    </span>
                  </span>
                </label>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("saldo")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {mostrarBolivianos(saldo.saldo, idioma)}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={"aplicacion-" + fila.id}
                    className="mb-1.5 block text-xs font-medium"
                  >
                    {t("aplicarImporte")}
                  </label>
                  <input
                    id={"aplicacion-" + fila.id}
                    className={campoVenta + " text-end tabular-nums"}
                    inputMode="decimal"
                    type="text"
                    autoComplete="off"
                    maxLength={20}
                    placeholder="0,00"
                    value={anotada?.importeAplicado ?? ""}
                    disabled={bloqueado || !anotada}
                    onChange={(evento) =>
                      alCambiar(
                        seleccion.map((s) =>
                          s.id === fila.id
                            ? { ...s, importeAplicado: evento.target.value }
                            : s,
                        ),
                      )
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {total > 10 && (
        <PaginadorPedidos
          pagina={pagina}
          total={total}
          alCambiar={establecerPagina}
          ocupado={bloqueado}
        />
      )}
    </section>
  );
}
