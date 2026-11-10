"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus as IconoAgregar,
  RefreshCw as IconoActualizar,
  DatabaseBackup as IconoRespaldo,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import Button from "@/components/ui/button/Button";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import Paginador from "@/components/compras/PaginadorCompras";
import useAvisosLogistica from "@/components/logistica/useAvisosLogistica";
import { clasePanel } from "@/components/logistica/tipos";
import HistorialRespaldos from "./HistorialRespaldos";
import type { PaginaRespaldos, Respaldo } from "./tipos";

export default function GestionRespaldos({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("respaldos"),
    navegador = useRouter();
  const avisos = useAvisosLogistica();
  const { tratarError } = avisos;
  const [pagina, establecerPagina] = useState(1),
    [revision, establecerRevision] = useState(0);
  const [consulta, establecerConsulta] = useState<{
    pagina: number;
    datos?: PaginaRespaldos;
    fallo?: boolean;
  } | null>(null);
  const [creando, establecerCreando] = useState(false),
    [incierta, establecerIncierta] = useState(false);
  const [descargando, establecerDescargando] = useState<string | null>(null);
  const [sesionVigente, establecerSesionVigente] = useState(true);
  const vigente = useRef(true),
    solicitud = useRef<string | null>(null),
    ocupada = useRef(false);
  const operaciones = useRef(new Set<AbortController>());
  const permisos = sesion.permisos_respaldos;
  const recargar = useCallback(
    () => establecerRevision((valor) => valor + 1),
    [],
  );
  const datos = consulta?.pagina === pagina ? consulta.datos : undefined;
  const fallo = consulta?.pagina === pagina && consulta.fallo;

  useEffect(() => {
    vigente.current = true;
    const retirar = () => {
      vigente.current = false;
      solicitud.current = null;
      operaciones.current.forEach((controlador) => controlador.abort());
      operaciones.current.clear();
    };
    const cambiarCuenta = () => {
      retirar();
      establecerSesionVigente(false);
      navegador.refresh();
    };
    window.addEventListener("hortyfru:session-changed", cambiarCuenta);
    const cambiosEntrePestanas = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") cambiarCuenta();
    };
    window.addEventListener("storage", cambiosEntrePestanas);
    return () => {
      retirar();
      window.removeEventListener("hortyfru:session-changed", cambiarCuenta);
      window.removeEventListener("storage", cambiosEntrePestanas);
    };
  }, [navegador]);

  useEffect(() => {
    if (!sesionVigente || !permisos?.ver || sesion.acceso_publico) return;
    const controlador = new AbortController();
    const pendientes = operaciones.current;
    pendientes.add(controlador);
    void api<PaginaRespaldos>(`respaldos/?pagina=${pagina}`, {
      signal: controlador.signal,
    })
      .then((respuesta) => {
        if (vigente.current && !controlador.signal.aborted)
          establecerConsulta({ pagina, datos: respuesta });
      })
      .catch((error) => {
        if (!vigente.current || controlador.signal.aborted) return;
        if (error instanceof ErrorApi && error.status === 404 && pagina > 1) {
          establecerPagina(1);
          return;
        }
        establecerConsulta({ pagina, fallo: true });
        tratarError(error);
      });
    return () => {
      controlador.abort();
      pendientes.delete(controlador);
    };
  }, [
    pagina,
    revision,
    permisos?.ver,
    sesion.acceso_publico,
    sesionVigente,
    tratarError,
  ]);

  useEffect(() => {
    if (!datos?.en_preparacion || !sesionVigente) return;
    const reloj = setInterval(recargar, 4000);
    return () => clearInterval(reloj);
  }, [datos?.en_preparacion, recargar, sesionVigente]);

  async function crear() {
    if (ocupada.current || !vigente.current) return;
    ocupada.current = true;
    establecerCreando(true);
    solicitud.current ??= crypto.randomUUID();
    const controlador = new AbortController();
    operaciones.current.add(controlador);
    try {
      const resultado = await api<Respaldo>("respaldos/", {
        method: "POST",
        body: JSON.stringify({ solicitud_uuid: solicitud.current }),
        signal: controlador.signal,
      });
      if (!vigente.current || controlador.signal.aborted) return;
      solicitud.current = null;
      establecerIncierta(false);
      establecerPagina(1);
      recargar();
      avisos.notificar(
        resultado.estado === "fallido" ? t("errorCreacion") : t("solicitado"),
        resultado.estado === "fallido" ? "error" : "success",
      );
    } catch (error) {
      if (!vigente.current || controlador.signal.aborted) return;
      const resultadoIncierto =
        error instanceof ErrorApi &&
        (error.status === 0 || error.status >= 500);
      establecerIncierta(resultadoIncierto);
      if (!resultadoIncierto) solicitud.current = null;
      if (error instanceof ErrorApi && error.status === 409) {
        avisos.notificar(t("otroEnCurso"), "error");
        recargar();
      } else avisos.tratarError(error);
    } finally {
      operaciones.current.delete(controlador);
      ocupada.current = false;
      if (vigente.current) establecerCreando(false);
    }
  }

  async function descargar(respaldo: Respaldo) {
    if (descargando || !vigente.current) return;
    establecerDescargando(respaldo.id);
    const controlador = new AbortController();
    operaciones.current.add(controlador);
    try {
      const respuesta = await fetch(
        `/api/v1/respaldos/${respaldo.id}/descargar/`,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        },
      );
      if (!respuesta.ok) {
        if (respuesta.status === 410) throw new Error(t("archivoNoDisponible"));
        throw new ErrorApi(respuesta.status);
      }
      const contenido = await respuesta.blob();
      if (!vigente.current || controlador.signal.aborted) return;
      const direccion = URL.createObjectURL(contenido),
        enlace = document.createElement("a");
      enlace.href = direccion;
      enlace.download = respaldo.nombre;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(direccion), 1000);
    } catch (error) {
      if (!vigente.current || controlador.signal.aborted) return;
      if (error instanceof ErrorApi) avisos.tratarError(error);
      else
        avisos.notificar(
          error instanceof Error ? error.message : t("errorDescarga"),
          "error",
        );
    } finally {
      operaciones.current.delete(controlador);
      if (vigente.current) establecerDescargando(null);
    }
  }

  if (!sesionVigente || sesion.acceso_publico || !permisos?.ver)
    return <p role="alert">{t("sinPermiso")}</p>;
  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <MigasPagina pageTitle={t("titulo")} />
            <p className="max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("subtitulo")}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {t("soloLocal")}
            </span>
          </div>
          {permisos.crear && (
            <Button
              disabled={creando || (!incierta && !!datos?.en_preparacion)}
              onClick={crear}
              startIcon={<IconoAgregar className="size-4" aria-hidden="true" />}
            >
              {t(
                creando
                  ? "solicitando"
                  : incierta
                    ? "reintentarCreacion"
                    : "crear",
              )}
            </Button>
          )}
        </div>
        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("pausaCambios")}
        </p>
        {incierta && (
          <p
            role="status"
            className="text-sm text-warning-700 dark:text-warning-400"
          >
            {t("solicitudIncierta")}
          </p>
        )}
        <section
          className={`${clasePanel} overflow-hidden`}
          aria-labelledby="historial-respaldos"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 sm:px-6 dark:border-gray-800">
            <h2
              id="historial-respaldos"
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {t("historial")}
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={recargar}
              startIcon={
                <IconoActualizar className="size-4" aria-hidden="true" />
              }
            >
              {t("actualizar")}
            </Button>
          </div>
          {fallo ? (
            <div className="p-8 text-center">
              <p
                role="alert"
                className="mb-3 text-sm text-gray-600 dark:text-gray-300"
              >
                {t("errorConsulta")}
              </p>
              <Button size="sm" variant="outline" onClick={recargar}>
                {t("reintentar")}
              </Button>
            </div>
          ) : !datos ? (
            <p
              role="status"
              className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              {t("cargando")}
            </p>
          ) : !datos.results.length ? (
            <div className="p-10 text-center">
              <IconoRespaldo
                className="mx-auto mb-3 size-9 text-gray-400"
                aria-hidden="true"
              />
              <p className="font-medium text-gray-900 dark:text-white">
                {t("vacio")}
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t("vacioAyuda")}
              </p>
            </div>
          ) : (
            <HistorialRespaldos
              respaldos={datos.results}
              puedeDescargar={permisos.descargar}
              descargando={descargando}
              alDescargar={descargar}
            />
          )}
          {!!datos && datos.count > 10 && !fallo && (
            <div className="px-4 pb-4 sm:px-6">
              <Paginador
                pagina={pagina}
                total={datos.count}
                alCambiar={establecerPagina}
              />
            </div>
          )}
        </section>
      </div>
      <Notificaciones toasts={avisos.avisos} onDismiss={avisos.cerrarAviso} />
    </>
  );
}
