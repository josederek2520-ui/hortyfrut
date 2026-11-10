"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight as IconoAbrir,
  ClipboardList as IconoJornada,
  Search as IconoBuscar,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Paginador from "@/components/compras/PaginadorCompras";
import { clasePanel, type PaginaCompra } from "@/components/compras/tipos";
import { claseEntrada } from "@/components/logistica/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import { fechaLocal } from "@/components/pedidos/fechas";
import useConsultaPreparacion from "./useConsultaPreparacion";
import {
  accionJornadaPreparacion,
  claseEstadoJornada,
} from "./accionesJornadaPreparacion";
import type {
  JornadaAgrupadaPreparacion,
  PermisosPreparaciones,
} from "./tipos";

export default function ListadoJornadasPreparacion({
  permisos,
  activo,
  revision,
  alAbrir,
  alPreparar,
  alError,
}: {
  permisos: PermisosPreparaciones;
  activo: boolean;
  revision: number;
  alAbrir: (grupo: JornadaAgrupadaPreparacion) => void;
  alPreparar: (grupo: JornadaAgrupadaPreparacion) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [buscar, establecerBuscar] = useState("");
  const [fecha, establecerFecha] = useState("");
  const [estado, establecerEstado] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const parametros = new URLSearchParams({ buscar, pagina: String(pagina) });
  if (fecha) parametros.set("fecha_pedidos", fecha);
  if (estado) parametros.set("estado", estado);
  const { datos, cargando, fallo, recargar } = useConsultaPreparacion<
    PaginaCompra<JornadaAgrupadaPreparacion>
  >(activo ? `preparaciones/jornadas/?${parametros}` : null, alError, revision);
  const filtrado = !!(buscar || fecha || estado);
  const limpiar = () => {
    establecerBuscar("");
    establecerFecha("");
    establecerEstado("");
    establecerPagina(1);
  };
  return (
    <section
      className={`${clasePanel} overflow-hidden`}
      aria-labelledby="titulo-listado-jornadas"
    >
      <div className="space-y-5 border-b border-gray-100 p-5 sm:p-6 dark:border-gray-800">
        <div>
          <h2
            id="titulo-listado-jornadas"
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight text-gray-900 outline-none dark:text-white"
          >
            {t("jornadasTitulo")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t("jornadasAyuda")}
          </p>
        </div>
        <div
          role="group"
          aria-label={t("filtrarJornadas")}
          className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {["", "pendiente", "parcial", "preparado"].map((valor) => (
            <button
              key={valor}
              type="button"
              aria-pressed={estado === valor}
              onClick={() => {
                establecerEstado(valor);
                establecerPagina(1);
              }}
              className={`min-h-11 rounded-lg px-4 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand-400 ${estado === valor ? "pestana-hortyfru font-semibold" : "text-gray-600 dark:text-gray-300"}`}
            >
              {t(valor ? `situacionesJornada.${valor}` : "todasJornadas")}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="buscar-cliente-jornada">
              {t("buscarClienteJornada")}
            </Label>
            <div className="relative">
              <IconoBuscar
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-400"
                aria-hidden="true"
              />
              <input
                id="buscar-cliente-jornada"
                type="search"
                maxLength={150}
                className={`${claseEntrada} ps-10`}
                value={buscar}
                onChange={(evento) => {
                  establecerBuscar(evento.target.value);
                  establecerPagina(1);
                }}
                placeholder={t("buscarClienteJornada")}
              />
            </div>
          </div>
          <div className="sm:w-60">
            <Label htmlFor="fecha-listado-jornadas">
              {t("fechaPedidosCompacta")}
            </Label>
            <CampoFecha
              id="fecha-listado-jornadas"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                establecerPagina(1);
              }}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              establecerFecha(fechaLocal());
              establecerPagina(1);
            }}
          >
            {t("pedidosHoyJornada")}
          </Button>
          {filtrado && (
            <Button size="sm" variant="outline" onClick={limpiar}>
              {t("limpiarJornadas")}
            </Button>
          )}
        </div>
      </div>
      {fallo ? (
        <div role="alert" className="space-y-4 p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("errorCarga")}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              establecerPagina(1);
              recargar();
            }}
          >
            {t("recargar")}
          </Button>
        </div>
      ) : cargando ? (
        <div role="status" aria-label={t("cargando")} className="space-y-3 p-5">
          {[0, 1, 2].map((indice) => (
            <div
              key={indice}
              className="h-20 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
            />
          ))}
        </div>
      ) : !datos?.results.length ? (
        <div
          role="status"
          className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <span className="rounded-2xl bg-brand-50 p-4 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <IconoJornada className="size-7" aria-hidden="true" />
          </span>
          <p className="max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t(filtrado ? "sinJornadasFiltro" : "sinJornadas")}
          </p>
          {filtrado && (
            <Button size="sm" variant="outline" onClick={limpiar}>
              {t("limpiarJornadas")}
            </Button>
          )}
        </div>
      ) : (
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
              <tr>
                {[
                  "fechaPedidosCompacta",
                  "cliente",
                  "sucursalesJornada",
                  "pedidosJornada",
                  "productosJornada",
                  "estado",
                  "accionesJornada",
                ].map((clave) => (
                  <th
                    key={clave}
                    scope="col"
                    className="px-5 py-3 text-start font-medium whitespace-nowrap"
                  >
                    {t(clave)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {datos.results.map((grupo) => {
                const accion = accionJornadaPreparacion(grupo, permisos);
                return (
                  <tr
                    key={`${grupo.cliente}-${grupo.fecha_pedidos}`}
                    className="text-gray-700 hover:bg-gray-50/60 dark:text-gray-200 dark:hover:bg-gray-800/20"
                  >
                    <td className="px-5 py-4 whitespace-nowrap">
                      {mostrarFecha(grupo.fecha_pedidos, idioma)}
                    </td>
                    <th scope="row" className="min-w-48 px-5 py-3 text-start">
                      <button
                        type="button"
                        onClick={() => alAbrir(grupo)}
                        className="min-h-11 rounded-lg text-start font-semibold text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white"
                      >
                        {grupo.cliente_nombre}
                      </button>
                      {!grupo.cliente_activo && (
                        <span className="block text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                          {t("clienteInactivoTrabajo")}
                        </span>
                      )}
                    </th>
                    {[grupo.sucursales, grupo.pedidos, grupo.productos].map(
                      (cantidad, indice) => (
                        <td key={indice} className="px-5 py-4 tabular-nums">
                          {new Intl.NumberFormat(idioma).format(cantidad)}
                        </td>
                      ),
                    )}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-1 text-theme-xs font-medium whitespace-nowrap ${claseEstadoJornada(grupo.estado)}`}
                      >
                        {t(`situacionesJornada.${grupo.estado}`)}
                      </span>
                      {grupo.borradores > 0 && (
                        <span className="mt-1.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                          {t("borradoresJornada", {
                            cantidad: grupo.borradores,
                          })}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {accion.tipo === "editar" ? (
                        <Link
                          href={accion.ruta}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-medium whitespace-nowrap text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                        >
                          {t(accion.texto)}
                          <IconoAbrir
                            className="size-4 rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            accion.tipo === "preparar"
                              ? alPreparar(grupo)
                              : alAbrir(grupo)
                          }
                          endIcon={
                            <IconoAbrir
                              className="size-4 rtl:rotate-180"
                              aria-hidden="true"
                            />
                          }
                        >
                          {t(accion.texto)}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!!datos?.count && !fallo && !cargando && (
        <div className="px-5 pb-5">
          <Paginador
            pagina={pagina}
            total={datos.count}
            alCambiar={establecerPagina}
          />
        </div>
      )}
    </section>
  );
}
