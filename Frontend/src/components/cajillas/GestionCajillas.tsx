"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Container as IconoCajilla, Plus as IconoAgregar } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import {
  clasePanel,
  type PaginaCompra as Pagina,
} from "@/components/compras/tipos";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { Session as Sesion } from "@/components/users/types";
import useAvisosCajillas from "./useAvisosCajillas";
import ResumenCajillas from "./ResumenCajillas";
import TablaCajillas from "./TablaCajillas";
import HistorialCajillas from "./HistorialCajillas";
import type { Cajilla, ResumenCajillas as DatosResumen } from "./tipos";

export default function GestionCajillas({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("cajillas");
  const { avisos, cerrarAviso, tratarError } = useAvisosCajillas();
  const permitido = !!sesion.permisos_cajillas?.ver;
  const [vista, establecerVista] = useState<"colores" | "historial">("colores");
  const [buscar, establecerBuscar] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<Pagina<Cajilla> | null>(null);
  const [resumen, establecerResumen] = useState<DatosResumen>();
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        try {
          const [lista, totales] = await Promise.all([
            api<Pagina<Cajilla>>(
              `cajillas/?${new URLSearchParams({ buscar, pagina: String(pagina) })}`,
              { signal: controlador.signal },
            ),
            api<DatosResumen>("cajillas/resumen/", {
              signal: controlador.signal,
            }),
          ]);
          if (!controlador.signal.aborted) {
            establecerDatos(lista);
            establecerResumen(totales);
          }
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ApiError && error.status === 404 && pagina > 1)
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
      buscar ? 250 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [permitido, buscar, pagina, revision, tratarError]);
  if (!permitido)
    return (
      <p role="alert" className={`${clasePanel} p-8`}>
        {t("restringido")}
      </p>
    );
  return (
    <div className="space-y-6">
      <MigasPagina pageTitle={t("titulo")} />
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <IconoCajilla className="size-6" aria-hidden="true" />
              </span>
              {t("titulo")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("subtitulo")}
            </p>
          </div>
          {sesion.permisos_cajillas.crear && (
            <Link
              href="/cajillas/nuevo"
              className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
            >
              <IconoAgregar className="size-4" aria-hidden="true" />
              {t("nuevoColor")}
            </Link>
          )}
        </div>
      </section>
      <ResumenCajillas resumen={resumen} />
      <section className={`${clasePanel} space-y-5 p-5 sm:p-6`}>
        <div
          role="group"
          aria-label={t("vistas")}
          className="flex flex-wrap gap-2"
        >
          {["colores", "historial"].map((valor) => (
            <Button
              key={valor}
              size="sm"
              variant={vista === valor ? "primary" : "outline"}
              aria-pressed={vista === valor}
              onClick={() => establecerVista(valor as typeof vista)}
            >
              {t(valor)}
            </Button>
          ))}
        </div>
        {vista === "historial" ? (
          <HistorialCajillas alError={tratarError} />
        ) : (
          <>
            <CampoDirectorio
              id="buscar-color-cajilla"
              etiqueta={t("buscarColor")}
              type="search"
              maxLength={60}
              value={buscar}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
                establecerCargando(true);
                establecerFallo(false);
              }}
            />
            {fallo ? (
              <div role="alert" className="space-y-3 py-8 text-center">
                <p>{t("errorCarga")}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    establecerFallo(false);
                    establecerCargando(true);
                    establecerRevision((valor) => valor + 1);
                  }}
                >
                  {t("reintentar")}
                </Button>
              </div>
            ) : cargando ? (
              <p
                role="status"
                className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                {t("cargando")}
              </p>
            ) : !datos?.results.length ? (
              <div className="py-12 text-center">
                <IconoCajilla
                  className="mx-auto mb-3 size-10 text-gray-300 dark:text-gray-600"
                  aria-hidden="true"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t(buscar ? "sinResultados" : "sinColores")}
                </p>
              </div>
            ) : (
              <TablaCajillas registros={datos.results} />
            )}
            <PaginadorCompras
              pagina={pagina}
              total={datos?.count || 0}
              ocupado={cargando || fallo}
              alCambiar={(valor) => {
                establecerPagina(valor);
                establecerCargando(true);
              }}
            />
          </>
        )}
      </section>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
