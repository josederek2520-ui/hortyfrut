"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  PackageCheck as IconoEntrega,
  Check as IconoElegida,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada from "@/hooks/useConsultaPaginada";
import { mostrarBolivianos } from "@/lib/moneda";
import { campoVenta, type FormularioVenta, type EntregaVenta } from "./tipos";
import {
  alternarEntrega,
  mostrarFechaVenta,
  mostrarPesoVenta,
} from "./calculosVenta";

export default function SeleccionEntregasVenta({
  formulario,
  bloqueado,
  alCambiar,
}: {
  formulario: FormularioVenta;
  bloqueado: boolean;
  alCambiar: (filas: EntregaVenta[]) => void;
}) {
  const t = useTranslations("ventas"),
    idioma = useLocale();
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1),
    [soloElegidas, establecerSoloElegidas] = useState(false);
  const consulta = useConsultaPaginada<EntregaVenta>(
    formulario.cliente &&
      formulario.desde &&
      formulario.hasta &&
      formulario.desde <= formulario.hasta
      ? "ventas/entregas/?" +
          new URLSearchParams({
            cliente: String(formulario.cliente.id),
            desde: formulario.desde,
            hasta: formulario.hasta,
            buscar,
            pagina: String(pagina),
          })
      : null,
    () => establecerPagina(1),
  );
  const seleccionadas = formulario.entregas.filter(
    (fila) =>
      !buscar ||
      [fila.codigo, fila.sucursal_nombre, fila.codigo_pedido].some((texto) =>
        texto.toLocaleLowerCase().includes(buscar.toLocaleLowerCase()),
      ),
  );
  const filas = soloElegidas
    ? seleccionadas.slice((pagina - 1) * 10, pagina * 10)
    : consulta.datos?.results;
  const total = soloElegidas
    ? seleccionadas.length
    : (consulta.datos?.count ?? 0);
  if (!formulario.cliente)
    return (
      <div className="px-5 py-16 text-center">
        <IconoEntrega
          className="mx-auto mb-3 size-10 text-brand-500"
          aria-hidden="true"
        />
        <p className="font-medium">{t("primeroCliente")}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("primeroClienteAyuda")}
        </p>
      </div>
    );
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
        <div>
          <h2 className="font-semibold">{t("entregasDisponibles")}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("entregasAyuda")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="sr-only">{t("buscarEntrega")}</span>
            <input
              type="search"
              maxLength={150}
              className={campoVenta}
              value={buscar}
              placeholder={t("buscarEntrega")}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </label>
          <button
            type="button"
            aria-pressed={soloElegidas}
            className={
              "min-h-11 rounded-xl border px-3 text-sm font-medium " +
              (soloElegidas
                ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")
            }
            onClick={() => {
              establecerSoloElegidas(!soloElegidas);
              establecerPagina(1);
            }}
          >
            {t("elegidas", { cantidad: formulario.entregas.length })}
          </button>
        </div>
      </div>
      {!formulario.desde ||
      !formulario.hasta ||
      formulario.hasta < formulario.desde ? (
        <p role="status" className="p-10 text-center text-sm">
          {t("periodoInvalido")}
        </p>
      ) : !soloElegidas && consulta.fallo ? (
        <div role="alert" className="space-y-3 p-8">
          <p>{t("errorConsulta")}</p>
          <Button variant="outline" onClick={consulta.recargar}>
            {t("reintentar")}
          </Button>
        </div>
      ) : !filas ? (
        <p role="status" className="p-12 text-center text-sm">
          {t("cargando")}
        </p>
      ) : !filas.length ? (
        <div className="px-5 py-12 text-center">
          <IconoEntrega
            className="mx-auto mb-3 size-9 text-gray-400"
            aria-hidden="true"
          />
          <h3 className="font-medium">
            {t(soloElegidas ? "sinElegidas" : "sinEntregas")}
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t(soloElegidas ? "sinElegidasAyuda" : "sinEntregasAyuda")}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[2rem_minmax(12rem,1fr)_8rem_8rem_8rem] items-center gap-4 bg-gray-50/70 px-5 py-3 text-xs text-gray-500 2xl:grid dark:bg-gray-800/40 dark:text-gray-400">
            <span />
            <span>{t("destinoPedido")}</span>
            <span>{t("fechaRecepcion")}</span>
            <span className="text-end">{t("kgAceptados")}</span>
            <span className="text-end">{t("importe")}</span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {filas.map((fila) => {
              const elegida = formulario.entregas.some(
                  (actual) => actual.id === fila.id,
                ),
                incidencias = fila.incidencias;
              return (
                <li
                  key={fila.id}
                  className={
                    elegida ? "bg-brand-50/80 dark:bg-brand-500/10" : ""
                  }
                >
                  <label
                    className={
                      "grid cursor-pointer grid-cols-[2rem_1fr] items-center gap-3 px-5 py-4 2xl:grid-cols-[2rem_minmax(12rem,1fr)_8rem_8rem_8rem] 2xl:gap-4 " +
                      (incidencias.length
                        ? "cursor-default"
                        : "hover:bg-brand-25 dark:hover:bg-gray-800/30")
                    }
                  >
                    <input
                      type="checkbox"
                      className="size-5 rounded accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      checked={elegida}
                      disabled={
                        bloqueado ||
                        (!elegida &&
                          (!!incidencias.length ||
                            formulario.entregas.length >= 100))
                      }
                      onChange={() => {
                        alCambiar(alternarEntrega(formulario.entregas, fila));
                        if (
                          soloElegidas &&
                          elegida &&
                          filas.length === 1 &&
                          pagina > 1
                        )
                          establecerPagina(pagina - 1);
                      }}
                      aria-label={t("elegirEntrega", {
                        codigo: fila.codigo,
                        sucursal: fila.sucursal_nombre,
                      })}
                    />
                    <div className="min-w-0">
                      <p className="font-medium break-words">
                        {fila.sucursal_nombre}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {fila.codigo} · {fila.codigo_pedido} ·{" "}
                        {t("cantidadProductos", { cantidad: fila.productos })}
                      </p>
                      {incidencias.map((incidencia) => (
                        <p
                          key={incidencia}
                          className="mt-2 text-xs text-orange-700 dark:text-orange-300"
                        >
                          {t("incidencias." + incidencia)}
                        </p>
                      ))}
                    </div>
                    <div className="col-start-2 text-sm text-gray-500 2xl:col-start-auto dark:text-gray-400">
                      <span className="me-2 text-xs 2xl:hidden">
                        {t("fechaRecepcion")}:
                      </span>
                      {mostrarFechaVenta(fila.fecha_recepcion, idioma)}
                    </div>
                    <div className="col-start-2 text-sm tabular-nums 2xl:col-start-auto 2xl:text-end">
                      <span className="me-2 text-xs text-gray-500 2xl:hidden">
                        {t("kgAceptados")}:
                      </span>
                      {mostrarPesoVenta(fila.peso_aceptado_kg)} kg
                    </div>
                    <div className="col-start-2 flex items-center gap-2 text-sm font-semibold tabular-nums 2xl:col-start-auto 2xl:justify-end">
                      {elegida && (
                        <IconoElegida
                          className="size-4 text-brand-600 2xl:hidden"
                          aria-hidden="true"
                        />
                      )}
                      {fila.total === null
                        ? "—"
                        : mostrarBolivianos(fila.total, idioma)}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
          {total > 10 && (
            <PaginadorPedidos
              pagina={pagina}
              total={total}
              alCambiar={establecerPagina}
              ocupado={bloqueado}
            />
          )}
        </>
      )}
      {formulario.entregas.length >= 100 && (
        <p
          role="status"
          className="p-4 text-sm text-orange-700 dark:text-orange-300"
        >
          {t("limiteEntregas")}
        </p>
      )}
    </div>
  );
}
