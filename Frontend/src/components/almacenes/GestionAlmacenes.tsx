"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import type { Session as Sesion } from "@/components/users/types";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import BarraAlmacenes from "./BarraAlmacenes";
import TablaAlmacenes from "./TablaAlmacenes";
import ConfirmarEstadoAlmacen from "./ConfirmarEstadoAlmacen";
import useAvisosAlmacenes from "./useAvisosAlmacenes";
import {
  clasePanel,
  type Almacen,
  type PaginaAlmacenes,
  type ResumenAlmacenes,
} from "./tipos";

export default function GestionAlmacenes({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("almacenes");
  const navegador = useRouter();
  const permisos = sesion.permisos_almacenes;
  const { avisos, notificar, cerrarAviso, tratarError } =
    useAvisosAlmacenes(true);
  const modal = useModal();
  const [datos, establecerDatos] = useState<PaginaAlmacenes | null>(null);
  const [resumen, establecerResumen] = useState<ResumenAlmacenes | null>(null);
  const [buscar, establecerBuscar] = useState("");
  const [estado, establecerEstado] = useState("");
  const [orden, establecerOrden] = useState("nombre");
  const [pagina, establecerPagina] = useState(1);
  const [revision, establecerRevision] = useState(0);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [seleccionado, establecerSeleccionado] = useState<Almacen | null>(null);
  useEffect(() => {
    if (!permisos.ver) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo(false);
        try {
          const parametros = new URLSearchParams({
            buscar,
            orden,
            pagina: String(pagina),
            ...(estado ? { activo: estado } : {}),
          });
          const [listado, contadores] = await Promise.all([
            api<PaginaAlmacenes>(`almacenes/?${parametros}`, {
              signal: controlador.signal,
            }),
            api<ResumenAlmacenes>(`almacenes/resumen/?${parametros}`, {
              signal: controlador.signal,
            }),
          ]);
          if (!controlador.signal.aborted) {
            establecerDatos(listado);
            establecerResumen(contadores);
          }
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(true);
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
  }, [permisos.ver, buscar, estado, orden, pagina, revision, tratarError]);
  const recargar = () => {
    modal.closeModal();
    establecerSeleccionado(null);
    establecerRevision((valor) => valor + 1);
  };
  const paginas = Math.max(1, Math.ceil((datos?.count || 0) / 10));
  return (
    <>
      <div className="space-y-6">
        <div>
          <MigasPagina pageTitle={t("titulo")} />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        {!permisos.ver ? (
          <div role="alert" className={`${clasePanel} p-8 text-center`}>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t("restringido")}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t("accesoDenegado")}
            </p>
          </div>
        ) : (
          <section
            className={`${clasePanel} space-y-5 p-4 sm:p-6`}
            aria-label={t("titulo")}
          >
            <BarraAlmacenes
              resumen={resumen}
              estado={estado}
              buscar={buscar}
              orden={orden}
              puedeCrear={permisos.crear}
              alEstado={(valor) => {
                establecerEstado(valor);
                establecerPagina(1);
              }}
              alBuscar={(valor) => {
                establecerBuscar(valor);
                establecerPagina(1);
              }}
              alOrden={(valor) => {
                establecerOrden(valor);
                establecerPagina(1);
              }}
              alCrear={() => navegador.push("/almacenes/nuevo")}
            />
            {!!(buscar || estado || orden !== "nombre") && (
              <button
                type="button"
                className="rounded text-theme-xs font-medium text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                onClick={() => {
                  establecerBuscar("");
                  establecerEstado("");
                  establecerOrden("nombre");
                  establecerPagina(1);
                }}
              >
                {t("limpiarFiltros")}
              </button>
            )}
            {fallo ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
              >
                <p className="flex-1">{t("errorCarga")}</p>
                <Button size="sm" variant="outline" onClick={recargar}>
                  {t("reintentar")}
                </Button>
              </div>
            ) : (
              <TablaAlmacenes
                registros={datos?.results || []}
                cargando={cargando}
                filtrado={!!(buscar || estado)}
                permisos={permisos}
                alCrear={() => navegador.push("/almacenes/nuevo")}
                alEstado={(almacen) => {
                  establecerSeleccionado(almacen);
                  modal.openModal();
                }}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-gray-800">
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
                  disabled={pagina <= 1 || cargando || fallo}
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
                  disabled={pagina >= paginas || cargando || fallo}
                  onClick={() => establecerPagina((valor) => valor + 1)}
                >
                  {t("siguiente")}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
      {modal.isOpen && seleccionado && (
        <ConfirmarEstadoAlmacen
          almacen={seleccionado}
          alCerrar={modal.closeModal}
          alRecargar={recargar}
          alError={tratarError}
          alGuardar={() => {
            notificar(t("estadoGuardado"));
            recargar();
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
