"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Plus, Undo2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import type { Session } from "@/components/users/types";
import usePaginaDevoluciones from "./usePaginaDevoluciones";
import EstadoDevolucion from "./EstadoDevolucion";
import {
  panelDevolucion,
  entradaDevolucion,
  type Devolucion,
  type EstadoDevolucion as TipoEstado,
} from "./tipos";

export default function ListaDevoluciones({
  sesion,
  entregaInicial,
}: {
  sesion: Session;
  entregaInicial?: number;
}) {
  const t = useTranslations("devoluciones"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState(""),
    [fecha, establecerFecha] = useState(""),
    [pagina, establecerPagina] = useState(1),
    [entrega, establecerEntrega] = useState(entregaInicial);
  const entrada = useRef<HTMLInputElement>(null);
  const parametros = new URLSearchParams({
    buscar,
    pagina: String(pagina),
    ...(estado ? { estado } : {}),
    ...(fecha ? { fecha } : {}),
    ...(entrega ? { entrega: String(entrega) } : {}),
  });
  const consulta = usePaginaDevoluciones<Devolucion>(
    "devoluciones/?" + parametros,
    () => establecerPagina(1),
  );
  const filtrado = !!(buscar || estado || fecha || entrega);
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("titulo")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        {sesion.permisos_devoluciones?.crear && (
          <Link
            href="/devoluciones/nueva"
            className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("nueva")}
          </Link>
        )}
      </div>
      <div className={panelDevolucion}>
        <div className="grid items-end gap-4 p-5 md:grid-cols-[1fr_14rem_14rem]">
          <label className="block text-sm font-medium">
            {t("buscarEtiqueta")}
            <input
              ref={entrada}
              type="search"
              maxLength={150}
              autoComplete="off"
              name="filtro_devoluciones"
              className={entradaDevolucion + " mt-1.5"}
              placeholder={t("buscar")}
              value={buscar}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("estado")}
            <select
              value={estado}
              className={entradaDevolucion + " mt-1.5"}
              onChange={(evento) => {
                establecerEstado(evento.target.value);
                establecerPagina(1);
              }}
            >
              <option value="">{t("todosEstados")}</option>
              {(
                [
                  "borrador",
                  "recibida",
                  "revisada",
                  "cancelada",
                ] as TipoEstado[]
              ).map((valor) => (
                <option key={valor} value={valor}>
                  {t("estados." + valor)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              htmlFor="fecha-filtro-devoluciones"
            >
              {t("fechaRetorno")}
            </label>
            <CampoFecha
              id="fecha-filtro-devoluciones"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                establecerPagina(1);
              }}
            />
          </div>
        </div>
        {filtrado && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-2 dark:border-gray-800">
            <p className="text-xs text-gray-500">
              {entrega
                ? t("filtroEntrega", {
                    entrega: "ENT-" + String(entrega).padStart(6, "0"),
                  })
                : t("filtrosActivos")}
            </p>
            <button
              type="button"
              className="min-h-11 rounded-lg px-2 text-sm font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
              onClick={() => {
                establecerBuscar("");
                establecerEstado("");
                establecerFecha("");
                establecerEntrega(undefined);
                establecerPagina(1);
                entrada.current?.focus();
              }}
            >
              {t("limpiarFiltros")}
            </button>
          </div>
        )}
        {consulta.fallo ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{t("errorConsulta")}</p>
            <Button variant="outline" onClick={consulta.recargar}>
              {t("reintentar")}
            </Button>
          </div>
        ) : !consulta.datos ? (
          <p role="status" className="p-10 text-center">
            {t("cargando")}
          </p>
        ) : !consulta.datos.count ? (
          <div className="p-10 text-center">
            <Undo2
              aria-hidden="true"
              className="mx-auto mb-3 size-8 text-brand-600 dark:text-brand-300"
            />
            <p className="font-medium">
              {t(filtrado ? "sinResultados" : "sinDevoluciones")}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t(filtrado ? "sinResultadosAyuda" : "sinDevolucionesAyuda")}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((fila) => (
                <li key={fila.id}>
                  <Link
                    href={"/devoluciones/" + fila.id}
                    className="flex min-h-28 flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-brand-500 motion-reduce:transition-none dark:hover:bg-gray-800"
                  >
                    <div>
                      <p className="font-semibold">
                        {fila.codigo} · {fila.sucursal_nombre}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {fila.cliente_nombre} · {fila.codigo_entrega} ·{" "}
                        {fila.codigo_pedido}
                      </p>
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                        {fila.almacen_nombre} ·{" "}
                        {fila.fecha_recepcion
                          ? new Date(
                              fila.fecha_recepcion + "T12:00:00",
                            ).toLocaleDateString(idioma)
                          : t("fechaSinAnotar")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <EstadoDevolucion estado={fila.estado} />
                      <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                        {t(
                          fila.estado === "borrador" &&
                            sesion.permisos_devoluciones?.editar
                            ? "continuar"
                            : fila.estado === "recibida" &&
                                sesion.permisos_devoluciones?.revisar
                              ? "revisarCalidad"
                              : "verDevolucion",
                        )}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 rtl:rotate-180"
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {consulta.datos.count > 10 && (
              <PaginadorPedidos
                pagina={pagina}
                total={consulta.datos.count}
                alCambiar={establecerPagina}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
