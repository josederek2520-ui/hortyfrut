"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Check as IconoCompletada,
  MapPin as IconoParada,
  Truck as IconoVehiculo,
  UserRound as IconoChofer,
  Pencil as IconoEditar,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Paginador from "@/components/compras/PaginadorCompras";
import { clasePanel } from "@/components/logistica/tipos";
import AccionesDespacho from "./AccionesDespacho";
import AvisoCapacidadDespacho from "./AvisoCapacidadDespacho";
import { comprobarCapacidadDespacho } from "./capacidadDespacho";
import { mostrarFecha } from "@/components/compras/calculos";
import SeguimientoPedidos from "./SeguimientoPedidosDespacho";
import RutaDespacho from "./RutaDespacho";
import { cajillasEfectivasDespacho } from "./cajillasPreparadasDespacho";
import {
  claseEstadoDespacho,
  type DetalleDespacho as DatosDespacho,
  type PermisosDespachos,
} from "./tipos";

export default function DetalleDespacho({
  despacho,
  permisos,
  alActualizar,
  alError,
}: {
  despacho: DatosDespacho;
  permisos: PermisosDespachos;
  alActualizar: (datos: DatosDespacho) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  const idioma = useLocale();
  const [seleccionada, establecerSeleccionada] = useState<number | null>(null);
  const [pagina, establecerPagina] = useState(1);
  const cajillas = cajillasEfectivasDespacho(despacho);
  const totalCajillas = cajillas.reduce(
    (total, fila) => total + fila.cantidad,
    0,
  );
  const siguiente = despacho.paradas.find((fila) => !fila.descargada_en);
  const parada =
    despacho.paradas.find((fila) => fila.id === seleccionada) ||
    despacho.paradas.find((fila) => !fila.descargada_en) ||
    despacho.paradas[0];
  const fecha = (valor: string) =>
    new Intl.DateTimeFormat(idioma, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/La_Paz",
    }).format(new Date(valor));
  return (
    <div className="space-y-6">
      <RutaDespacho
        despacho={despacho}
        alError={alError}
        alActualizar={alActualizar}
      />
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={claseEstadoDespacho(despacho.estado)}>
              {t(
                despacho.estado === "borrador" && despacho.enviado_en
                  ? "pendienteSalida"
                  : `estados.${despacho.estado}`,
              )}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {despacho.almacen_nombre} ·{" "}
              {mostrarFecha(despacho.fecha_reparto, idioma)}
            </span>
          </div>
          {despacho.estado === "borrador" &&
            !despacho.enviado_en &&
            permisos.editar && (
              <Link
                href={`/despachos/${despacho.id}/editar`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                <IconoEditar className="size-4" />
                {comun("editar")}
              </Link>
            )}
        </div>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("vehiculo"), despacho.vehiculo_placa, IconoVehiculo],
            [t("chofer"), despacho.chofer_nombre, IconoChofer],
            [
              t("paradas"),
              t("avanceParadas", {
                completadas: despacho.resumen.completadas,
                total: despacho.resumen.paradas,
              }),
              IconoParada,
            ],
          ].map(([nombre, valor, Icono]) => {
            const Simbolo = Icono as typeof IconoVehiculo;
            return (
              <div key={String(nombre)}>
                <dt className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
                  <Simbolo className="size-4" />
                  {String(nombre)}
                </dt>
                <dd className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {String(valor)}
                </dd>
              </div>
            );
          })}
          <div>
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("pesoPreparado")}
            </dt>
            <dd className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {new Intl.NumberFormat(idioma).format(
                Number(despacho.resumen.peso_kg),
              )}{" "}
              kg
            </dd>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {[
                ...(despacho.resumen.cajas
                  ? [t("cajasCargaValor", { cantidad: despacho.resumen.cajas })]
                  : []),
                ...(despacho.resumen.unidades
                  ? [
                      t("unidadesCargaValor", {
                        cantidad: despacho.resumen.unidades,
                      }),
                    ]
                  : []),
                ...(totalCajillas
                  ? [
                      t("cajillasCargaValor", {
                        cantidad: totalCajillas,
                      }),
                    ]
                  : []),
              ].join(" · ")}
            </p>
          </div>
        </dl>
        {despacho.estado === "en_ruta" && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
          >
            {siguiente
              ? t("siguienteDestinoListado", {
                  cliente: siguiente.cliente_nombre,
                  sucursal: siguiente.sucursal_nombre,
                })
              : t("recorridoCompletoDetalle")}
          </p>
        )}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <section className={`${clasePanel} p-5 xl:col-span-1`}>
          <h2 className="mb-5 font-semibold text-gray-900 dark:text-white">
            {t("recorrido")}
          </h2>
          <ol className="space-y-2">
            {despacho.paradas
              .slice((pagina - 1) * 10, pagina * 10)
              .map((fila) => (
                <li key={fila.id}>
                  <button
                    type="button"
                    aria-pressed={fila.id === parada?.id}
                    className={`flex min-h-20 w-full items-start gap-3 rounded-xl border p-3 text-start focus-visible:ring-2 focus-visible:ring-brand-400 ${fila.id === parada?.id ? "border-orange-200 bg-orange-25 dark:border-orange-500/30 dark:bg-orange-500/5" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                    onClick={() => establecerSeleccionada(fila.id)}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${fila.descargada_en ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
                    >
                      {fila.descargada_en ? (
                        <IconoCompletada className="size-4" />
                      ) : (
                        fila.orden
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {fila.sucursal_nombre}
                      </p>
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        {fila.cliente_nombre}
                      </p>
                      <p className="mt-1 text-theme-xs font-medium text-brand-700 dark:text-brand-300">
                        {t(
                          fila.descargada_en
                            ? "descargada"
                            : fila.llegada_en
                              ? "enSucursal"
                              : "pendiente",
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
          </ol>
          {despacho.paradas.length > 10 && (
            <div className="mt-4">
              <Paginador
                pagina={pagina}
                total={despacho.paradas.length}
                alCambiar={establecerPagina}
              />
            </div>
          )}
        </section>
        <section className={`${clasePanel} p-5 sm:p-6 xl:col-span-2`}>
          {parada ? (
            <>
              <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
                <p className="text-theme-xs font-medium text-orange-600 dark:text-orange-300">
                  {t("paradaNumero", { numero: parada.orden })}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {parada.cliente_nombre} · {parada.sucursal_nombre}
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {parada.direccion}
                </p>
                {parada.llegada_en && (
                  <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("llegada")}: {fecha(parada.llegada_en)}
                  </p>
                )}
                {parada.descargada_en && (
                  <p className="mt-1 text-theme-xs text-brand-700 dark:text-brand-300">
                    {t("descarga")}: {fecha(parada.descargada_en)}
                  </p>
                )}
              </div>
              <p
                role="status"
                className="mt-4 text-sm font-medium text-brand-700 dark:text-brand-300"
              >
                {t("avancePedidosDescarga", {
                  descargados: parada.pedidos_descargados,
                  total: parada.pedidos,
                })}
              </p>
              <SeguimientoPedidos
                key={`${despacho.version}:${parada.id}`}
                despachoId={despacho.id}
                paradaId={parada.id}
                alError={alError}
              />
              <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {t("cajillas")}
                </h3>
                <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                  {t(
                    parada.descargada_en
                      ? "cajillasDescargaRegistradas"
                      : "cajillasAlCompletarParada",
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cajillas
                    .filter((fila) => fila.sucursal === parada.sucursal)
                    .map((fila) => (
                      <span
                        key={fila.cajilla}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        {fila.color} · <strong>{fila.cantidad}</strong>
                      </span>
                    ))}
                </div>
                {!cajillas.some(
                  (fila) => fila.sucursal === parada.sucursal,
                ) && (
                  <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("sinCajillas")}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("elegirCarga")}
            </p>
          )}
        </section>
      </div>
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {t("trazabilidad")}
        </h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [comun("responsable"), despacho.responsable_nombre],
            [comun("creado"), fecha(despacho.creado_en)],
            ...(despacho.enviado_en
              ? [
                  [t("enviadoChofer"), fecha(despacho.enviado_en)],
                  [t("enviadoPor"), despacho.enviado_por_nombre],
                ]
              : []),
            [t("salida"), despacho.salida_en ? fecha(despacho.salida_en) : "—"],
            [
              t("retorno"),
              despacho.retorno_en ? fecha(despacho.retorno_en) : "—",
            ],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {etiqueta}
              </dt>
              <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                {valor}
              </dd>
            </div>
          ))}
        </dl>
        {despacho.historial.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium text-brand-600 dark:text-brand-300">
              {t("actividadReciente")}
            </summary>
            <ol className="mt-3 space-y-2">
              {despacho.historial.map((fila, indice) => (
                <li
                  key={indice}
                  className="text-theme-xs text-gray-500 dark:text-gray-400"
                >
                  {t.has(`acciones.${fila.accion}`)
                    ? t(`acciones.${fila.accion}`)
                    : t("accionRegistrada")}{" "}
                  · {fila.responsable_nombre} · {fecha(fila.creado_en)}
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-md dark:border-gray-700 dark:bg-gray-900">
        {despacho.estado === "borrador" ? (
          <AvisoCapacidadDespacho
            resultado={
              despacho.comprobacion_capacidad ??
              comprobarCapacidadDespacho(
                despacho.vehiculo_capacidad_kg,
                despacho.cargas,
              )
            }
          />
        ) : (
          <p className="max-w-xl text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t(
              despacho.estado === "en_ruta"
                ? "ayudaDescarga"
                : "ayudaInventario",
            )}
          </p>
        )}
        <AccionesDespacho
          despacho={despacho}
          permisos={permisos}
          alActualizar={alActualizar}
          alError={alError}
        />
      </div>
    </div>
  );
}
