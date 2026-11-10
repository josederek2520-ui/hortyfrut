"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus as IconoAgregar,
  Search as IconoBuscar,
  X as IconoLimpiar,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Session as Sesion } from "@/components/users/types";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import Paginador from "@/components/compras/PaginadorCompras";
import useAvisosLogistica from "@/components/logistica/useAvisosLogistica";
import useConsultaLogistica from "@/components/logistica/useConsultaLogistica";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import {
  clasePanel,
  claseEntrada,
  type PaginaLogistica,
} from "@/components/logistica/tipos";
import type { Vehiculo } from "./tipos";
import TarjetaVehiculo from "./TarjetaVehiculo";

export default function GestionVehiculos({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("vehiculos");
  const comun = useTranslations("logistica");
  const [buscar, establecerBuscar] = useState("");
  const [estado, establecerEstado] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const avisos = useAvisosLogistica();
  const consulta = useConsultaLogistica<PaginaLogistica<Vehiculo>>(
    sesion.permisos_vehiculos.ver
      ? `vehiculos/?${new URLSearchParams({ buscar, pagina: String(pagina), ...(estado ? { activo: estado } : {}) })}`
      : null,
    avisos.tratarError,
  );
  const resumen = useConsultaLogistica<{
    total: number;
    activos: number;
    inactivos: number;
  }>(
    sesion.permisos_vehiculos.ver ? "vehiculos/resumen/" : null,
    avisos.tratarError,
  );
  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <MigasPagina pageTitle={t("titulo")} />
            <p className="max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("subtitulo")}
            </p>
          </div>
          {sesion.permisos_vehiculos.crear && (
            <Link
              href="/vehiculos/nuevo"
              className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-700 focus-visible:ring-3 focus-visible:ring-brand-400"
            >
              <IconoAgregar className="size-4" />
              {t("nuevo")}
            </Link>
          )}
        </div>
        {!sesion.permisos_vehiculos.ver ? (
          <p role="alert">{comun("sinPermiso")}</p>
        ) : (
          <>
            <dl
              className={`${clasePanel} grid grid-cols-3 divide-x divide-gray-100 px-2 py-4 sm:py-5 dark:divide-gray-800`}
            >
              {(["total", "activos", "inactivos"] as const).map((clave) => (
                <div key={clave} className="px-3 sm:px-6">
                  <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t(clave)}
                  </dt>
                  <dd className="mt-1 text-2xl leading-tight font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">
                    {resumen.datos?.[clave] ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <section className="space-y-5" aria-label={t("titulo")}>
              <div
                className={`${clasePanel} flex flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between`}
              >
                <div className="relative lg:w-96">
                  <IconoBuscar className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-400" />
                  <input
                    aria-label={t("buscar")}
                    placeholder={t("buscar")}
                    type="search"
                    className={`${claseEntrada} ps-10`}
                    value={buscar}
                    onChange={(evento) => {
                      establecerBuscar(evento.target.value);
                      establecerPagina(1);
                    }}
                  />
                </div>
                <div
                  className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100/70 p-1 dark:bg-gray-800"
                  role="group"
                  aria-label={t("filtrarEstado")}
                >
                  {[
                    ["", "todos"],
                    ["true", "activos"],
                    ["false", "inactivos"],
                  ].map(([valor, clave]) => (
                    <button
                      key={clave}
                      type="button"
                      aria-pressed={estado === valor}
                      className={`min-h-11 flex-1 rounded-lg px-4 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand-400 ${estado === valor ? "pestana-hortyfru font-semibold" : "text-gray-600 dark:text-gray-300"}`}
                      onClick={() => {
                        establecerEstado(valor);
                        establecerPagina(1);
                      }}
                    >
                      {t(clave)}
                    </button>
                  ))}
                </div>
              </div>
              <div aria-busy={consulta.cargando}>
                {consulta.cargando ||
                consulta.fallo ||
                !consulta.datos?.results.length ? (
                  <div className={`${clasePanel} p-4`}>
                    <EstadoConsulta
                      cargando={consulta.cargando}
                      fallo={consulta.fallo}
                      vacio="sinVehiculos"
                      alRecargar={consulta.recargar}
                    />
                    {!consulta.cargando &&
                      !consulta.fallo &&
                      (buscar || estado) && (
                        <div className="mb-4 flex justify-center">
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                            onClick={() => {
                              establecerBuscar("");
                              establecerEstado("");
                              establecerPagina(1);
                            }}
                          >
                            <IconoLimpiar
                              className="size-4"
                              aria-hidden="true"
                            />
                            {t("limpiarFiltros")}
                          </button>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {consulta.datos.results.map((vehiculo) => (
                      <TarjetaVehiculo key={vehiculo.id} vehiculo={vehiculo} />
                    ))}
                  </div>
                )}
              </div>
              {!!consulta.datos?.results.length && !consulta.fallo && (
                <div className={`${clasePanel} px-4 pt-0 pb-4 sm:px-5`}>
                  <Paginador
                    pagina={pagina}
                    total={consulta.datos?.count || 0}
                    alCambiar={establecerPagina}
                    ocupado={consulta.cargando}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <Notificaciones toasts={avisos.avisos} onDismiss={avisos.cerrarAviso} />
    </>
  );
}
