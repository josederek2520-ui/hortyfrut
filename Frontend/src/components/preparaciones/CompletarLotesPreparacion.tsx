"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus as IconoAgregar, X as IconoQuitar } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { aMiles, consumosLotesPreparacion } from "./calculos";
import {
  aplicarDistribucionLotes,
  ErrorDistribucionLotes,
  huellaDistribucionLotes,
  proponerDistribucionLotes,
  type PropuestaDistribucionLotes,
} from "./distribucionLotesPreparacion";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
} from "./tipos";

export default function CompletarLotesPreparacion({
  documento,
  asignacion,
  origen,
  contexto,
  almacen,
  ocupado,
  alAplicar,
  alError,
}: {
  documento: DocumentoEditable;
  asignacion: AsignacionEditable;
  origen: LotePreparacion;
  contexto: string;
  almacen?: number;
  ocupado: boolean;
  alAplicar: (documento: DocumentoEditable) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const modal = useModal();
  const [seleccion, establecerSeleccion] = useState<{
    base: string;
    lotes: LotePreparacion[];
  } | null>(null);
  const [fallo, establecerFallo] = useState("");
  const huella = huellaDistribucionLotes(
    documento,
    asignacion,
    contexto,
    almacen,
  );
  const cambio = seleccion !== null && seleccion.base !== huella;
  let propuesta: PropuestaDistribucionLotes | null = null;
  let problema = "";
  if (modal.isOpen && seleccion && !cambio) {
    try {
      propuesta = proponerDistribucionLotes(
        documento,
        asignacion,
        origen,
        seleccion.lotes,
      );
    } catch (error) {
      problema = t(
        `erroresDistribucion.${error instanceof ErrorDistribucionLotes ? error.codigo : "datos"}`,
      );
    }
  }
  const deshabilitado =
    ocupado || !asignacion.disponible || !asignacion.detalle || !almacen;
  const revisar = () => {
    if (!deshabilitado) {
      establecerSeleccion({ base: huella, lotes: [] });
      establecerFallo("");
      modal.openModal();
    }
  };
  const elegir = (lote: LotePreparacion | null) => {
    if (!lote || !seleccion || deshabilitado || cambio) return;
    try {
      const lotes = [...seleccion.lotes, lote];
      proponerDistribucionLotes(documento, asignacion, origen, lotes);
      establecerSeleccion({ ...seleccion, lotes });
      establecerFallo("");
    } catch (error) {
      establecerFallo(
        t(
          `erroresDistribucion.${error instanceof ErrorDistribucionLotes ? error.codigo : "datos"}`,
        ),
      );
    }
  };
  const aplicar = () => {
    if (
      deshabilitado ||
      cambio ||
      !seleccion ||
      !propuesta ||
      aMiles(propuesta.faltante) > BigInt(0)
    )
      return;
    try {
      alAplicar(
        aplicarDistribucionLotes(
          documento,
          asignacion,
          origen,
          seleccion.lotes,
          seleccion.base,
          contexto,
          almacen,
        ),
      );
      modal.closeModal();
    } catch (error) {
      establecerFallo(
        t(
          `erroresDistribucion.${error instanceof ErrorDistribucionLotes ? error.codigo : "datos"}`,
        ),
      );
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={deshabilitado || Object.keys(asignacion.aportes).length >= 20}
        onClick={revisar}
        startIcon={<IconoAgregar className="size-4" />}
      >
        {t("completarOtroLote")}
      </Button>
      {modal.isOpen && seleccion && (
        <Modal
          isOpen
          onClose={() => {
            if (!ocupado) modal.closeModal();
          }}
          className="max-w-xl"
          labelledBy="titulo-distribucion-lotes"
          closeLabel={t("cerrar")}
        >
          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <h2
                id="titulo-distribucion-lotes"
                className="pe-9 text-xl font-semibold text-gray-900 dark:text-white"
              >
                {t("revisarDistribucionLotes")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {asignacion.sucursalNombre} · {asignacion.codigo}
              </p>
            </div>
            {cambio || problema ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-error-600 dark:text-error-400">
                  {cambio ? t("erroresDistribucion.cambio") : problema}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deshabilitado}
                  onClick={revisar}
                >
                  {t("reiniciarDistribucion")}
                </Button>
              </div>
            ) : (
              propuesta && (
                <>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {t("objetivoDistribucion", {
                      cantidad: propuesta.objetivo,
                      unidad: origen.unidad_abreviatura,
                    })}
                  </p>
                  <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                    {t("ayudaDistribucionLotes")}
                  </p>
                  <ol className="space-y-2">
                    {propuesta.filas.map((fila, indice) => (
                      <li
                        key={fila.lote.id}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                          {fila.lote.nombre}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
                          {fila.cantidad} {fila.lote.unidad_abreviatura}
                        </span>
                        {indice > 0 && (
                          <button
                            type="button"
                            disabled={ocupado}
                            aria-label={t("quitarLoteDistribucion", {
                              lote: fila.lote.nombre,
                            })}
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400"
                            onClick={() => {
                              establecerSeleccion({
                                ...seleccion,
                                lotes: seleccion.lotes.filter(
                                  (lote) => lote.id !== fila.lote.id,
                                ),
                              });
                              establecerFallo("");
                            }}
                          >
                            <IconoQuitar className="size-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p
                    role="status"
                    className={`rounded-xl p-3 text-sm font-medium ${aMiles(propuesta.faltante) > BigInt(0) ? "bg-warning-50 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300" : "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300"}`}
                  >
                    {t(
                      aMiles(propuesta.faltante) > BigInt(0)
                        ? "faltanteDistribucion"
                        : "distribucionCompleta",
                      {
                        cantidad:
                          aMiles(propuesta.faltante) > BigInt(0)
                            ? propuesta.faltante
                            : propuesta.objetivo,
                        unidad: origen.unidad_abreviatura,
                      },
                    )}
                  </p>
                  {aMiles(propuesta.faltante) > BigInt(0) &&
                    Object.keys(asignacion.aportes).length +
                      seleccion.lotes.length <
                      20 && (
                      <DesplegableCompra<LotePreparacion>
                        tipo="general"
                        agregar
                        valor={null}
                        ruta={`preparaciones/lotes/?${contexto}&almacen=${almacen || ""}&producto=${asignacion.producto}&unidad=${origen.unidad}`}
                        etiqueta={t("elegirLoteCompletar")}
                        datosConsulta={{
                          consumos: consumosLotesPreparacion(documento),
                          excluir: [
                            ...Object.keys(asignacion.aportes).map(Number),
                            ...seleccion.lotes.map((lote) => lote.id),
                          ],
                        }}
                        textoSinOpciones={t("sinLotesSaldoTrabajo")}
                        deshabilitado={deshabilitado}
                        descripcion={(lote) =>
                          t("saldoLoteDisponible", {
                            cantidad:
                              lote.disponible_preparacion ?? lote.saldo ?? "—",
                            unidad: lote.unidad_abreviatura,
                          })
                        }
                        alElegir={elegir}
                        alError={alError}
                      />
                    )}
                  {aMiles(propuesta.faltante) > BigInt(0) &&
                    Object.keys(asignacion.aportes).length +
                      seleccion.lotes.length >=
                      20 && (
                      <p
                        role="alert"
                        className="text-sm text-error-600 dark:text-error-400"
                      >
                        {t("erroresDistribucion.limite")}
                      </p>
                    )}
                </>
              )
            )}
            {fallo && (
              <p
                role="alert"
                className="text-sm text-error-600 dark:text-error-400"
              >
                {fallo}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={modal.closeModal}
              >
                {t("cancelarDistribucion")}
              </Button>
              <Button
                disabled={
                  deshabilitado ||
                  cambio ||
                  !propuesta ||
                  aMiles(propuesta.faltante) > BigInt(0)
                }
                onClick={aplicar}
              >
                {t("aplicarDistribucion")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
