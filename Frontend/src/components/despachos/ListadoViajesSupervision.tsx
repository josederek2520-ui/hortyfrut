"use client";
import { useLocale, useTranslations } from "next-intl";
import { Search, Truck, UserRound } from "lucide-react";
import Paginador from "@/components/compras/PaginadorCompras";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import { clasePanel, type PaginaLogistica } from "@/components/logistica/tipos";
import { claseEstadoDespacho, type Despacho } from "./tipos";
import type { FiltrosSeguimientoCamiones } from "./seguimientoCamiones";
import estilos from "./estilosSeguimientoCamiones.module.css";

export default function ListadoViajesSupervision({
  filtros,
  consulta,
  identificador,
  alElegir,
  alCambiar,
}: {
  filtros: FiltrosSeguimientoCamiones;
  consulta: {
    datos: PaginaLogistica<Despacho> | null;
    cargando: boolean;
    fallo: boolean;
    recargar: () => void;
  };
  identificador: number | null;
  alElegir: (identificador: number) => void;
  alCambiar: (cambios: Partial<FiltrosSeguimientoCamiones>) => void;
}) {
  const t = useTranslations("seguimientoCamiones"),
    estados = useTranslations("despachos"),
    idioma = useLocale();
  const viajes = consulta.datos?.results ?? [];
  const hayFiltros = !!(filtros.buscar.trim() || filtros.estado);
  const reintentar = () => {
    alCambiar({ pagina: 1 });
    consulta.recargar();
  };
  return (
    <aside
      className={`${clasePanel} min-w-0 self-start p-4 sm:p-5`}
      aria-labelledby="titulo-viajes-actuales"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="titulo-viajes-actuales"
          className="font-semibold text-gray-900 dark:text-white"
        >
          {t("viajesActuales")}
        </h2>
        {consulta.datos && (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {consulta.datos.count}
          </span>
        )}
      </div>
      <label htmlFor="buscar-camiones" className="sr-only">
        {t("buscar")}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-3 size-5 text-gray-400"
        />
        <input
          id="buscar-camiones"
          type="search"
          value={filtros.buscar}
          onChange={(evento) => alCambiar({ buscar: evento.target.value })}
          placeholder={t("buscar")}
          className="min-h-11 w-full rounded-xl border border-gray-200 bg-transparent py-2 ps-10 pe-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white"
        />
      </div>
      <label
        htmlFor="estado-camiones"
        className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300"
      >
        {t("estado")}
      </label>
      <select
        id="estado-camiones"
        value={filtros.estado}
        onChange={(evento) =>
          alCambiar({
            estado: evento.target.value as FiltrosSeguimientoCamiones["estado"],
          })
        }
        className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      >
        <option value="">{t("todos")}</option>
        <option value="en_ruta">{estados("estados.en_ruta")}</option>
        <option value="borrador">{estados("pendienteSalida")}</option>
      </select>
      {consulta.cargando || consulta.fallo ? (
        <EstadoConsulta
          cargando={consulta.cargando}
          fallo={consulta.fallo}
          alRecargar={reintentar}
        />
      ) : viajes.length ? (
        <>
          <ul
            className={`${estilos.lista} mt-4`}
            aria-label={t("viajesActuales")}
          >
            {viajes.map((viaje) => (
              <li key={viaje.id}>
                <button
                  type="button"
                  aria-pressed={identificador === viaje.id}
                  onClick={() => alElegir(viaje.id)}
                  className={`w-full rounded-2xl border p-3 text-start focus-visible:outline-2 focus-visible:outline-brand-500 ${identificador === viaje.id ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-500/10" : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"}`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {viaje.codigo}
                    </span>
                    <span
                      className={`${claseEstadoDespacho(viaje.estado)} px-2 py-1`}
                    >
                      {estados(
                        viaje.estado === "borrador"
                          ? "pendienteSalida"
                          : `estados.${viaje.estado}`,
                      )}
                    </span>
                  </span>
                  <span className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                    <Truck className="size-4 shrink-0" />
                    {viaje.vehiculo_placa}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <UserRound className="size-4 shrink-0" />
                    {viaje.chofer_nombre}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-gray-500 dark:text-gray-400">
                    {viaje.almacen_nombre} ·{" "}
                    {new Intl.DateTimeFormat(idioma, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(`${viaje.fecha_reparto}T12:00:00Z`))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Paginador
              pagina={filtros.pagina}
              total={consulta.datos!.count}
              alCambiar={(pagina) => alCambiar({ pagina })}
              ocupado={consulta.cargando}
            />
          </div>
        </>
      ) : (
        <div role="status" className="py-8 text-center">
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t(hayFiltros ? "sinResultados" : "sinViajes")}
          </p>
          {hayFiltros && (
            <button
              type="button"
              className="mt-3 min-h-11 rounded-xl px-3 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
              onClick={() => alCambiar({ buscar: "", estado: "", pagina: 1 })}
            >
              {t("limpiar")}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
