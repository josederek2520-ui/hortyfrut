"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, RefreshCw, Tags, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada from "@/hooks/useConsultaPaginada";
import type { Session } from "@/components/users/types";
import FiltrosListadoPrecios from "./FiltrosListadoPrecios";
import FilaListadoPrecios, {
  columnasListadoPrecios,
} from "./FilaListadoPrecios";
import { panelPrecio, type AcuerdoPrecio } from "./tipos";

export default function ListaPrecios({ sesion }: { sesion: Session }) {
  const t = useTranslations("precios");
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState(""),
    [fecha, establecerFecha] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<AcuerdoPrecio>(
    "precios-acordados/?" +
      new URLSearchParams({
        buscar,
        pagina: String(pagina),
        ...(estado ? { estado } : {}),
        ...(fecha ? { fecha } : {}),
      }),
    () => establecerPagina(1),
  );
  const filtrado = !!(buscar || estado || fecha),
    puedeCrear = sesion.permisos_precios?.crear;
  const cambiarFiltro =
    (establecer: (valor: string) => void) => (valor: string) => {
      establecer(valor);
      establecerPagina(1);
    };
  const limpiarFiltros = () => {
    establecerBuscar("");
    establecerEstado("");
    establecerFecha("");
    establecerPagina(1);
  };
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(sesion.precios_supermercado ? "misPrecios" : "titulo")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t(
              sesion.precios_supermercado
                ? "subtituloSupermercado"
                : "subtitulo",
            )}
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/precios-acordados/nueva"
            className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("nuevaPropuesta")}
          </Link>
        )}
      </div>
      <div className={panelPrecio + " overflow-hidden"}>
        <FiltrosListadoPrecios
          buscar={buscar}
          estado={estado}
          fecha={fecha}
          supermercado={!!sesion.precios_supermercado}
          alBuscar={cambiarFiltro(establecerBuscar)}
          alEstado={cambiarFiltro(establecerEstado)}
          alFecha={cambiarFiltro(establecerFecha)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p
            role="status"
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            {consulta.fallo
              ? t("listadoPropuestas")
              : consulta.datos
                ? t("totalPropuestas", { total: consulta.datos.count })
                : t("cargando")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {filtrado && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={limpiarFiltros}
              >
                <X className="size-4" aria-hidden="true" />
                {t("limpiarFiltros")}
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!consulta.datos && !consulta.fallo}
              startIcon={<RefreshCw className="size-4" />}
              onClick={consulta.recargar}
            >
              {t("actualizarListado")}
            </Button>
          </div>
        </div>
        {consulta.fallo ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{t("errorConsulta")}</p>
            <Button variant="outline" onClick={consulta.recargar}>
              {t("reintentar")}
            </Button>
          </div>
        ) : !consulta.datos ? (
          <div
            aria-hidden="true"
            className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-800"
          >
            {[0, 1, 2].map((fila) => (
              <div
                key={fila}
                className="h-20 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
              />
            ))}
          </div>
        ) : !consulta.datos.count ? (
          <div className="p-10 text-center">
            <Tags
              className="mx-auto mb-3 size-9 text-brand-600 dark:text-brand-300"
              aria-hidden="true"
            />
            <p className="font-medium">
              {t(filtrado ? "sinResultados" : "sinAcuerdos")}
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
              {t(
                filtrado
                  ? "sinResultadosAyuda"
                  : sesion.precios_supermercado
                    ? "sinMisPropuestasAyuda"
                    : "sinAcuerdosAyuda",
              )}
            </p>
            {!filtrado && puedeCrear && (
              <Link
                href="/precios-acordados/nueva"
                className="mt-4 inline-flex min-h-11 items-center rounded px-3 text-sm font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
              >
                {t("nuevaPropuesta")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className={
                "hidden items-center gap-4 border-y border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-500 xl:grid dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400 " +
                columnasListadoPrecios
              }
            >
              <span>{t("propuestaListado")}</span>
              <span>{t("periodoListado")}</span>
              <span>{t("productosListado")}</span>
              <span>{t("estado")}</span>
              <span className="text-end">{t("acciones")}</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((fila) => (
                <FilaListadoPrecios
                  key={fila.id}
                  propuesta={fila}
                  permisos={sesion.permisos_precios}
                />
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
