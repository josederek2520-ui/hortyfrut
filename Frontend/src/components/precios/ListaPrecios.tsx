"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Plus, Tags } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada from "@/hooks/useConsultaPaginada";
import type { Session } from "@/components/users/types";
import EstadoPrecio from "./EstadoPrecio";
import {
  campoPrecio,
  panelPrecio,
  type AcuerdoPrecio,
  type EstadoPrecio as TipoEstado,
} from "./tipos";

export default function ListaPrecios({ sesion }: { sesion: Session }) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [estado, establecerEstado] = useState(""),
    [fecha, establecerFecha] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<AcuerdoPrecio>(
    "precios-acordados/?" +
      new URLSearchParams({
        buscar,
        pagina: String(pagina),
        ...(estado ? { estado } : {}),
        ...(fecha ? { fecha } : {}),
      }),
    () => establecerPagina(1),
  );
  const filtrado = !!(buscar || estado || fecha),
    puedeCrear = sesion.permisos_precios?.crear;
  const mostrarFecha = (valor: string) =>
    new Date(valor + "T12:00:00").toLocaleDateString(idioma);
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("titulo")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/precios-acordados/nueva"
            className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("nuevaPropuesta")}
          </Link>
        )}
      </div>
      <div className={panelPrecio}>
        <div className="grid items-end gap-4 p-5 md:grid-cols-[1fr_14rem_14rem]">
          <label className="block text-sm font-medium">
            {t("buscarEtiqueta")}
            <input
              type="search"
              autoComplete="off"
              maxLength={150}
              className={campoPrecio + " mt-1.5"}
              placeholder={t("buscarAcuerdo")}
              value={buscar}
              onChange={(e) => {
                establecerBuscar(e.target.value);
                establecerPagina(1);
              }}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("estado")}
            <select
              className={campoPrecio + " mt-1.5"}
              value={estado}
              onChange={(e) => {
                establecerEstado(e.target.value);
                establecerPagina(1);
              }}
            >
              <option value="">{t("todosEstados")}</option>
              {(
                [
                  "borrador",
                  "propuesta",
                  "aceptado",
                  "rechazado",
                  "cancelado",
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
              htmlFor="vigencia-precios"
            >
              {t("vigentePara")}
            </label>
            <CampoFecha
              id="vigencia-precios"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                establecerPagina(1);
              }}
            />
          </div>
        </div>
        {filtrado && (
          <div className="flex justify-end border-t border-gray-100 px-5 dark:border-gray-800">
            <button
              type="button"
              className="min-h-11 rounded px-2 text-sm font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
              onClick={() => {
                establecerBuscar("");
                establecerEstado("");
                establecerFecha("");
                establecerPagina(1);
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
            <Tags
              className="mx-auto mb-3 size-9 text-brand-600 dark:text-brand-300"
              aria-hidden="true"
            />
            <p className="font-medium">
              {t(filtrado ? "sinResultados" : "sinAcuerdos")}
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
              {t(filtrado ? "sinResultadosAyuda" : "sinAcuerdosAyuda")}
            </p>
            {!filtrado && puedeCrear && (
              <Link
                href="/precios-acordados/nueva"
                className="mt-4 inline-flex min-h-11 items-center rounded px-3 text-sm font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
              >
                {t("nuevaPropuesta")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((fila) => (
                <li key={fila.id}>
                  <Link
                    href={"/precios-acordados/" + fila.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"
                  >
                    <div>
                      <p className="font-semibold">{fila.cliente_nombre}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {fila.codigo} ·{" "}
                        {t("version", { numero: fila.numero_version })} ·{" "}
                        {t("productosAnotados", {
                          total: fila.total_productos,
                        })}
                      </p>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {fila.alcance === "periodo" && fila.desde && fila.hasta
                          ? mostrarFecha(fila.desde) +
                            " — " +
                            mostrarFecha(fila.hasta)
                          : t("alcances." + fila.alcance)}
                      </p>
                      {fila.referencia_propuesta && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {fila.referencia_propuesta}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <EstadoPrecio estado={fila.estado} />
                      {fila.estado === "aceptado" && !fila.es_actual && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t("versionAnterior")}
                        </span>
                      )}
                      <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                        {t(
                          fila.estado === "borrador" &&
                            sesion.permisos_precios?.editar
                            ? "continuar"
                            : fila.estado === "propuesta" &&
                                sesion.permisos_precios?.aceptar
                              ? "revisarPrecios"
                              : "verPropuesta",
                        )}
                        <ArrowRight
                          className="size-4 rtl:rotate-180"
                          aria-hidden="true"
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
