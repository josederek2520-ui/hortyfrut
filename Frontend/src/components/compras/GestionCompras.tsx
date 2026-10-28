"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus as IconoAgregar } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import CampoFecha from "@/components/form/CampoFecha";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import TablaCompras from "./TablaCompras";
import PaginadorCompras from "./PaginadorCompras";
import useAvisosCompras from "./useAvisosCompras";
import { clasePanel, type ResumenCompra, type PaginaCompra } from "./tipos";

export default function GestionCompras({
  sesion,
  fechaInicial = "",
}: {
  sesion: Sesion;
  fechaInicial?: string;
}) {
  const t = useTranslations("compras");
  const navegador = useRouter();
  const permisos = sesion.permisos_compras;
  const { avisos, cerrarAviso, tratarError } = useAvisosCompras(true);
  const [datos, establecerDatos] = useState<PaginaCompra<ResumenCompra> | null>(
    null,
  );
  const [resumen, establecerResumen] = useState<{
    total: number;
    borradores: number;
    registradas: number;
    canceladas: number;
  } | null>(null);
  const [buscar, establecerBuscar] = useState("");
  const [estado, establecerEstado] = useState("");
  const [fechaPedidos, establecerFechaPedidos] = useState(fechaInicial);
  const [fechaCompra, establecerFechaCompra] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [revision, establecerRevision] = useState(0);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
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
            pagina: String(pagina),
            ...(estado ? { estado } : {}),
            ...(fechaPedidos ? { fecha_pedidos: fechaPedidos } : {}),
            ...(fechaCompra ? { fecha_compra: fechaCompra } : {}),
          });
          const [listado, contadores] = await Promise.all([
            api<PaginaCompra<ResumenCompra>>(`compras/?${parametros}`, {
              signal: controlador.signal,
            }),
            api<NonNullable<typeof resumen>>(`compras/resumen/?${parametros}`, {
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
  }, [
    permisos.ver,
    buscar,
    estado,
    fechaPedidos,
    fechaCompra,
    pagina,
    revision,
    tratarError,
  ]);
  return (
    <>
      <div className="space-y-6">
        <div>
          <MigasPagina pageTitle={t("titulo")} />
          <p className="max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div
                role="group"
                aria-label={t("filtrarEstado")}
                className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
              >
                {[
                  { valor: "", clave: "todas", cantidad: resumen?.total },
                  {
                    valor: "borrador",
                    clave: "borradores",
                    cantidad: resumen?.borradores,
                  },
                  {
                    valor: "registrada",
                    clave: "registradas",
                    cantidad: resumen?.registradas,
                  },
                  {
                    valor: "cancelada",
                    clave: "canceladas",
                    cantidad: resumen?.canceladas,
                  },
                ].map((opcion) => (
                  <button
                    key={opcion.clave}
                    type="button"
                    aria-pressed={estado === opcion.valor}
                    onClick={() => {
                      establecerEstado(opcion.valor);
                      establecerPagina(1);
                    }}
                    className={`pestana-hortyfru inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${estado === opcion.valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
                  >
                    {t(opcion.clave)}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-theme-xs tabular-nums ${estado === opcion.valor ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400"}`}
                    >
                      {opcion.cantidad ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
              {permisos.crear && (
                <Button
                  size="sm"
                  startIcon={<IconoAgregar className="size-4" />}
                  onClick={() => navegador.push("/compras/nuevo")}
                >
                  {t("nuevaCompra")}
                </Button>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <Label htmlFor="buscar-compras">{t("buscarCompra")}</Label>
                <Input
                  id="buscar-compras"
                  type="search"
                  maxLength={150}
                  value={buscar}
                  placeholder={t("buscarCompraAyuda")}
                  onChange={(evento) => {
                    establecerBuscar(evento.target.value);
                    establecerPagina(1);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="filtro-fecha-pedidos-compras">
                  {t("fechaPedidos")}
                </Label>
                <CampoFecha
                  id="filtro-fecha-pedidos-compras"
                  value={fechaPedidos}
                  alCambiar={(fecha) => {
                    establecerFechaPedidos(fecha);
                    establecerPagina(1);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="filtro-fecha-compra">{t("fechaCompra")}</Label>
                <CampoFecha
                  id="filtro-fecha-compra"
                  value={fechaCompra}
                  alCambiar={(fecha) => {
                    establecerFechaCompra(fecha);
                    establecerPagina(1);
                  }}
                />
              </div>
            </div>
            {!!(buscar || estado || fechaPedidos || fechaCompra) && (
              <button
                type="button"
                className="rounded text-theme-xs font-medium text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                onClick={() => {
                  establecerBuscar("");
                  establecerEstado("");
                  establecerFechaPedidos("");
                  establecerFechaCompra("");
                  establecerPagina(1);
                  if (fechaInicial) navegador.replace("/compras");
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => establecerRevision((valor) => valor + 1)}
                >
                  {t("reintentar")}
                </Button>
              </div>
            ) : (
              <TablaCompras
                compras={datos?.results || []}
                cargando={cargando}
                filtrado={!!(buscar || estado || fechaPedidos || fechaCompra)}
                permisos={permisos}
                alCrear={() => navegador.push("/compras/nuevo")}
              />
            )}
            <PaginadorCompras
              pagina={pagina}
              total={datos?.count || 0}
              alCambiar={establecerPagina}
              ocupado={cargando || fallo}
            />
          </section>
        )}
      </div>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
