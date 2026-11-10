"use client";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { mostrarMedicion } from "@/components/entregas/calculosEntrega";
import ErrorDevolucion from "./ErrorDevolucion";
import {
  entradaDevolucion,
  type AporteDevolucion,
  type CampoDevolucion,
  type LineaEditableDevolucion,
  type LineaDevolucion,
} from "./tipos";
import { medicionDevolucion } from "./calculosDevolucion";

export default function FilaDevolucion({
  aporte,
  linea,
  registro,
  modo,
  bloqueado,
  verLotes,
  errores,
  alAgregar,
  alQuitar,
  alCambiar,
  recibida = false,
}: {
  aporte: AporteDevolucion;
  linea?: LineaEditableDevolucion;
  registro?: LineaDevolucion;
  modo: "recepcion" | "revision" | "consulta";
  bloqueado: boolean;
  verLotes: boolean;
  errores: Record<string, string[]>;
  alAgregar: () => void;
  alQuitar: () => void;
  alCambiar: (campo: CampoDevolucion, valor: string) => void;
  recibida?: boolean;
}) {
  const t = useTranslations("devoluciones"),
    idioma = useLocale();
  const mostrar = (valor?: string | null) =>
    mostrarMedicion(
      valor && medicionDevolucion(valor) !== null
        ? valor.replace(",", ".")
        : null,
      idioma,
    );
  const campo = (nombre: CampoDevolucion, titulo: string) => {
    const clave = aporte.id + "_" + nombre,
      identificador = "devolucion-" + clave;
    return (
      <div>
        <label
          htmlFor={modo === "consulta" ? undefined : identificador}
          className="mb-1 block text-xs font-medium"
        >
          {titulo}
        </label>
        {modo === "consulta" ? (
          <p className="text-sm font-semibold tabular-nums">
            {mostrar(linea?.[nombre])}
          </p>
        ) : (
          <>
            <input
              id={identificador}
              data-campo-devolucion={clave}
              className={
                entradaDevolucion +
                " text-end tabular-nums " +
                (errores[clave] ? "border-error-500" : "")
              }
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={linea?.[nombre] ?? ""}
              disabled={bloqueado}
              aria-label={
                aporte.producto_nombre +
                " · " +
                aporte.codigo_lote +
                " · " +
                titulo
              }
              aria-invalid={!!errores[clave]}
              aria-describedby={
                errores[clave] ? identificador + "-error" : undefined
              }
              onChange={(evento) => alCambiar(nombre, evento.target.value)}
            />
            <ErrorDevolucion
              mensajes={errores[clave]}
              id={identificador + "-error"}
            />
          </>
        )}
      </div>
    );
  };
  const tieneRevision =
    linea?.cantidad_aprovechable !== "" &&
    linea?.cantidad_aprovechable !== undefined;
  const sinSaldo =
    medicionDevolucion(aporte.maximo_cantidad) === BigInt(0) ||
    medicionDevolucion(aporte.maximo_peso) === BigInt(0);
  return (
    <article
      tabIndex={-1}
      data-campo-devolucion={"aporte_" + aporte.id}
      className="space-y-4 border-t border-gray-100 p-5 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <Package className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold">{aporte.producto_nombre}</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {aporte.codigo_lote} · {aporte.preparacion}
            </p>
          </div>
        </div>
        {modo === "recepcion" &&
          (linea ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-error-700 focus-visible:outline-2 focus-visible:outline-error-500 dark:text-error-300"
              disabled={bloqueado}
              onClick={alQuitar}
            >
              <X className="size-4" aria-hidden="true" />
              {t("quitarAporte")}
            </button>
          ) : (
            <Button
              variant="outline"
              disabled={bloqueado || sinSaldo}
              startIcon={<Plus className="size-4" />}
              onClick={alAgregar}
            >
              {t(sinSaldo ? "sinSaldo" : "agregarAporte")}
            </Button>
          ))}
      </div>
      {modo === "recepcion" && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs sm:grid-cols-4 dark:bg-gray-800">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">
              {t("enviadoLote")}
            </dt>
            <dd className="mt-1 font-medium">
              {mostrar(aporte.cantidad_enviada)} {aporte.unidad_abreviatura}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">
              {t("yaDevuelto")}
            </dt>
            <dd className="mt-1 font-medium">
              {mostrar(aporte.cantidad_devuelta)} {aporte.unidad_abreviatura}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">
              {t("maximoRetorno")}
            </dt>
            <dd className="mt-1 font-medium">
              {mostrar(aporte.maximo_cantidad)} {aporte.unidad_abreviatura}
              {!aporte.es_kg && (
                <span className="block">
                  {t("limitePeso", { peso: mostrar(aporte.maximo_peso) })}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">
              {t("rechazadoReferencia")}
            </dt>
            <dd className="mt-1 font-medium">
              {mostrar(aporte.peso_rechazado_entrega)} kg
            </dd>
          </div>
        </dl>
      )}
      {linea && (
        <>
          {modo === "recepcion" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {campo(
                "cantidad_recibida",
                t("cantidadDevuelta", { unidad: aporte.unidad_abreviatura }),
              )}
              {!aporte.es_kg && campo("peso_kg_recibido", t("pesoDevuelto"))}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">
              <p className="font-medium">
                {t(recibida ? "recepcionConfirmada" : "cantidadesAnotadas")}:{" "}
                {mostrar(linea.cantidad_recibida)} {aporte.unidad_abreviatura}
                {!aporte.es_kg &&
                  " · " + mostrar(linea.peso_kg_recibido) + " kg"}
              </p>
              {registro?.lote_retenido && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("loteRetenido")}: {registro.lote_retenido.codigo}
                </p>
              )}
            </div>
          )}
          {aporte.vencido && (
            <p className="text-xs font-medium text-orange-800 dark:text-orange-200">
              {t("vencidoSoloMerma")}
            </p>
          )}
          {(modo === "revision" || (modo === "consulta" && tieneRevision)) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-brand-200 p-3 dark:border-brand-800">
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                  {t("aprovechable")}
                </p>
                {campo(
                  "cantidad_aprovechable",
                  t("cantidadParte", { unidad: aporte.unidad_abreviatura }),
                )}
                {!aporte.es_kg && campo("peso_kg_aprovechable", t("pesoParte"))}
              </div>
              <div className="space-y-3 rounded-xl border border-orange-200 p-3 dark:border-orange-900">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                  {t("merma")}
                </p>
                {campo(
                  "cantidad_merma",
                  t("cantidadParte", { unidad: aporte.unidad_abreviatura }),
                )}
                {!aporte.es_kg && campo("peso_kg_merma", t("pesoParte"))}
              </div>
            </div>
          )}
          {registro?.lote_aprovechable && (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {t("loteAprovechable")}:{" "}
              {verLotes ? (
                <Link
                  className="rounded text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                  href={"/lotes/" + registro.lote_aprovechable.id}
                >
                  {registro.lote_aprovechable.codigo}
                </Link>
              ) : (
                registro.lote_aprovechable.codigo
              )}
            </p>
          )}
        </>
      )}
    </article>
  );
}
