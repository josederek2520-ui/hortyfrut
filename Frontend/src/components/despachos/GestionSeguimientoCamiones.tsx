"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, MapPinned } from "lucide-react";
import type { Session as Sesion } from "@/components/users/types";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import useAvisos from "@/components/logistica/useAvisosLogistica";
import { clasePanel, type PaginaLogistica } from "@/components/logistica/tipos";
import useConsultaListado from "./useConsultaListadoDespachos";
import { type Despacho } from "./tipos";
import {
  consultaSeguimientoCamiones,
  elegirViajeSupervision,
  type FiltrosSeguimientoCamiones,
} from "./seguimientoCamiones";
import ListadoViajesSupervision from "./ListadoViajesSupervision";
import FichaSeguimientoCamion from "./FichaSeguimientoCamion";
import estilos from "./estilosSeguimientoCamiones.module.css";

export default function GestionSeguimientoCamiones({
  sesion,
  viajeInicial = null,
}: {
  sesion: Sesion;
  viajeInicial?: number | null;
}) {
  const t = useTranslations("seguimientoCamiones"),
    comun = useTranslations("logistica");
  const avisos = useAvisos();
  const [filtros, establecerFiltros] = useState<FiltrosSeguimientoCamiones>({
    buscar: "",
    estado: "",
    pagina: 1,
  });
  const ruta = consultaSeguimientoCamiones(filtros);
  const [seleccion, establecerSeleccion] = useState<{
    ruta: string;
    id: number;
  } | null>(() => (viajeInicial ? { ruta, id: viajeInicial } : null));
  const consulta = useConsultaListado<PaginaLogistica<Despacho>>(
    sesion.permisos_despachos.ver ? ruta : null,
    avisos.tratarError,
    filtros.buscar.trim() ? 220 : 0,
  );
  const viajes = consulta.datos?.results ?? [];
  const identificador = elegirViajeSupervision(viajes, seleccion, ruta);
  const cambiarFiltros = (cambios: Partial<FiltrosSeguimientoCamiones>) =>
    establecerFiltros((anteriores) => ({
      ...anteriores,
      ...cambios,
      pagina: cambios.pagina ?? 1,
    }));
  return (
    <>
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {t("titulo")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              {t("subtitulo")}
            </p>
          </div>
          {sesion.permisos_despachos.ver && (
            <Button
              size="sm"
              variant="outline"
              disabled={consulta.cargando}
              startIcon={<RefreshCw className="size-4" />}
              onClick={consulta.recargar}
            >
              {t("actualizar")}
            </Button>
          )}
        </header>
        {!sesion.permisos_despachos.ver ? (
          <p role="alert" className={`${clasePanel} p-6`}>
            {comun("sinPermiso")}
          </p>
        ) : (
          <div className={estilos.distribucion}>
            <ListadoViajesSupervision
              filtros={filtros}
              consulta={consulta}
              identificador={identificador}
              alElegir={(id) => establecerSeleccion({ ruta, id })}
              alCambiar={cambiarFiltros}
            />
            <div className="min-w-0" aria-busy={consulta.cargando}>
              {identificador && !consulta.cargando && !consulta.fallo ? (
                <FichaSeguimientoCamion
                  key={identificador}
                  identificador={identificador}
                  alError={avisos.tratarError}
                />
              ) : (
                <div
                  className={`${clasePanel} flex min-h-96 flex-col items-center justify-center gap-4 p-8 text-center`}
                  role="status"
                >
                  <MapPinned className="size-10 text-brand-500" />
                  <p className="max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {t(
                      consulta.cargando
                        ? "cargandoViajes"
                        : consulta.fallo
                          ? "errorViajes"
                          : "eligeViaje",
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Notificaciones toasts={avisos.avisos} onDismiss={avisos.cerrarAviso} />
    </>
  );
}
