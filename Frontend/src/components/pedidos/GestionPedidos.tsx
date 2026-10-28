"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { CircleX as IconoCancelar } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import { PlusIcon, SearchIcon, PencilIcon, IconoPedidos } from "@/icons";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import type { Session as Sesion } from "@/components/users/types";
import useAvisosPedidos from "./useAvisosPedidos";
import PaginadorPedidos from "./PaginadorPedidos";
import CancelarPedido from "./CancelarPedido";
import {
  claseEntrada,
  clasePanel,
  type PaginaResultados,
  type Pedido,
} from "./tipos";

export function claseEstado(estado: string) {
  return `inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${estado === "pendiente" ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400" : estado === "preparado" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`;
}
export default function GestionPedidos({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("pedidos"),
    idioma = useLocale();
  const { avisos, notificar, cerrarAviso, tratarError } = useAvisosPedidos();
  const confirmacion = useModal();
  const [pedidoCancelar, establecerPedidoCancelar] = useState<Pedido | null>(
    null,
  );
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState(""),
    [fecha, establecerFecha] = useState(""),
    [pagina, establecerPagina] = useState(1),
    [revision, establecerRevision] = useState(0);
  const [datos, establecerDatos] = useState<PaginaResultados<Pedido> | null>(
      null,
    ),
    [resumen, establecerResumen] = useState<Record<string, number>>({}),
    [cargando, establecerCargando] = useState(true),
    [fallo, establecerFallo] = useState(false);
  useEffect(() => {
    if (!sesion.permisos_pedidos.ver) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      establecerCargando(true);
      establecerFallo(false);
      try {
        const parametros = new URLSearchParams({
          buscar,
          pagina: String(pagina),
          ...(estado ? { estado } : {}),
          ...(fecha ? { fecha } : {}),
        });
        const [listado, contadores] = await Promise.all([
          api<PaginaResultados<Pedido>>(`pedidos/?${parametros}`, {
            signal: controlador.signal,
          }),
          api<Record<string, number>>(`pedidos/resumen/?${parametros}`, {
            signal: controlador.signal,
          }),
        ]);
        establecerDatos(listado);
        establecerResumen(contadores);
      } catch (error) {
        if (!controlador.signal.aborted) {
          if (error instanceof ErrorApi && error.status === 404 && pagina > 1) {
            establecerPagina((actual) => Math.max(1, actual - 1));
            return;
          }
          establecerFallo(true);
          tratarError(error);
        }
      } finally {
        if (!controlador.signal.aborted) establecerCargando(false);
      }
    }, 250);
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [
    sesion.permisos_pedidos.ver,
    buscar,
    estado,
    fecha,
    pagina,
    revision,
    tratarError,
  ]);
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      try {
        const aviso = sessionStorage.getItem("pedidos:aviso");
        if (aviso === "pedidoCreado" || aviso === "pedidoEditado") {
          sessionStorage.removeItem("pedidos:aviso");
          notificar(t(aviso));
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [notificar, t]);
  const cerrarCancelacion = () => {
    confirmacion.closeModal();
    establecerPedidoCancelar(null);
  };
  const actualizarListado = () => {
    cerrarCancelacion();
    establecerCargando(true);
    establecerRevision((actual) => actual + 1);
  };
  if (!sesion.permisos_pedidos.ver)
    return (
      <p className={`${clasePanel} p-8 text-gray-500`}>{t("sinPermiso")}</p>
    );
  const claseAccion =
    "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-brand-500/10";
  return (
    <>
      <div className="space-y-6">
        <div>
          <MigasPagina pageTitle={t("titulo")} />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t(
              sesion.permisos_pedidos.ver_todos ||
                sesion.permisos_pedidos.gestionar_todos
                ? "alcanceTodos"
                : "alcanceAsignados",
            )}
          </p>
        </div>
        <section className={clasePanel}>
          <header className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div
              className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
              aria-label={t("estado")}
            >
              {["", "pendiente", "preparado", "cancelado"].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={estado === valor}
                  onClick={() => {
                    establecerEstado(valor);
                    establecerPagina(1);
                  }}
                  className={`pestana-hortyfru flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${estado === valor ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"}`}
                >
                  {t(valor ? `estados.${valor}` : "todos")}
                  <span className="rounded-full bg-brand-50 px-1.5 text-xs text-brand-500 dark:bg-brand-500/10">
                    {resumen[valor ? `${valor}s` : "total"] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            {sesion.permisos_pedidos.crear && (
              <Link
                href="/pedidos/nuevo"
                className="boton-principal-hortyfru inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <PlusIcon className="size-4" />
                {t("nuevo")}
              </Link>
            )}
          </header>
          <div className="grid gap-4 border-t border-gray-100 px-5 py-4 sm:grid-cols-[1fr_220px] dark:border-gray-800">
            <div className="relative">
              <label htmlFor="buscar-pedidos" className="sr-only">
                {t("buscarPedidos")}
              </label>
              <SearchIcon className="absolute start-3 top-3.5 size-4 text-gray-400" />
              <input
                id="buscar-pedidos"
                value={buscar}
                onChange={(evento) => {
                  establecerBuscar(evento.target.value);
                  establecerPagina(1);
                }}
                placeholder={t("buscarPedidos")}
                className={`${claseEntrada} ps-9`}
              />
            </div>
            <CampoFecha
              aria-label={t("filtrarFecha")}
              value={fecha}
              alCambiar={(fecha) => {
                establecerFecha(fecha);
                establecerPagina(1);
              }}
            />
          </div>
          {fallo ? (
            <div role="alert" className="p-10 text-center">
              <p className="mb-4 text-sm text-error-500">{t("errorCarga")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => establecerRevision((valor) => valor + 1)}
              >
                {t("recargar")}
              </Button>
            </div>
          ) : cargando ? (
            <p role="status" className="p-12 text-center text-sm text-gray-500">
              {t("cargando")}
            </p>
          ) : datos?.results.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="border-y border-gray-100 bg-gray-50 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
                  <tr>
                    {[
                      "pedido",
                      "sucursal",
                      "responsable",
                      "fechaRequerida",
                      "productos",
                      "estado",
                      "acciones",
                    ].map((campo) => (
                      <th
                        key={campo}
                        scope="col"
                        className="px-5 py-4 text-start font-medium"
                      >
                        {t(campo)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {datos.results.map((pedido) => (
                    <tr key={pedido.id}>
                      <td className="px-5 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {pedido.codigo}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {pedido.sucursal_nombre}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {pedido.cliente_nombre}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {pedido.responsable_nombre}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {new Intl.DateTimeFormat(idioma, {
                          dateStyle: "medium",
                        }).format(
                          new Date(`${pedido.fecha_requerida}T12:00:00`),
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {pedido.cantidad_productos}
                      </td>
                      <td className="px-5 py-4">
                        <span className={claseEstado(pedido.estado)}>
                          {t(`estados.${pedido.estado}`)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {pedido.puede_editar && (
                            <Link
                              href={`/pedidos/${pedido.id}/editar`}
                              className={claseAccion}
                              title={t("editar")}
                              aria-label={`${t("editar")} ${pedido.codigo}`}
                            >
                              <PencilIcon className="size-4" />
                            </Link>
                          )}
                          {pedido.puede_cancelar && (
                            <button
                              type="button"
                              className="inline-flex size-10 items-center justify-center rounded-lg text-error-600 hover:bg-error-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-500 dark:text-error-400 dark:hover:bg-error-500/10"
                              title={t("cancelarPedido")}
                              aria-label={`${t("cancelarPedido")} ${pedido.codigo}`}
                              onClick={() => {
                                establecerPedidoCancelar(pedido);
                                confirmacion.openModal();
                              }}
                            >
                              <IconoCancelar
                                className="size-4"
                                aria-hidden="true"
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <IconoPedidos className="mx-auto mb-3 size-8 text-gray-300" />
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {t("sinPedidos")}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t("sinPedidosAyuda")}
              </p>
            </div>
          )}
          <PaginadorPedidos
            pagina={pagina}
            total={datos?.count || 0}
            alCambiar={establecerPagina}
            ocupado={cargando}
          />
        </section>
      </div>
      {confirmacion.isOpen && pedidoCancelar && (
        <CancelarPedido
          pedido={pedidoCancelar}
          alCerrar={cerrarCancelacion}
          alGuardar={() => {
            actualizarListado();
            notificar(t("pedidoCancelado"));
          }}
          alRecargar={actualizarListado}
          alError={tratarError}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
