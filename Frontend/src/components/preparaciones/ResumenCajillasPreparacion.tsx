"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight as IconoAbrir, Trash2 as IconoQuitar } from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import ColorCajilla from "@/components/cajillas/ColorCajilla";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import { resumirCajillasPreparacion } from "./planCajillasPreparacion";
import type { DocumentoEditable, OpcionPreparacion } from "./tipos";

export default function ResumenCajillasPreparacion({
  documento,
  ocupado,
  errores,
  alCambiar,
  alAbrirProducto,
  paginaInicial = 1,
}: {
  documento: DocumentoEditable;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (documento: DocumentoEditable) => void;
  alAbrirProducto: (producto: OpcionPreparacion) => void;
  paginaInicial?: number;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(paginaInicial);
  const filas = documento.cajillas;
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(filas.length / 10)),
  );
  const total = resumirCajillasPreparacion(filas).reduce(
    (suma, fila) => suma + fila.cantidad,
    0,
  );
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
        {t("resumenCajillasAyuda")}
      </p>
      {!filas.length ? (
        <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
          {t("sinCajillasProducto")}
        </p>
      ) : (
        <>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {t("totalCajillasPrevistas", {
              cantidad: new Intl.NumberFormat(idioma).format(total),
            })}
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filas
              .slice((paginaActual - 1) * 10, paginaActual * 10)
              .map((fila) => {
                const indice = documento.cajillas.indexOf(fila);
                return (
                  <div
                    key={fila.clave}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {fila.producto?.nombre ||
                          t("cajillasHistoricasSinProducto")}
                        <span className="mx-2 text-gray-400">·</span>
                        {fila.sucursal.nombre}
                      </p>
                      <div className="mt-1">
                        <ColorCajilla color={fila.color.nombre} />
                      </div>
                    </div>
                    {fila.producto ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => alAbrirProducto(fila.producto!)}
                          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-brand-300"
                        >
                          {t("cantidadCajillasValor", {
                            cantidad: Number(fila.cantidad) || 0,
                          })}
                          <IconoAbrir
                            className="size-4 rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          aria-label={t("quitarCajillas")}
                          onClick={() =>
                            alCambiar({
                              ...documento,
                              cajillas: filas.filter(
                                (actual) => actual !== fila,
                              ),
                            })
                          }
                          className="flex size-11 items-center justify-center rounded-lg text-gray-500 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
                        >
                          <IconoQuitar className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="w-32">
                          <CampoDirectorio
                            id={`cajillas_${indice}_cantidad`}
                            etiqueta={t("cantidadCajillas")}
                            value={fila.cantidad}
                            disabled={ocupado}
                            inputMode="numeric"
                            pattern="[0-9]{1,10}"
                            maxLength={10}
                            errores={errores[`cajillas_${indice}_cantidad`]}
                            onChange={(evento) =>
                              alCambiar({
                                ...documento,
                                cajillas: filas.map((actual) =>
                                  actual === fila
                                    ? {
                                        ...actual,
                                        cantidad: evento.target.value,
                                      }
                                    : actual,
                                ),
                              })
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="mt-6 flex size-11 items-center justify-center rounded-lg text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
                          disabled={ocupado}
                          aria-label={t("quitarCajillas")}
                          onClick={() =>
                            alCambiar({
                              ...documento,
                              cajillas: filas.filter(
                                (actual) => actual !== fila,
                              ),
                            })
                          }
                        >
                          <IconoQuitar className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    {["sucursal", "producto", "cajilla"].map((campo) =>
                      errores[`cajillas_${indice}_${campo}`]?.length ? (
                        <p
                          key={campo}
                          role="alert"
                          tabIndex={-1}
                          data-invalido="true"
                          className="w-full text-sm text-error-600 dark:text-error-400"
                        >
                          {errores[`cajillas_${indice}_${campo}`].join(" ")}
                        </p>
                      ) : null,
                    )}
                  </div>
                );
              })}
          </div>
          {filas.length > 10 && (
            <PaginadorCompras
              pagina={paginaActual}
              total={filas.length}
              ocupado={ocupado}
              alCambiar={establecerPagina}
            />
          )}
        </>
      )}
    </div>
  );
}
