"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Truck, FilterX } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Session } from "@/components/users/types";
import CampoFecha from "@/components/form/CampoFecha";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import PestanasEntregas from "./PestanasEntregas";
import FilaListadoEntrega from "./FilaListadoEntrega";
import estilos from "./estilosEntregas.module.css";
import {
  panelEntrega,
  entradaEntrega,
  type PaginaEntrega,
  type FilaListadoEntrega as DatosFilaEntrega,
} from "./tipos";

export default function ListaEntregas({ sesion }: { sesion: Session }) {
  const t = useTranslations("entregas");
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState(""),
    [fecha, establecerFecha] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const [consulta, establecerConsulta] = useState<{
    clave: string;
    datos?: PaginaEntrega<DatosFilaEntrega>;
    fallo?: string;
  } | null>(null);
  const [revision, establecerRevision] = useState(0);
  const permisos = sesion.permisos_entregas;
  const oficina = !sesion.acceso_publico && !!permisos?.confirmar;
  const campoBuscar = useRef<HTMLInputElement>(null);
  const parametros = new URLSearchParams({
    buscar,
    pagina: String(pagina),
    ...(estado ? { estado } : {}),
    ...(fecha ? { fecha } : {}),
  }).toString();
  const hayFiltros = !!(buscar || estado || fecha);
  function limpiarFiltros() {
    establecerBuscar("");
    establecerEstado("");
    establecerFecha("");
    establecerPagina(1);
    campoBuscar.current?.focus();
  }
  useEffect(() => {
    if (!permisos?.ver) return;
    const controlador = new AbortController();
    const reloj = setTimeout(() => {
      void api<PaginaEntrega<DatosFilaEntrega>>("entregas/?" + parametros, {
        signal: controlador.signal,
      })
        .then((datos) => {
          if (!controlador.signal.aborted)
            establecerConsulta({ clave: parametros, datos });
        })
        .catch((error) => {
          if (controlador.signal.aborted) return;
          if (error instanceof ApiError && error.status === 404 && pagina > 1) {
            establecerPagina(1);
            return;
          }
          establecerConsulta({
            clave: parametros,
            fallo:
              error instanceof ApiError && error.status === 403
                ? "sinPermiso"
                : "errorConsulta",
          });
        });
    }, 180);
    return () => {
      controlador.abort();
      clearTimeout(reloj);
    };
  }, [parametros, permisos?.ver, revision, pagina]);
  if (!permisos?.ver) return <p role="alert">{t("sinPermiso")}</p>;
  const actual = consulta?.clave === parametros ? consulta : null;
  return (
    <section
      className={`${estilos.entregas} space-y-5 text-gray-900 dark:text-white`}
    >
      <div>
        <h1 className="text-2xl font-semibold">{t("titulo")}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t(oficina ? "listadoOficinaAyuda" : "listadoSucursalAyuda")}
        </p>
      </div>
      <div className={panelEntrega}>
        <PestanasEntregas
          estado={estado}
          resumen={actual?.datos?.resumen_estados}
          alCambiar={(valor) => {
            establecerEstado(valor);
            establecerPagina(1);
          }}
        />
        <div className="grid items-end gap-4 border-b border-gray-100 p-5 md:grid-cols-[minmax(0,1fr)_14rem] dark:border-gray-800">
          <label className="block text-sm font-medium">
            {t("buscarEtiqueta")}
            <span className="relative mt-1.5 block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
              />
              <input
                ref={campoBuscar}
                type="search"
                name="filtro_entregas"
                autoComplete="off"
                className={entradaEntrega + " ps-10"}
                value={buscar}
                maxLength={150}
                placeholder={t("buscar")}
                onChange={(evento) => {
                  establecerBuscar(evento.target.value);
                  establecerPagina(1);
                }}
              />
            </span>
          </label>
          <div>
            <label
              htmlFor="filtro-fecha-entregas"
              className="mb-1.5 block text-sm font-medium"
            >
              {t("fechaReparto")}
            </label>
            <CampoFecha
              id="filtro-fecha-entregas"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                establecerPagina(1);
              }}
            />
          </div>
        </div>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-5 py-3">
          <p
            className="text-xs text-gray-500 dark:text-gray-400"
            aria-live="polite"
          >
            {actual?.datos
              ? t("cantidadEntregas", { total: actual.datos.count })
              : t("consultandoEntregas")}
          </p>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
            >
              <FilterX className="size-4" aria-hidden="true" />
              {t("limpiarFiltros")}
            </button>
          )}
        </div>
        {!actual ? (
          <p role="status" className="p-10 text-center">
            {t("cargando")}
          </p>
        ) : actual.fallo ? (
          <div
            role="alert"
            className="space-y-3 p-8 text-error-700 dark:text-error-300"
          >
            <p>{t(actual.fallo)}</p>
            <Button
              variant="outline"
              onClick={() => {
                establecerConsulta(null);
                establecerRevision((valor) => valor + 1);
              }}
            >
              {t("reintentarConsulta")}
            </Button>
          </div>
        ) : !actual.datos?.count ? (
          <div className="p-10 text-center">
            <Truck
              aria-hidden="true"
              className="mx-auto mb-3 size-8 text-brand-600 dark:text-brand-300"
            />
            <p className="font-medium">
              {t(hayFiltros ? "sinResultados" : "sinEntregas")}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t(hayFiltros ? "sinResultadosAyuda" : "sinEntregasAyuda")}
            </p>
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_11rem] gap-3 border-y border-gray-100 bg-gray-50 px-5 py-3 text-xs font-medium text-gray-600 lg:grid dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300"
            >
              <span>{t("destinoEntrega")}</span>
              <span>{t("fechasEntrega")}</span>
              <span>{t("estado")}</span>
              <span className="text-end">{t("accionEntrega")}</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {actual.datos.results.map((fila) => (
                <FilaListadoEntrega
                  key={fila.despacho + "-" + fila.pedido}
                  fila={fila}
                  permisos={permisos}
                  oficina={oficina}
                />
              ))}
            </ul>
            {actual.datos.count > 10 && (
              <PaginadorPedidos
                pagina={pagina}
                total={actual.datos.count}
                alCambiar={establecerPagina}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
