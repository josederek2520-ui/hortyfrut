"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ImagenProducto from "@/components/productos/ImagenProducto";
import {
  entradaEntrega,
  type ProductoEntrega,
  type LineaEditable,
  type CampoRecepcion,
} from "./tipos";
import {
  mostrarMedicion,
  pesoAceptado,
  diferenciaProductoEntrega,
  medirEntrega,
} from "./calculosEntrega";
import DiferenciaEntrega from "./DiferenciaEntrega";
import ErrorCampoEntrega from "./ErrorCampoEntrega";
import estilos from "./estilosEntregas.module.css";

export default function FilaRecepcionEntrega({
  producto,
  linea,
  errores,
  bloqueado,
  alCambiar,
  modo,
  soloLectura = false,
}: {
  producto: ProductoEntrega;
  linea: LineaEditable;
  errores: Record<string, string[]>;
  bloqueado: boolean;
  alCambiar: (campo: CampoRecepcion, valor: string) => void;
  modo: "tabla" | "tarjeta";
  soloLectura?: boolean;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  const campoEntrada = (
    campo: CampoRecepcion,
    etiqueta: string,
    entero = false,
  ) => {
    const clave = producto.producto + "_" + campo,
      error = errores[clave];
    const id = "entrega-" + modo + "-" + producto.producto + "-" + campo;
    if (soloLectura)
      return (
        <p className="py-2 text-end text-sm font-medium tabular-nums">
          {mostrarMedicion(
            medirEntrega(linea[campo]) === null ? null : linea[campo],
            idioma,
          )}
        </p>
      );
    return (
      <div>
        <input
          id={id}
          data-campo-entrega={clave}
          className={
            entradaEntrega +
            " min-w-0 px-3 text-end tabular-nums " +
            (error ? "border-error-500" : "")
          }
          type="text"
          inputMode={entero ? "numeric" : "decimal"}
          autoComplete="off"
          aria-label={producto.nombre + ": " + etiqueta}
          aria-invalid={!!error}
          aria-describedby={error ? id + "-error" : undefined}
          value={linea[campo]}
          disabled={bloqueado}
          onChange={(evento) => alCambiar(campo, evento.target.value)}
        />
        <ErrorCampoEntrega mensajes={error} id={id + "-error"} />
      </div>
    );
  };
  const identidad = (
    <div className="flex items-center gap-3">
      <ImagenProducto
        origen={producto.imagen ?? null}
        nombre={producto.nombre}
        sinRecorte
      />
      <div>
        <p className="font-semibold">{producto.nombre}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {producto.categoria}
        </p>
      </div>
    </div>
  );
  const hayRechazo = [
    linea.peso_rechazado_kg,
    linea.cajas_rechazadas,
    linea.unidades_rechazadas,
  ].some((valor) => (medirEntrega(valor) ?? BigInt(0)) > BigInt(0));
  const erroresRechazo = [
    "peso_rechazado_kg",
    "cajas_rechazadas",
    "unidades_rechazadas",
    "motivo_rechazo",
  ].some((campo) => errores[producto.producto + "_" + campo]);
  const [rechazoAbierto, establecerRechazoAbierto] = useState(hayRechazo);
  const idMotivo =
    "entrega-" + modo + "-" + producto.producto + "-motivo_rechazo";
  const rechazo =
    soloLectura && !hayRechazo ? (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t("sinRechazo")}
      </p>
    ) : (
      <details
        open={rechazoAbierto || erroresRechazo}
        onToggle={(evento) =>
          establecerRechazoAbierto(evento.currentTarget.open)
        }
        className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 dark:border-gray-700"
      >
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500">
          {t(hayRechazo ? "detalleRechazo" : "registrarRechazo")}
        </summary>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {t("rechazoIncluido")}
        </p>
        <div className="grid gap-3 pb-3 sm:grid-cols-3">
          {(
            [
              "cajas_rechazadas",
              "unidades_rechazadas",
              "peso_rechazado_kg",
            ] as const
          ).map((campo, indice) => (
            <div key={campo}>
              <p className="mb-1 text-xs">
                {t(
                  ["cajasRechazadas", "unidadesRechazadas", "pesoRechazado"][
                    indice
                  ],
                )}
              </p>
              {campoEntrada(
                campo,
                t(
                  ["cajasRechazadas", "unidadesRechazadas", "pesoRechazado"][
                    indice
                  ],
                ),
                indice < 2,
              )}
            </div>
          ))}
          <div className="sm:col-span-3">
            <label
              htmlFor={soloLectura ? undefined : idMotivo}
              className="mb-1 block text-xs"
            >
              {t("motivoRechazo")}
            </label>
            {soloLectura ? (
              <p className="text-sm whitespace-pre-wrap">
                {linea.motivo_rechazo || "—"}
              </p>
            ) : (
              <>
                <textarea
                  id={idMotivo}
                  data-campo-entrega={producto.producto + "_motivo_rechazo"}
                  maxLength={500}
                  aria-label={producto.nombre + ": " + t("motivoRechazo")}
                  aria-invalid={
                    !!errores[producto.producto + "_motivo_rechazo"]
                  }
                  aria-describedby={
                    errores[producto.producto + "_motivo_rechazo"]
                      ? idMotivo + "-error"
                      : undefined
                  }
                  className={
                    entradaEntrega +
                    " min-h-20 " +
                    (errores[producto.producto + "_motivo_rechazo"]
                      ? "border-error-500"
                      : "")
                  }
                  value={linea.motivo_rechazo}
                  disabled={bloqueado}
                  onChange={(evento) =>
                    alCambiar("motivo_rechazo", evento.target.value)
                  }
                />
                <ErrorCampoEntrega
                  mensajes={errores[producto.producto + "_motivo_rechazo"]}
                  id={idMotivo + "-error"}
                />
              </>
            )}
          </div>
        </div>
      </details>
    );
  const diferencia = (
    <DiferenciaEntrega
      diferencia={diferenciaProductoEntrega(
        producto.peso_kg,
        linea.peso_recibido_kg,
      )}
    />
  );
  if (modo === "tarjeta")
    return (
      <article className="space-y-4 border-b border-gray-100 p-4 dark:border-gray-800">
        {identidad}
        <div className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("enviadoReferencia")}
          </p>
          {t("resumenEnviado", {
            cajas: producto.cajas,
            unidades: producto.unidades,
            kilos: mostrarMedicion(producto.peso_kg, idioma),
          })}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">{t("recibido")}</p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                "cajas_recibidas",
                "unidades_recibidas",
                "peso_recibido_kg",
              ] as const
            ).map((campo, indice) => (
              <div key={campo} className={indice === 2 ? "col-span-2" : ""}>
                <p className="mb-1 text-xs">
                  {t(
                    ["cajasRecibidas", "unidadesRecibidas", "pesoRecibido"][
                      indice
                    ],
                  )}
                </p>
                {campoEntrada(
                  campo,
                  t(
                    ["cajasRecibidas", "unidadesRecibidas", "pesoRecibido"][
                      indice
                    ],
                  ),
                  indice < 2,
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {t("aceptado")}: {mostrarMedicion(pesoAceptado(linea), idioma)} kg
          </p>
          {diferencia}
        </div>
        {rechazo}
      </article>
    );
  return (
    <>
      <tr>
        <td className="min-w-44 px-4 py-4">{identidad}</td>
        {[
          String(producto.cajas),
          String(producto.unidades),
          mostrarMedicion(producto.peso_kg, idioma),
        ].map((valor, indice) => (
          <td
            key={indice}
            className="bg-gray-50/60 px-3 text-end text-sm text-gray-600 tabular-nums dark:bg-gray-800/40 dark:text-gray-300"
          >
            {valor}
          </td>
        ))}
        {(
          ["cajas_recibidas", "unidades_recibidas", "peso_recibido_kg"] as const
        ).map((campo, indice) => (
          <td
            key={campo}
            className={`${estilos.columnaRecibida} w-28 px-2 py-4 align-top`}
          >
            {campoEntrada(
              campo,
              t(
                ["cajasRecibidas", "unidadesRecibidas", "pesoRecibido"][indice],
              ),
              indice < 2,
            )}
          </td>
        ))}
        <td className="px-3 text-end tabular-nums">
          {mostrarMedicion(
            medirEntrega(linea.peso_rechazado_kg) === null
              ? null
              : linea.peso_rechazado_kg,
            idioma,
          )}
        </td>
        <td className="px-4 text-end font-semibold text-brand-700 tabular-nums dark:text-brand-300">
          {mostrarMedicion(pesoAceptado(linea), idioma)}
        </td>
      </tr>
      <tr className="border-b border-gray-100 dark:border-gray-800">
        <td colSpan={9} className="px-4 pb-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-40 pt-3">{diferencia}</div>
            {rechazo}
          </div>
        </td>
      </tr>
    </>
  );
}
