"use client";
import { useLocale, useTranslations } from "next-intl";
import { X as IconoQuitar, Package as IconoLote } from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { mostrarFecha } from "@/components/compras/calculos";
import {
  aportesConMedicion,
  compactarCantidadPreparacion,
  aMiles,
  deMiles,
  consumosLotesPreparacion,
  disponibleLotePreparacion,
} from "./calculos";
import estilos from "./estilosTrabajo.module.css";
import CompletarLotesPreparacion from "./CompletarLotesPreparacion";
import {
  insuficienciaLotePreparacion,
  totalesKgAsignacion,
} from "./distribucionLotesPreparacion";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
} from "./tipos";

export default function AportesSucursalPreparacion({
  asignacion,
  documento,
  contexto,
  almacen,
  prefijo,
  ocupado,
  errores,
  alCambiar,
  alElegirLote,
  alError,
  alCambiarDocumento,
}: {
  asignacion: AsignacionEditable;
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  prefijo: string;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (asignacion: AsignacionEditable) => void;
  alElegirLote: (lote: LotePreparacion) => void;
  alError: (error: unknown) => void;
  alCambiarDocumento?: (documento: DocumentoEditable) => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const fuentes = documento.lineas.filter(
    (linea) => linea.lote.producto === asignacion.producto,
  );
  const ids = Object.keys(asignacion.aportes).map(Number);
  const medidos = aportesConMedicion(asignacion, documento).map(([lote]) =>
    Number(lote),
  );
  const totalesKg = totalesKgAsignacion(documento, asignacion);
  const deshabilitado =
    ocupado || !asignacion.detalle || !asignacion.disponible;
  const modificar = (
    lote: number,
    cambios: { cantidad?: string; pesoKg?: string },
  ) =>
    alCambiar({
      ...asignacion,
      aportes: {
        ...asignacion.aportes,
        [lote]: {
          ...(asignacion.aportes[lote] || { cantidad: "", pesoKg: "" }),
          ...cambios,
        },
      },
    });
  const descripcionLote = (lote: LotePreparacion, seleccionado = false) => {
    const libre = seleccionado
      ? disponibleLotePreparacion(documento, lote, asignacion)
      : lote.disponible_preparacion !== undefined
        ? aMiles(lote.disponible_preparacion)
        : disponibleLotePreparacion(documento, lote);
    return (
      <>
        {libre !== null
          ? t(
              seleccionado
                ? "disponibleAquiLoteTrabajo"
                : "saldoLoteDisponible",
              {
                cantidad: compactarCantidadPreparacion(deMiles(libre)),
                unidad: lote.unidad_abreviatura,
              },
            )
          : t("saldoAlConfirmar")}
        {lote.fecha_vencimiento
          ? " · " +
            t("venceTrabajo", {
              fecha: mostrarFecha(lote.fecha_vencimiento, idioma),
            })
          : ""}
      </>
    );
  };
  return (
    <section
      className="@container/aportes min-w-0 space-y-3"
      aria-label={t("lotesSucursalTrabajo", {
        sucursal: asignacion.sucursalNombre,
      })}
    >
      <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {t("lotesCompactosPanel")}
      </h5>
      {ids.map((lote) => {
        const fuente = fuentes.find((fila) => fila.lote.id === lote);
        if (!fuente) return null;
        const posicion = medidos.indexOf(lote);
        const base =
          prefijo + "_aportes_" + (posicion >= 0 ? posicion : "nuevo_" + lote);
        const aporte = asignacion.aportes[lote] || { cantidad: "", pesoKg: "" };
        const saldoPrevisto = disponibleLotePreparacion(documento, fuente.lote);
        const insuficiencia = insuficienciaLotePreparacion(
          documento,
          asignacion,
          fuente.lote,
        );
        return (
          <div
            key={lote}
            className={
              estilos.lote +
              " " +
              estilos.filaLote +
              " grid grid-cols-[minmax(0,1fr)_2.75rem] gap-x-3 gap-y-2 " +
              (fuente.lote.es_kg
                ? "@sm/aportes:grid-cols-[minmax(0,1fr)_minmax(7rem,9rem)_2.75rem]"
                : "")
            }
          >
            <div
              className={`col-span-2 flex items-start justify-between gap-2 ${fuente.lote.es_kg ? "@sm/aportes:contents" : ""}`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <IconoLote
                    className="size-4 shrink-0 text-gray-500 dark:text-gray-400"
                    aria-hidden="true"
                  />
                  {fuente.lote.nombre}
                </p>
                <p className="mt-1 text-theme-xs leading-5 text-gray-600 dark:text-gray-300">
                  {descripcionLote(fuente.lote, true)}
                </p>
              </div>
            </div>
            <div
              className={
                fuente.lote.es_kg
                  ? "min-w-0 @sm/aportes:col-start-2 @sm/aportes:row-start-1"
                  : "grid min-w-0 grid-cols-1 gap-3 @sm/aportes:grid-cols-2"
              }
            >
              <CampoDirectorio
                id={base + "_cantidad"}
                name={base + "_cantidad"}
                data-entrada-lote={asignacion.clave + ":" + lote}
                etiqueta={t("usasteUnidadTrabajo", {
                  unidad: fuente.lote.unidad_abreviatura,
                })}
                aria-label={t("medicionLoteSucursalTrabajo", {
                  lote: fuente.lote.nombre,
                  sucursal: asignacion.sucursalNombre,
                  unidad: fuente.lote.unidad_abreviatura,
                })}
                className="text-end font-medium tabular-nums"
                value={aporte.cantidad}
                inputMode="decimal"
                pattern="[0-9]{1,11}([.][0-9]{1,3})?"
                maxLength={15}
                placeholder="0"
                disabled={deshabilitado}
                errores={[
                  ...(errores[base + "_cantidad"] || []),
                  ...(errores[base + "_lote"] || []),
                ]}
                onChange={(evento) =>
                  modificar(lote, {
                    cantidad: evento.target.value.replace(",", "."),
                  })
                }
                onBlur={() =>
                  modificar(lote, {
                    cantidad: compactarCantidadPreparacion(aporte.cantidad),
                  })
                }
              />
              {!fuente.lote.es_kg && (
                <CampoDirectorio
                  id={base + "_peso_kg"}
                  name={base + "_peso_kg"}
                  etiqueta={t("pesoMedidoTrabajo")}
                  aria-label={t("medicionLoteSucursalTrabajo", {
                    lote: fuente.lote.nombre,
                    sucursal: asignacion.sucursalNombre,
                    unidad: "kg",
                  })}
                  className="text-end font-medium tabular-nums"
                  value={aporte.pesoKg}
                  inputMode="decimal"
                  pattern="[0-9]{1,11}([.][0-9]{1,3})?"
                  maxLength={15}
                  placeholder="0"
                  disabled={deshabilitado}
                  errores={errores[base + "_peso_kg"]}
                  onChange={(evento) =>
                    modificar(lote, {
                      pesoKg: evento.target.value.replace(",", "."),
                    })
                  }
                  onBlur={() =>
                    modificar(lote, {
                      pesoKg: compactarCantidadPreparacion(aporte.pesoKg),
                    })
                  }
                />
              )}
            </div>
            {!!asignacion.aportes[lote] && (
              <button
                type="button"
                disabled={ocupado}
                aria-label={t("quitarAporteTrabajo", {
                  lote: fuente.lote.nombre,
                })}
                className={
                  estilos.pulsable +
                  " mt-6 flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:hover:bg-error-500/10 dark:hover:text-error-400 " +
                  (fuente.lote.es_kg
                    ? "@sm/aportes:col-start-3 @sm/aportes:row-start-1"
                    : "")
                }
                onClick={() => {
                  const aportes = { ...asignacion.aportes };
                  delete aportes[lote];
                  alCambiar({ ...asignacion, aportes });
                }}
              >
                <IconoQuitar className="size-4" aria-hidden="true" />
              </button>
            )}
            {insuficiencia ? (
              <div className="col-span-full space-y-3 rounded-lg bg-warning-50 p-3 dark:bg-warning-500/10">
                <p
                  role="alert"
                  className="text-theme-xs leading-5 font-medium text-warning-800 dark:text-warning-300"
                >
                  {t("saldoInsuficienteLote", {
                    disponible: insuficiencia.disponible,
                    faltante: insuficiencia.faltante,
                    objetivo: insuficiencia.objetivo,
                    unidad: fuente.lote.unidad_abreviatura,
                  })}
                </p>
                {insuficiencia.otrasCantidadesExcedidas ? (
                  <p className="text-theme-xs text-warning-800 dark:text-warning-300">
                    {t("otrasCantidadesLoteExcedidas")}
                  </p>
                ) : fuente.lote.es_kg && alCambiarDocumento ? (
                  <CompletarLotesPreparacion
                    documento={documento}
                    asignacion={asignacion}
                    origen={fuente.lote}
                    contexto={contexto}
                    almacen={almacen}
                    ocupado={deshabilitado}
                    alError={alError}
                    alAplicar={(nuevo) => {
                      alCambiarDocumento(nuevo);
                      if (typeof requestAnimationFrame === "function")
                        requestAnimationFrame(() =>
                          document
                            .querySelector<HTMLElement>(
                              '[data-entrada-lote^="' +
                                asignacion.clave +
                                ':"]',
                            )
                            ?.focus({ preventScroll: true }),
                        );
                    }}
                  />
                ) : (
                  <p className="text-theme-xs text-warning-800 dark:text-warning-300">
                    {t("completarMedicionManual")}
                  </p>
                )}
              </div>
            ) : (
              saldoPrevisto !== null && (
                <p
                  className={
                    "col-span-full text-theme-xs font-medium tabular-nums " +
                    (saldoPrevisto < BigInt(0)
                      ? "text-error-600 dark:text-error-400"
                      : "text-gray-600 dark:text-gray-300")
                  }
                >
                  {t("saldoPrevistoLotePanel", {
                    cantidad: compactarCantidadPreparacion(
                      deMiles(saldoPrevisto),
                    ),
                    unidad: fuente.lote.unidad_abreviatura,
                  })}
                </p>
              )
            )}
          </div>
        );
      })}
      {ids.length > 1 &&
        totalesKg.map((total) => (
          <p
            key={total.unidad}
            className="text-sm font-semibold text-gray-800 tabular-nums dark:text-gray-100"
          >
            {t("totalAnotadoLotesKg", {
              cantidad: total.cantidad,
              unidad: total.abreviatura,
            })}
          </p>
        ))}
      {!ids.length && (
        <p className="text-theme-xs leading-5 text-gray-600 dark:text-gray-300">
          {t(
            almacen
              ? "elegirLoteSucursalAyuda"
              : "elegirAlmacenMedicionTrabajo",
          )}
        </p>
      )}
      {ids.length < 20 && (
        <DesplegableCompra<LotePreparacion>
          tipo="general"
          agregar
          valor={null}
          ruta={
            "preparaciones/lotes/?" +
            contexto +
            "&almacen=" +
            (almacen || "") +
            "&producto=" +
            asignacion.producto
          }
          etiqueta={t(
            ids.length ? "agregarLoteAdicionalTrabajo" : "elegirLoteTrabajo",
          )}
          datosConsulta={{
            consumos: consumosLotesPreparacion(documento),
            excluir: ids,
          }}
          textoSinOpciones={t("sinLotesSaldoTrabajo")}
          deshabilitado={deshabilitado || !almacen}
          alError={alError}
          descripcion={(lote) => descripcionLote(lote)}
          alElegir={(lote) => {
            if (!lote) return;
            alElegirLote(lote);
            if (typeof requestAnimationFrame === "function")
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>(
                    '[data-entrada-lote="' +
                      asignacion.clave +
                      ":" +
                      lote.id +
                      '"]',
                  )
                  ?.focus({ preventScroll: true }),
              );
          }}
        />
      )}
      {!!errores[prefijo + "_aportes"]?.length && (
        <p
          role="alert"
          tabIndex={-1}
          data-invalido="true"
          className="rounded text-theme-xs text-error-600 dark:text-error-400"
        >
          {errores[prefijo + "_aportes"].join(" ")}
        </p>
      )}
    </section>
  );
}
