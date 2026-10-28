"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 as IconoQuitar } from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import { mostrarFecha } from "@/components/compras/calculos";
import { aMiles, deMiles, asignadoLote } from "./calculos";
import type {
  DocumentoEditable,
  LineaEditable,
  LotePreparacion,
  ProductoPreparacion,
} from "./tipos";

export default function LotesProductoPreparacion({
  producto,
  documento,
  contexto,
  almacen,
  ocupado,
  errores,
  alAgregar,
  alCambiar,
  alQuitar,
  alError,
  paginaInicial = 1,
}: {
  producto: ProductoPreparacion;
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alAgregar: (lote: LotePreparacion) => void;
  alCambiar: (indice: number, cambio: Partial<LineaEditable>) => void;
  alQuitar: (lote: number) => void;
  alError: (error: unknown) => void;
  paginaInicial?: number;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(paginaInicial);
  const lineas = documento.lineas.filter(
    (linea) => linea.lote.producto === producto.id,
  );
  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(lineas.length / 10)));
  const numero = (valor: string) =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(valor),
    );
  return (
    <section
      className="space-y-4 border-t border-gray-100 p-5 dark:border-gray-800"
      aria-labelledby="lotes-del-producto"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="lotes-del-producto"
            className="font-semibold text-gray-900 dark:text-white"
          >
            {t("deQueLoteSale")}
          </h3>
          <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("lotesProductoAyuda")}
          </p>
        </div>
        <DesplegableCompra<LotePreparacion>
          tipo="general"
          ruta={`preparaciones/lotes/?${contexto}&almacen=${almacen || ""}&producto=${producto.id}`}
          etiqueta={t("elegirLoteTrabajo")}
          agregar
          valor={null}
          deshabilitado={ocupado || !almacen || documento.lineas.length >= 500}
          alError={alError}
          descripcion={(lote) => (
            <>
              {t("saldoLoteDisponible", {
                cantidad: numero(lote.saldo || "0"),
                unidad: lote.unidad_abreviatura,
              })}
              {lote.fecha_vencimiento
                ? ` · ${t("venceTrabajo", { fecha: mostrarFecha(lote.fecha_vencimiento, idioma) })}`
                : ` · ${t("sinVencimientoTrabajo")}`}
            </>
          )}
          alElegir={(lote) => {
            if (lote) {
              alAgregar({
                ...lote,
                producto_imagen: producto.imagen,
                producto_categoria: producto.categoria || undefined,
              });
              establecerPagina(Math.floor(lineas.length / 10) + 1);
            }
          }}
        />
      </div>
      {!lineas.length ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t(almacen ? "eligeLoteParaMedir" : "eligeAlmacenParaLotes")}
        </p>
      ) : (
        lineas.slice((paginaActual - 1) * 10, paginaActual * 10).map((linea) => {
          const indice = documento.lineas.indexOf(linea);
          const prefijo = `lineas_${indice}`;
          const usada =
            asignadoLote(documento, linea.lote.id) +
            aMiles(linea.merma) +
            aMiles(linea.aprovechable);
          const hayCalidad =
            Number(linea.merma) > 0 ||
            Number(linea.aprovechable) > 0 ||
            !!linea.motivo;
          const erroresCalidad = [
            "merma",
            "aprovechable",
            "motivo_separacion",
          ].some((campo) => errores[`${prefijo}_${campo}`]?.length);
          return (
            <article
              key={linea.lote.id}
              className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {linea.lote.nombre}{" "}
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      · {linea.lote.unidad_abreviatura}
                    </span>
                  </p>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    {linea.lote.saldo !== undefined
                      ? t("saldoLoteDisponible", {
                          cantidad: numero(linea.lote.saldo),
                          unidad: linea.lote.unidad_abreviatura,
                        })
                      : t("saldoAlConfirmar")}
                    {linea.lote.fecha_vencimiento
                      ? ` · ${t("venceTrabajo", { fecha: mostrarFecha(linea.lote.fecha_vencimiento, idioma) })}`
                      : ""}
                  </p>
                  {["lote", "cantidad_utilizada"].map((campo) =>
                    errores[`${prefijo}_${campo}`]?.length ? (
                      <p
                        key={campo}
                        role="alert"
                        tabIndex={-1}
                        data-invalido="true"
                        className="mt-2 rounded text-theme-xs text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 dark:text-error-400"
                      >
                        {errores[`${prefijo}_${campo}`].join(" ")}
                      </p>
                    ) : null,
                  )}
                </div>
                <p className="text-end text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("totalUsadoLote")}
                  <span className="mt-1 block text-base font-semibold text-gray-900 tabular-nums dark:text-white">
                    {numero(deMiles(usada))} {linea.lote.unidad_abreviatura}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => alQuitar(linea.lote.id)}
                  aria-label={t("quitarLote", { codigo: linea.lote.nombre })}
                  className="flex size-9 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 disabled:opacity-50 dark:hover:bg-error-500/10"
                >
                  <IconoQuitar className="size-4" aria-hidden="true" />
                </button>
              </div>
              <details
                className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800"
                open={hayCalidad || erroresCalidad ? true : undefined}
              >
                <summary className="cursor-pointer rounded text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300">
                  {t("huboSeparacionCalidad")}
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {(["merma", "aprovechable"] as const).map((campo) => (
                    <CampoDirectorio
                      key={campo}
                      id={`${prefijo}_${campo}`}
                      name={`${prefijo}_${campo}`}
                      etiqueta={t(
                        campo === "merma"
                          ? "descartadoTrabajo"
                          : "otroUsoTrabajo",
                        { unidad: linea.lote.unidad_abreviatura },
                      )}
                      value={linea[campo]}
                      inputMode="decimal"
                      pattern="[0-9]{1,11}([.][0-9]{1,3})?"
                      maxLength={15}
                      placeholder="0"
                      disabled={ocupado}
                      errores={errores[`${prefijo}_${campo}`]}
                      onChange={(evento) =>
                        alCambiar(indice, {
                          [campo]: evento.target.value.replace(",", "."),
                        })
                      }
                    />
                  ))}
                  <div className="sm:col-span-2">
                    <CampoDirectorio
                      id={`${prefijo}_motivo_separacion`}
                      name={`${prefijo}_motivo_separacion`}
                      etiqueta={t("motivoSeparacionTrabajo")}
                      value={linea.motivo}
                      maxLength={500}
                      disabled={ocupado}
                      errores={errores[`${prefijo}_motivo_separacion`]}
                      onChange={(evento) =>
                        alCambiar(indice, { motivo: evento.target.value })
                      }
                    />
                    <p className="mt-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                      {t("otroUsoAyudaTrabajo")}
                    </p>
                  </div>
                </div>
              </details>
            </article>
          );
        })
      )}
      {!!lineas.length && (
        <PaginadorCompras
          pagina={Math.min(pagina, Math.max(1, Math.ceil(lineas.length / 10)))}
          total={lineas.length}
          ocupado={ocupado}
          alCambiar={establecerPagina}
        />
      )}
    </section>
  );
}
