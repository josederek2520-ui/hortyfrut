"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus as IconoAgregar } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Session as Sesion } from "@/components/users/types";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import Paginador from "@/components/compras/PaginadorCompras";
import useAvisos from "@/components/logistica/useAvisosLogistica";
import { clasePanel, type PaginaLogistica } from "@/components/logistica/tipos";
import useConsultaListadoDespachos from "./useConsultaListadoDespachos";
import FiltrosListadoDespachos from "./FiltrosListadoDespachos";
import EstadoListadoDespachos from "./EstadoListadoDespachos";
import FilaListadoDespachos, {
  columnasListadoDespachos,
} from "./FilaListadoDespachos";
import {
  consultasListadoDespachos,
  type FiltrosListadoDespachos as DatosFiltros,
  type ResumenListadoDespachos,
} from "./listadoDespachos";
import type { Despacho } from "./tipos";
import estilos from "./estilosListado.module.css";

export default function GestionDespachos({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  const avisos = useAvisos();
  const permisos = sesion.permisos_despachos;
  const [filtros, establecerFiltros] = useState<DatosFiltros>({
    vista: "activos",
    buscar: "",
    estado: "",
    fecha: "",
    pagina: 1,
  });
  const rutas = consultasListadoDespachos(filtros);
  const demora = filtros.buscar.trim() ? 220 : 0;
  const consulta = useConsultaListadoDespachos<PaginaLogistica<Despacho>>(
    permisos.ver ? rutas.lista : null,
    avisos.tratarError,
    demora,
  );
  const resumen = useConsultaListadoDespachos<ResumenListadoDespachos>(
    permisos.ver ? rutas.resumen : null,
    avisos.tratarError,
    demora,
  );
  const hayFiltros = !!(
    filtros.buscar.trim() ||
    filtros.estado ||
    filtros.fecha
  );
  const cambiarFiltros = (cambios: Partial<Omit<DatosFiltros, "pagina">>) =>
    establecerFiltros((anteriores) => ({
      ...anteriores,
      ...cambios,
      pagina: 1,
      estado:
        cambios.vista && cambios.vista !== anteriores.vista
          ? ""
          : (cambios.estado ?? anteriores.estado),
    }));
  const limpiarFiltros = () =>
    establecerFiltros((anteriores) => ({
      ...anteriores,
      buscar: "",
      estado: "",
      fecha: "",
      pagina: 1,
    }));
  const actualizar = () => {
    consulta.recargar();
    resumen.recargar();
  };
  const reintentar = () => {
    establecerFiltros((anteriores) => ({ ...anteriores, pagina: 1 }));
    actualizar();
  };
  const hayFilas = !!consulta.datos?.results.length;
  const cargandoResultados =
    consulta.cargando || (!consulta.fallo && !hayFilas && resumen.cargando);
  return (
    <>
      <div className={`${estilos.pagina} space-y-5`}>
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1
              className={`${estilos.titulo} text-2xl font-semibold text-gray-900 dark:text-white`}
            >
              {t("titulo")}
            </h1>
            <div className="flex flex-wrap items-center gap-5">
              <div className="hidden sm:block">
                <MigasPagina ocultarTitulo pageTitle={t("titulo")} />
              </div>
              {permisos.ver && permisos.crear && (
                <Link
                  href="/despachos/nuevo"
                  className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
                >
                  <IconoAgregar className="size-4" aria-hidden="true" />
                  {t("nuevo")}
                </Link>
              )}
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t("subtituloListado")}
          </p>
        </header>
        {!permisos.ver ? (
          <p role="alert" className={`${clasePanel} p-6`}>
            {comun("sinPermiso")}
          </p>
        ) : (
          <section
            className={`${clasePanel} @container min-w-0 overflow-hidden`}
            aria-labelledby="titulo-listado-despachos"
          >
            <FiltrosListadoDespachos
              filtros={filtros}
              resumen={resumen.datos}
              cargando={consulta.cargando || resumen.cargando}
              hayFiltros={hayFiltros}
              alCambiar={cambiarFiltros}
              alLimpiar={limpiarFiltros}
              alActualizar={actualizar}
            />
            <h2 id="titulo-listado-despachos" className="sr-only">
              {t(
                filtros.vista === "activos"
                  ? "activosListado"
                  : "historialListado",
              )}
            </h2>
            {resumen.fallo && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300"
              >
                <p>{t("errorContadoresListado")}</p>
                <button
                  type="button"
                  onClick={resumen.recargar}
                  className="min-h-11 rounded-lg font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                >
                  {comun("recargar")}
                </button>
              </div>
            )}
            <div id="resultados-despachos" aria-busy={cargandoResultados}>
              {consulta.cargando || consulta.fallo || !hayFilas ? (
                <EstadoListadoDespachos
                  cargando={cargandoResultados}
                  fallo={consulta.fallo}
                  vista={filtros.vista}
                  hayFiltros={hayFiltros}
                  resumen={resumen.datos}
                  puedeCrear={permisos.crear}
                  puedeVerPreparaciones={!!sesion.permisos_preparaciones?.ver}
                  alRecargar={reintentar}
                  alLimpiar={limpiarFiltros}
                  alOtraVista={() =>
                    cambiarFiltros({
                      vista:
                        filtros.vista === "activos" ? "historial" : "activos",
                    })
                  }
                />
              ) : (
                <div key={consulta.clave} className={estilos.entrada}>
                  <p
                    role="status"
                    className="border-t border-gray-100 px-5 py-3 text-theme-xs text-gray-600 sm:px-6 dark:border-gray-800 dark:text-gray-300"
                  >
                    {t("resultadosListado", {
                      cantidad: consulta.datos!.count,
                    })}
                  </p>
                  <div role="table" aria-label={t("viajesListado")}>
                    <div
                      role="rowgroup"
                      className="hidden bg-gray-50 px-5 py-3 sm:px-6 @4xl:block dark:bg-gray-800/40"
                    >
                      <div
                        role="row"
                        className={`grid items-center gap-4 ${columnasListadoDespachos}`}
                      >
                        {[
                          "viajeListado",
                          "transporte",
                          "destinosListado",
                          "estadoListado",
                          "accionListado",
                        ].map((clave) => (
                          <div
                            role="columnheader"
                            key={clave}
                            className="text-theme-xs font-medium text-gray-600 dark:text-gray-300"
                          >
                            {t(clave)}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div
                      role="rowgroup"
                      className="divide-y divide-gray-100 dark:divide-gray-800"
                    >
                      {consulta.datos!.results.map((despacho) => (
                        <FilaListadoDespachos
                          key={despacho.id}
                          despacho={despacho}
                          puedeEditar={permisos.editar}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {hayFilas && !consulta.cargando && !consulta.fallo && (
              <div className="px-5 pb-5 sm:px-6">
                <Paginador
                  pagina={filtros.pagina}
                  total={consulta.datos!.count}
                  alCambiar={(pagina) =>
                    establecerFiltros((anteriores) => ({
                      ...anteriores,
                      pagina,
                    }))
                  }
                  ocupado={consulta.cargando}
                />
              </div>
            )}
          </section>
        )}
      </div>
      <Notificaciones toasts={avisos.avisos} onDismiss={avisos.cerrarAviso} />
    </>
  );
}
