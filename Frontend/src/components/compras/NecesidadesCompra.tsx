"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ClipboardList as IconoPedidos,
  Plus as IconoAgregar,
  RefreshCw as IconoActualizar,
} from "lucide-react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { api, ApiError as ErrorApi } from "@/lib/api";
import PaginadorCompras from "./PaginadorCompras";
import ListaNecesidadesCompra from "./ListaNecesidadesCompra";
import {
  clasePanel,
  type PaginaNecesidades,
  type NecesidadProducto,
  type NecesidadSucursal,
  type OpcionCompra,
} from "./tipos";

export default function NecesidadesCompra({
  fecha,
  alAgregar,
  alError,
  deshabilitado = false,
  compacta = false,
  productosAgregados = {},
}: {
  fecha: string;
  alAgregar?: (producto: OpcionCompra) => void;
  alError: (error: unknown) => void;
  deshabilitado?: boolean;
  compacta?: boolean;
  productosAgregados?: Record<number, number>;
}) {
  const t = useTranslations("compras");
  const [vista, establecerVista] = useState<"resumen" | "sucursales">(
    "resumen",
  );
  const [buscar, establecerBuscar] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<PaginaNecesidades<
    NecesidadProducto | NecesidadSucursal
  > | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    if (!fecha) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo(false);
        try {
          const parametros = new URLSearchParams({
            fecha_pedidos: fecha,
            vista,
            buscar,
            pagina: String(pagina),
          });
          const respuesta = await api<
            PaginaNecesidades<NecesidadProducto | NecesidadSucursal>
          >(`compras/necesidades/?${parametros}`, {
            signal: controlador.signal,
          });
          if (!controlador.signal.aborted) establecerDatos(respuesta);
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(true);
              alError(error);
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
  }, [fecha, vista, buscar, pagina, revision, alError]);
  return (
    <section
      className={`${clasePanel} space-y-4 p-5 ${compacta ? "" : "sm:p-6"}`}
      aria-labelledby="titulo-necesidades-compra"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="titulo-necesidades-compra"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {t(compacta ? "necesidadesDia" : "pedidosTitulo")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t(compacta ? "necesidadesAyuda" : "pedidosAyuda")}
          </p>
        </div>
        {fecha && (
          <Button
            size="sm"
            variant="outline"
            disabled={cargando || deshabilitado}
            startIcon={<IconoActualizar className="size-4" />}
            aria-label={t("actualizar")}
            title={t("actualizar")}
            className={compacta ? "px-3!" : ""}
            onClick={() => establecerRevision((valor) => valor + 1)}
          >
            {!compacta && t("actualizar")}
          </Button>
        )}
      </div>
      {!fecha ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
          <IconoPedidos
            className="mb-3 size-8 text-brand-500"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {t("elegirFechaPedidos")}
          </p>
          <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("elegirFechaPedidosAyuda")}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="group"
              aria-label={t("vistaPedidos")}
              className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
            >
              {(["resumen", "sucursales"] as const).map((valor) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={vista === valor}
                  onClick={() => {
                    establecerVista(valor);
                    establecerPagina(1);
                  }}
                  className={`pestana-hortyfru min-h-10 rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none ${vista === valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {t(`vistas.${valor}`)}
                </button>
              ))}
            </div>
            <div
              className="flex flex-wrap gap-x-4 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400"
              role="status"
            >
              <span>
                {t("numeroPedidos", { cantidad: datos?.resumen.pedidos || 0 })}
              </span>
              <span>
                {t("numeroSucursales", {
                  cantidad: datos?.resumen.sucursales || 0,
                })}
              </span>
              <span>
                {t("numeroProductos", {
                  cantidad: datos?.resumen.productos || 0,
                })}
              </span>
            </div>
          </div>
          {!!datos?.compras_registradas && (
            <div className="rounded-xl bg-warning-50 p-4 text-sm leading-6 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
              <p>
                {t("comprasPrevias", { cantidad: datos.compras_registradas })}
              </p>
              <Link
                href={`/compras?fecha_pedidos=${encodeURIComponent(fecha)}`}
                target={compacta ? "_blank" : undefined}
                rel={compacta ? "noopener noreferrer" : undefined}
                className="mt-2 inline-flex min-h-8 items-center rounded font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {t("revisarComprasFecha")}
              </Link>
            </div>
          )}
          <Input
            type="search"
            maxLength={150}
            value={buscar}
            placeholder={t("buscarProducto")}
            aria-label={t("buscarProducto")}
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              establecerPagina(1);
            }}
          />
          {fallo ? (
            <div
              role="alert"
              className="space-y-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
            >
              <p>{t("errorPedidos")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => establecerRevision((valor) => valor + 1)}
              >
                {t("reintentar")}
              </Button>
            </div>
          ) : cargando ? (
            <div role="status" aria-label={t("cargando")} className="space-y-2">
              {[0, 1, 2].map((indice) => (
                <div
                  key={indice}
                  className="h-14 rounded-lg bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
                />
              ))}
            </div>
          ) : !datos?.results.length ? (
            <div
              role="status"
              className="rounded-xl bg-gray-50 p-6 text-center dark:bg-gray-800/50"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {t(buscar ? "sinResultados" : "sinPedidos")}
              </p>
              <p className="mt-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t(buscar ? "sinResultadosAyuda" : "sinPedidosAyuda")}
              </p>
            </div>
          ) : compacta ? (
            <ListaNecesidadesCompra
              filas={datos.results}
              productosAgregados={productosAgregados}
              alAgregar={alAgregar}
              deshabilitado={deshabilitado || cargando}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-start text-sm">
                <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  <tr>
                    {(vista === "resumen"
                      ? [
                          "producto",
                          "cajas",
                          "unidades",
                          ...(alAgregar ? ["acciones"] : []),
                        ]
                      : ["pedidoSucursal", "producto", "cajas", "unidades"]
                    ).map((clave) => (
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
                  {datos.results.map((fila) => (
                    <tr
                      key={fila.id}
                      className="border-t border-gray-100 dark:border-gray-800"
                    >
                      {"cajas" in fila ? (
                        <>
                          <td className="min-w-40 px-4 py-3">
                            <span className="font-medium break-words text-gray-800 dark:text-gray-100">
                              {fila.nombre}
                            </span>
                            {!fila.disponible && (
                              <p className="mt-1 text-theme-xs text-warning-600 dark:text-warning-400">
                                {t("productoNoDisponible")}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums dark:text-gray-200">
                            {fila.cajas}
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums dark:text-gray-200">
                            {fila.unidades}
                          </td>
                          {alAgregar && (
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!fila.disponible || deshabilitado}
                                startIcon={<IconoAgregar className="size-4" />}
                                onClick={() => alAgregar(fila)}
                              >
                                {t("agregar")}
                              </Button>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td className="min-w-44 px-4 py-3">
                            <p className="font-medium text-gray-800 dark:text-gray-100">
                              {fila.codigo}
                            </p>
                            <p className="mt-1 text-theme-xs break-words text-gray-500 dark:text-gray-400">
                              {fila.cliente} · {fila.sucursal}
                            </p>
                          </td>
                          <td className="min-w-36 px-4 py-3 text-gray-700 dark:text-gray-200">
                            <p>{fila.producto_nombre}</p>
                            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                              {fila.presentacion_nombre}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums dark:text-gray-200">
                            {fila.columna === "cajas" ? fila.cantidad : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-700 tabular-nums dark:text-gray-200">
                            {fila.columna === "unidades" ? fila.cantidad : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginadorCompras
            pagina={pagina}
            total={datos?.count || 0}
            alCambiar={establecerPagina}
            ocupado={cargando || fallo}
          />
        </>
      )}
    </section>
  );
}
