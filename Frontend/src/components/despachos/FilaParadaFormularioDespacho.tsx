"use client";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 as IconoQuitar, Store as IconoSucursal } from "lucide-react";
import Selector from "@/components/compras/SelectorCompra";
import ColorCajilla from "@/components/cajillas/ColorCajilla";
import {
  claseAccion,
  claseEntrada,
  type OpcionLogistica,
} from "@/components/logistica/tipos";
import CargaDetalle from "./CargaDetalleDespacho";
import { pesoCargaDespacho } from "./seleccionDestinosDespacho";
import type { CargaPreparada, CajillaCarga } from "./tipos";

export default function FilaParadaFormularioDespacho({
  sucursal,
  cargas,
  cajillas,
  almacen,
  deshabilitado,
  revision,
  automaticas,
  alCajillas,
  alError,
}: {
  sucursal: number;
  cargas: CargaPreparada[];
  cajillas: CajillaCarga[];
  almacen: number;
  deshabilitado: boolean;
  revision: boolean;
  automaticas: boolean;
  alCajillas: (filas: CajillaCarga[]) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  const idioma = useLocale();
  const numero = new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 });
  const filas = cargas.filter((fila) => fila.sucursal === sucursal);
  const destino = filas[0];
  if (!destino) return null;
  const recipientes = cajillas.filter((fila) => fila.sucursal === sucursal);
  const soloLectura = revision || automaticas;
  const agregarColor = (opcion: OpcionLogistica | null) => {
    if (opcion && !recipientes.some((fila) => fila.cajilla === opcion.id))
      alCajillas([
        ...cajillas,
        { sucursal, cajilla: opcion.id, color: opcion.nombre, cantidad: 0 },
      ]);
  };
  const cantidades = [
    ...(["cajas", "unidades"] as const).flatMap((columna) => {
      const cantidad = filas
        .filter((fila) => fila.columna === columna)
        .reduce((suma, fila) => suma + fila.cantidad, 0);
      return cantidad
        ? [
            t(columna === "cajas" ? "cajasCargaValor" : "unidadesCargaValor", {
              cantidad,
            }),
          ]
        : [];
    }),
    numero.format(Number(pesoCargaDespacho(filas))) + " kg",
  ];
  return (
    <div role="rowgroup">
      <div
        role="row"
        className="grid items-start gap-x-5 gap-y-3 px-4 py-3 @2xl/destinos:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,1.2fr)]"
      >
        <div role="cell" className="flex min-w-0 items-start gap-3">
          <IconoSucursal
            className="mt-0.5 size-5 shrink-0 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold break-words text-gray-900 dark:text-white">
              {destino.cliente_nombre} · {destino.sucursal_nombre}
            </h3>
            <p className="mt-1 text-theme-xs leading-5 break-words text-gray-500 dark:text-gray-400">
              {destino.direccion || t("direccionGuardada")}
            </p>
          </div>
        </div>
        <div
          role="cell"
          className="min-w-0 text-sm text-gray-700 tabular-nums dark:text-gray-200"
        >
          <span className="mb-1 block text-theme-xs text-gray-500 @2xl/destinos:sr-only dark:text-gray-400">
            {t("carga")}
          </span>
          {cantidades.join(" · ")}
        </div>
        <div role="cell" className="min-w-0 space-y-2">
          <span className="block text-theme-xs text-gray-500 @2xl/destinos:sr-only dark:text-gray-400">
            {t("cajillasPrevistasTransporte")}
          </span>
          {!recipientes.length && (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("sinCajillas")}
            </p>
          )}
          <div className={soloLectura ? "flex flex-wrap gap-2" : "space-y-2"}>
            {recipientes.map((fila) => (
              <div
                key={fila.cajilla}
                className={
                  soloLectura
                    ? "inline-flex max-w-full items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-theme-xs dark:bg-gray-800/60"
                    : "flex min-w-0 items-center gap-2"
                }
              >
                {soloLectura ? (
                  <ColorCajilla color={fila.color} punto />
                ) : (
                  <label
                    className="min-w-0 flex-1 text-sm"
                    htmlFor={`cajilla-${sucursal}-${fila.cajilla}`}
                  >
                    <ColorCajilla color={fila.color} punto />
                  </label>
                )}
                {soloLectura ? (
                  <span className="shrink-0 font-medium text-gray-700 tabular-nums dark:text-gray-200">
                    × {numero.format(fila.cantidad)}
                  </span>
                ) : (
                  <>
                    <input
                      id={`cajilla-${sucursal}-${fila.cajilla}`}
                      type="number"
                      min={1}
                      max={2147483647}
                      step={1}
                      value={fila.cantidad || ""}
                      placeholder="0"
                      disabled={deshabilitado}
                      className={`${claseEntrada} max-w-20 text-end tabular-nums`}
                      onChange={(evento) =>
                        alCajillas(
                          cajillas.map((actual) =>
                            actual.sucursal === sucursal &&
                            actual.cajilla === fila.cajilla
                              ? {
                                  ...actual,
                                  cantidad: Number(evento.target.value),
                                }
                              : actual,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={comun("quitar")}
                      className={claseAccion}
                      disabled={deshabilitado}
                      onClick={() =>
                        alCajillas(cajillas.filter((actual) => actual !== fila))
                      }
                    >
                      <IconoQuitar className="size-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {!revision && !automaticas && (
            <Selector<OpcionLogistica>
              ruta={`despachos/cajillas/?almacen=${almacen}`}
              etiqueta={t("agregarColor")}
              valor={null}
              agregar
              alElegir={agregarColor}
              alError={alError}
              deshabilitado={deshabilitado}
              descripcion={(opcion) =>
                t("disponibleColor", { cantidad: opcion.disponible ?? 0 })
              }
              estaDisponible={(opcion) =>
                !recipientes.some((fila) => fila.cajilla === opcion.id)
              }
            />
          )}
        </div>
      </div>
      {revision && (
        <div role="row">
          <div role="cell" aria-colspan={3} className="px-4 pb-3">
            <details>
              <summary className="min-h-11 cursor-pointer rounded-lg py-2 text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300">
                {t("verProductosDestino")}
              </summary>
              <CargaDetalle cargas={filas} />
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
