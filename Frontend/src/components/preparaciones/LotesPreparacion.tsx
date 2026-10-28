"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 as IconoQuitar } from "lucide-react";
import SelectorCompra from "@/components/compras/SelectorCompra";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { OpcionCompra } from "@/components/compras/tipos";
import type { FieldErrors as Errores } from "@/lib/form-validation";
import type { DocumentoEditable, LotePreparacion } from "./tipos";
import { aMiles, deMiles, asignadoLote } from "./calculos";

export default function LotesPreparacion({
  documento,
  contexto,
  almacen,
  errores,
  ocupado,
  alCambiar,
  alError,
  paginaInicial = 1,
}: {
  documento: DocumentoEditable;
  contexto: string;
  almacen: number | undefined;
  errores: Errores;
  ocupado: boolean;
  alCambiar: (documento: DocumentoEditable) => void;
  alError: (error: unknown) => void;
  paginaInicial?: number;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [producto, establecerProducto] = useState<OpcionCompra | null>(null);
  const [pagina, establecerPagina] = useState(paginaInicial);
  const cambiar = (
    indice: number,
    cambios: Partial<DocumentoEditable["lineas"][number]>,
  ) =>
    alCambiar({
      ...documento,
      lineas: documento.lineas.map((linea, lugar) =>
        lugar === indice ? { ...linea, ...cambios } : linea,
      ),
    });
  const numero = (valor: string) =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(valor),
    );
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t("lotesAyuda")}
      </p>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <SelectorCompra
          ruta={`preparaciones/productos/?${contexto}`}
          etiqueta={t("producto")}
          valor={producto}
          alElegir={establecerProducto}
          deshabilitado={ocupado || !almacen}
          alError={alError}
        />
        <SelectorCompra<LotePreparacion>
          agregar
          etiqueta={t("agregarLote")}
          ruta={`preparaciones/lotes/?${contexto}&almacen=${almacen}&producto=${producto?.id}`}
          valor={null}
          alError={alError}
          deshabilitado={
            ocupado || !almacen || !producto || documento.lineas.length >= 500
          }
          estaDisponible={(lote) =>
            !documento.lineas.some((linea) => linea.lote.id === lote.id)
          }
          descripcion={(lote) =>
            `${lote.producto_nombre} · ${t("saldoMedida", { cantidad: numero(lote.saldo || "0"), unidad: lote.unidad_abreviatura })}`
          }
          alElegir={(lote) => {
            if (lote) {
              alCambiar({
                ...documento,
                lineas: [
                  ...documento.lineas,
                  { lote, merma: "", aprovechable: "", motivo: "" },
                ],
              });
              establecerPagina(Math.floor(documento.lineas.length / 10) + 1);
            }
          }}
        />
      </div>
      {!documento.lineas.length && (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t("sinLotes")}
        </p>
      )}
      {documento.lineas
        .slice((pagina - 1) * 10, pagina * 10)
        .map((linea, posicion) => {
          const indice = (pagina - 1) * 10 + posicion;
          const prefijo = `lineas_${indice}`;
          const asignado = asignadoLote(documento, linea.lote.id);
          const usada = deMiles(
            asignado + aMiles(linea.merma) + aMiles(linea.aprovechable),
          );
          return (
            <article
              key={linea.lote.id}
              className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {linea.lote.producto_nombre} · {linea.lote.nombre}
                  </h3>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    {linea.lote.saldo !== undefined
                      ? t("saldoMedida", {
                          cantidad: numero(linea.lote.saldo),
                          unidad: linea.lote.unidad_abreviatura,
                        })
                      : t("saldoAlConfirmar")}
                  </p>
                  {errores[`${prefijo}_lote`] && (
                    <p className="mt-2 text-sm text-error-500 dark:text-error-400">
                      {errores[`${prefijo}_lote`].join(" ")}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ocupado}
                  aria-label={t("quitarLote", { codigo: linea.lote.nombre })}
                  onClick={() => {
                    const asignaciones = Object.fromEntries(
                      Object.entries(documento.asignaciones).map(
                        ([clave, asignacion]) => {
                          const aportes = { ...asignacion.aportes };
                          delete aportes[linea.lote.id];
                          return [clave, { ...asignacion, aportes }];
                        },
                      ),
                    );
                    alCambiar({
                      ...documento,
                      lineas: documento.lineas.filter(
                        (actual) => actual.lote.id !== linea.lote.id,
                      ),
                      asignaciones,
                    });
                    establecerPagina(
                      Math.min(
                        pagina,
                        Math.max(
                          1,
                          Math.ceil((documento.lineas.length - 1) / 10),
                        ),
                      ),
                    );
                  }}
                >
                  <IconoQuitar className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid items-start gap-4 sm:grid-cols-3">
                <CampoDirectorio
                  id={`${prefijo}_cantidad_utilizada`}
                  name={`${prefijo}_cantidad_utilizada`}
                  etiqueta={t("utilizadaUnidad", {
                    unidad: linea.lote.unidad_abreviatura,
                  })}
                  value={numero(usada)}
                  readOnly
                  ayuda={t("utilizadaAyuda")}
                  errores={errores[`${prefijo}_cantidad_utilizada`]}
                />
                <CampoDirectorio
                  id={`${prefijo}_merma`}
                  name={`${prefijo}_merma`}
                  etiqueta={t("mermaUnidad", {
                    unidad: linea.lote.unidad_abreviatura,
                  })}
                  value={linea.merma}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={99999999999.999}
                  step={0.001}
                  placeholder="0"
                  errores={errores[`${prefijo}_merma`]}
                  onChange={(evento) =>
                    cambiar(indice, { merma: evento.target.value })
                  }
                />
                <CampoDirectorio
                  id={`${prefijo}_aprovechable`}
                  name={`${prefijo}_aprovechable`}
                  etiqueta={t("aprovechableUnidad", {
                    unidad: linea.lote.unidad_abreviatura,
                  })}
                  value={linea.aprovechable}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={99999999999.999}
                  step={0.001}
                  placeholder="0"
                  errores={errores[`${prefijo}_aprovechable`]}
                  onChange={(evento) =>
                    cambiar(indice, { aprovechable: evento.target.value })
                  }
                />
              </div>
              {(Number(linea.merma) > 0 || Number(linea.aprovechable) > 0) && (
                <div className="mt-4">
                  <CampoDirectorio
                    id={`${prefijo}_motivo_separacion`}
                    name={`${prefijo}_motivo_separacion`}
                    etiqueta={t("motivoSeparacion")}
                    required
                    maxLength={500}
                    value={linea.motivo}
                    errores={errores[`${prefijo}_motivo_separacion`]}
                    onChange={(evento) =>
                      cambiar(indice, { motivo: evento.target.value })
                    }
                  />
                  <p className="mt-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                    {t("aprovechableAyuda")}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      <PaginadorCompras
        pagina={pagina}
        total={documento.lineas.length}
        ocupado={ocupado}
        alCambiar={establecerPagina}
      />
    </div>
  );
}
