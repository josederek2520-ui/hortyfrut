"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Contenedor from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import { useModal } from "@/hooks/useModal";
import {
  LockIcon as IconoCandado,
  InfoIcon as IconoInformacion,
} from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import TablaActividad from "./TablaActividad";
import FiltrosActividad from "./FiltrosActividad";
import DetalleActividad from "./DetalleActividad";
import {
  FILTROS_VACIOS,
  type FiltrosActividad as DatosFiltros,
  type PaginaActividad,
  type OpcionesActividad,
  type ResumenActividad,
  type RegistroActividad,
  type DetalleActividad as DatosDetalle,
} from "./tipos";
import type { Session as Sesion } from "@/components/users/types";

export default function GestionActividad({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("actividad");
  const navegador = useRouter();
  const modal = useModal();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
  const [datos, establecerDatos] = useState<PaginaActividad | null>(null);
  const corte = useRef<number | null>(null);
  const [resumen, establecerResumen] = useState<ResumenActividad | null>(null);
  const [opciones, establecerOpciones] = useState<OpcionesActividad>({
    modulos: [],
    acciones: [],
  });
  const [buscar, establecerBuscar] = useState("");
  const [filtros, establecerFiltros] = useState<DatosFiltros>(FILTROS_VACIOS);
  const [resultado, establecerResultado] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [cargando, establecerCargando] = useState(true);
  const [abriendo, establecerAbriendo] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const [detalle, establecerDetalle] = useState<DatosDetalle | null>(null);
  const permitido = sesion.permisos_actividad.ver;
  const tratarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.status === 401) {
        navegador.replace("/signin");
        navegador.refresh();
        return;
      }
      notificar(
        t(
          error instanceof ErrorApi && error.status === 403
            ? "accesoDenegado"
            : error instanceof ErrorApi && error.status === 400
              ? "filtrosInvalidos"
              : "errorCarga",
        ),
        "error",
      );
    },
    [navegador, notificar, t],
  );
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo("");
        const parametros = new URLSearchParams({
          buscar,
          resultado,
          page: String(pagina),
        });
        Object.entries(filtros).forEach(([clave, valor]) => {
          if (valor) parametros.set(clave, valor);
        });
        if (corte.current !== null)
          parametros.set("corte", String(corte.current));
        try {
          const [listado, catalogo] = await Promise.all([
            api<PaginaActividad>(`actividad/?${parametros}`, {
              signal: controlador.signal,
            }),
            api<OpcionesActividad>("actividad/opciones/", {
              signal: controlador.signal,
            }),
          ]);
          if (!controlador.signal.aborted) {
            establecerDatos(listado);
            corte.current = listado.corte;
            establecerResumen(listado.resumen);
            establecerOpciones(catalogo);
          }
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(
                error instanceof ErrorApi && error.status === 403
                  ? t("accesoDenegado")
                  : t("errorCarga"),
              );
              tratarError(error);
            }
          }
        } finally {
          if (!controlador.signal.aborted) establecerCargando(false);
        }
      },
      buscar ? 300 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [permitido, buscar, filtros, resultado, pagina, revision, t, tratarError]);
  const reiniciarConsulta = () => {
    corte.current = null;
    establecerPagina(1);
    establecerRevision((valor) => valor + 1);
  };
  const verDetalle = async (registro: RegistroActividad) => {
    if (abriendo) return;
    establecerAbriendo(true);
    try {
      establecerDetalle(await api<DatosDetalle>(`actividad/${registro.id}/`));
      modal.openModal();
    } catch (error) {
      tratarError(error);
    } finally {
      establecerAbriendo(false);
    }
  };
  if (!permitido)
    return (
      <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
        <IconoCandado className="mx-auto mb-4 size-10 text-gray-400" />
        <h1 className="font-semibold text-gray-900 dark:text-white">
          {t("restringido")}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("accesoDenegado")}
        </p>
      </div>
    );
  const pestanas = [
    { clave: "todos", valor: "", cantidad: resumen?.total },
    { clave: "exitosos", valor: "exito", cantidad: resumen?.exitosos },
    { clave: "rechazados", valor: "rechazado", cantidad: resumen?.rechazados },
    { clave: "errores", valor: "error", cantidad: resumen?.errores },
  ];
  const paginas = Math.max(1, Math.ceil((datos?.count || 0) / 10));
  return (
    <div className="space-y-6">
      <div>
        <MigasPagina pageTitle={t("titulo")} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("subtitulo")}
        </p>
      </div>
      <Contenedor
        title={t("titulo")}
        header={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="group"
              aria-label={t("filtrarResultado")}
              className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
            >
              {pestanas.map((pestana) => (
                <button
                  key={pestana.clave}
                  type="button"
                  aria-pressed={resultado === pestana.valor}
                  onClick={() => {
                    establecerResultado(pestana.valor);
                    reiniciarConsulta();
                  }}
                  className={`pestana-hortyfru inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-theme-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${resultado === pestana.valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
                >
                  {t(pestana.clave)}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-theme-xs tabular-nums ${resultado === pestana.valor ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400"}`}
                  >
                    {pestana.cantidad ?? "—"}
                  </span>
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              <IconoCandado className="size-3.5" />
              {t("soloLectura")}
            </span>
          </div>
        }
      >
        <FiltrosActividad
          buscar={buscar}
          filtros={filtros}
          opciones={opciones}
          cargando={cargando}
          alBuscar={(valor) => {
            establecerBuscar(valor);
            reiniciarConsulta();
          }}
          alFiltrar={(valores) => {
            establecerFiltros(valores);
            reiniciarConsulta();
          }}
          alActualizar={reiniciarConsulta}
        />
        {fallo ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
          >
            <span className="flex-1">{fallo}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => establecerRevision((valor) => valor + 1)}
            >
              {t("reintentar")}
            </Button>
          </div>
        ) : (
          <TablaActividad
            registros={datos?.results || []}
            cargando={cargando}
            abriendo={abriendo}
            alVer={(registro) => void verDetalle(registro)}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p
            role="status"
            className="text-theme-xs text-gray-500 dark:text-gray-400"
          >
            {t("paginacion", {
              desde: datos?.count ? (pagina - 1) * 10 + 1 : 0,
              hasta: Math.min(pagina * 10, datos?.count || 0),
              total: datos?.count || 0,
            })}
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={pagina <= 1 || cargando}
              onClick={() => establecerPagina((valor) => valor - 1)}
            >
              {t("anterior")}
            </Button>
            <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
              {pagina} / {paginas}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina >= paginas || cargando}
              onClick={() => establecerPagina((valor) => valor + 1)}
            >
              {t("siguiente")}
            </Button>
          </div>
        </div>
      </Contenedor>
      <p className="flex items-start gap-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
        <IconoInformacion className="mt-0.5 size-4 shrink-0" />
        {t("notaCobertura")}
      </p>
      {abriendo && (
        <p
          role="status"
          className="text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      )}
      {modal.isOpen && detalle && (
        <DetalleActividad registro={detalle} alCerrar={modal.closeModal} />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
