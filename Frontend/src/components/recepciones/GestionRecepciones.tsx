"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  PackageCheck as IconoRecepcion,
  Plus as IconoAgregar,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import MigasPagina from "@/components/common/PageBreadCrumb";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  clasePanel,
  claseEstado,
  type PaginaCompra,
} from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import useAvisosInventario from "@/components/inventario/useAvisosInventario";
import type { Session as Sesion } from "@/components/users/types";
import type { ResumenRecepcion } from "./tipos";
import IndicadoresRecepciones, {
  type ResumenEstadosRecepciones,
} from "./IndicadoresRecepciones";

export default function GestionRecepciones({
  sesion,
  compraInicial,
}: {
  sesion: Sesion;
  compraInicial?: number;
}) {
  const t = useTranslations("recepciones");
  const idioma = useLocale();
  const { avisos, cerrarAviso, tratarError } = useAvisosInventario();
  const [buscar, establecerBuscar] = useState("");
  const [fecha, establecerFecha] = useState("");
  const [estado, establecerEstado] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] =
    useState<PaginaCompra<ResumenRecepcion> | null>(null);
  const [resumen, establecerResumen] = useState<ResumenEstadosRecepciones>();
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const permitido = !!sesion.permisos_recepciones?.ver;
  const cambiarFiltro = () => {
    establecerPagina(1);
    establecerCargando(true);
    establecerFallo(false);
  };
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        const consulta = new URLSearchParams({
          buscar,
          pagina: String(pagina),
        });
        if (fecha) consulta.set("fecha", fecha);
        if (estado) consulta.set("estado", estado);
        if (compraInicial) consulta.set("compra", String(compraInicial));
        try {
          const [lista, totales] = await Promise.all([
            api<PaginaCompra<ResumenRecepcion>>(`recepciones/?${consulta}`, {
              signal: controlador.signal,
            }),
            api<ResumenEstadosRecepciones>(`recepciones/resumen/?${consulta}`, {
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
  }, [
    buscar,
    fecha,
    estado,
    pagina,
    compraInicial,
    permitido,
    revision,
    tratarError,
  ]);
  if (!permitido)
    return (
      <p role="alert" className={`${clasePanel} p-8`}>
        {t("restringido")}
      </p>
    );
  return (
    <div className="space-y-6">
      <MigasPagina pageTitle={t("titulo")} ocultarTitulo />
      <section aria-labelledby="titulo-recepciones">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              id="titulo-recepciones"
              className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white"
            >
              {t("titulo")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("subtitulo")}
            </p>
          </div>
          {sesion.permisos_recepciones.crear && (
            <Link
              href={
                compraInicial
                  ? `/recepciones/nuevo?compra=${compraInicial}`
                  : "/recepciones/nuevo"
              }
              className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
            >
              <IconoAgregar className="size-4" aria-hidden="true" />
              {t("nueva")}
            </Link>
          )}
        </div>
      </section>
      <IndicadoresRecepciones
        resumen={resumen}
        estado={estado}
        cargando={cargando || fallo}
        alElegir={(valor) => {
          establecerEstado(valor);
          cambiarFiltro();
        }}
      />
      <section className={`${clasePanel} p-5 sm:p-6`}>
        {compraInicial && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
            <p>
              {t("filtrandoCompra", {
                codigo: `COM-${String(compraInicial).padStart(6, "0")}`,
              })}
            </p>
            <Link href="/recepciones" className={claseEnlaceInventario}>
              {t("verTodas")}
            </Link>
          </div>
        )}
        <div className="mb-5 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_16rem_auto]">
          <CampoDirectorio
            id="buscar-recepciones"
            etiqueta={t("buscar")}
            type="search"
            maxLength={150}
            value={buscar}
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              cambiarFiltro();
            }}
          />
          <div>
            <Label htmlFor="fecha-filtro-recepcion">
              {t("fechaRecepcion")}
            </Label>
            <CampoFecha
              id="fecha-filtro-recepcion"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                cambiarFiltro();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1 lg:pt-6">
            <Button
              size="sm"
              variant="outline"
              aria-pressed={!estado}
              aria-controls="resultados-recepciones"
              onClick={() => {
                establecerEstado("");
                cambiarFiltro();
              }}
            >
              {t("todasRecepciones")}
              {!cargando && !fallo && resumen && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs tabular-nums dark:bg-gray-800">
                  {new Intl.NumberFormat(idioma).format(resumen.total)}
                </span>
              )}
            </Button>
          </div>
        </div>
        <div
          id="resultados-recepciones"
          role="region"
          aria-busy={cargando}
          aria-label={t("resultadosRecepciones")}
        >
          {fallo ? (
            <div role="alert" className="space-y-4 py-8 text-center">
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
              <IconoRecepcion
                className="mx-auto mb-3 size-9 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("sinResultados")}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {datos.results.map((recepcion) => (
                  <article
                    key={recepcion.id}
                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/recepciones/${recepcion.id}`}
                        className="font-semibold text-brand-700 underline dark:text-brand-300"
                      >
                        {recepcion.codigo}
                      </Link>
                      <span
                        className={claseEstado(
                          recepcion.estado === "confirmada"
                            ? "registrada"
                            : recepcion.estado,
                        )}
                      >
                        {t(`estados.${recepcion.estado}`)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">
                      {recepcion.almacen_nombre} ·{" "}
                      {mostrarFecha(recepcion.fecha_recepcion, idioma)}
                    </p>
                    <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                      {recepcion.compra_codigo || t("ingresoDirecto")} ·{" "}
                      {t("lineasCantidad", {
                        cantidad: recepcion.cantidad_productos,
                      })}
                    </p>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block dark:border-gray-800">
                <table className="w-full text-start text-sm">
                  <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      {[
                        "recepcion",
                        "fechaRecepcion",
                        "almacen",
                        "origen",
                        "estado",
                        "responsable",
                      ].map((clave) => (
                        <th
                          key={clave}
                          scope="col"
                          className="px-4 py-3 text-start font-medium whitespace-nowrap"
                        >
                          {t(clave)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.results.map((recepcion) => (
                      <tr
                        key={recepcion.id}
                        className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                      >
                        <td className="px-4 py-4">
                          <Link
                            href={`/recepciones/${recepcion.id}`}
                            className="rounded font-semibold text-brand-700 underline focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                          >
                            {recepcion.codigo}
                          </Link>
                          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                            {t("lineasCantidad", {
                              cantidad: recepcion.cantidad_productos,
                            })}
                          </p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {mostrarFecha(recepcion.fecha_recepcion, idioma)}
                        </td>
                        <td className="px-4 py-4">
                          {recepcion.almacen_nombre}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {recepcion.compra_codigo || t("ingresoDirecto")}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={claseEstado(
                              recepcion.estado === "confirmada"
                                ? "registrada"
                                : recepcion.estado,
                            )}
                          >
                            {t(`estados.${recepcion.estado}`)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {recepcion.responsable_nombre}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <PaginadorCompras
          pagina={pagina}
          total={datos?.count || 0}
          ocupado={cargando || fallo}
          alCambiar={(valor) => {
            establecerPagina(valor);
            establecerCargando(true);
          }}
        />
      </section>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
