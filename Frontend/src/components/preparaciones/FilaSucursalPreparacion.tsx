"use client";
import { useTranslations } from "next-intl";
import { RotateCcw as IconoLimpiar, X as IconoQuitar } from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { aportesConMedicion } from "./calculos";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
} from "./tipos";

export const columnasSucursalPreparacion =
  "lg:grid-cols-[minmax(8rem,1.1fr)_6rem_4rem_6rem_minmax(14rem,2fr)_2.5rem]";

export default function FilaSucursalPreparacion({
  asignacion,
  documento,
  contexto,
  almacen,
  indice,
  ocupado,
  errores,
  alCambiar,
  alQuitar,
  alElegirLote,
  alError,
}: {
  asignacion: AsignacionEditable;
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  indice: number;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (asignacion: AsignacionEditable) => void;
  alQuitar: () => void;
  alElegirLote: (lote: LotePreparacion) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const prefijo = indice >= 0 ? `asignaciones_${indice}` : `asignaciones_nueva_${asignacion.clave}`;
  const fuentes = documento.lineas.filter(
    (linea) => linea.lote.producto === asignacion.producto,
  );
  const ids = [
    ...new Set([
      ...Object.keys(asignacion.aportes).map(Number),
      ...(fuentes.length === 1 ? [fuentes[0].lote.id] : []),
    ]),
  ];
  const aportesMedidos = aportesConMedicion(asignacion, documento).map(
    ([lote]) => Number(lote),
  );
  const deshabilitado =
    ocupado || !asignacion.detalle || !asignacion.disponible;
  const modificarAporte = (
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
  return (
    <article
      role="row"
      className={`grid grid-cols-2 items-start gap-4 border-t border-gray-100 p-4 focus-within:bg-orange-25 lg:gap-3 dark:border-gray-800 dark:focus-within:bg-orange-500/5 ${columnasSucursalPreparacion}`}
    >
      <div role="cell" className="col-span-2 lg:col-span-1">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {asignacion.sucursalNombre}
        </h4>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {asignacion.codigo}
        </p>
        {["detalle_pedido", "pedido"].map((campo) =>
          errores[`${prefijo}_${campo}`]?.length ? (
            <p
              key={campo}
              role="alert"
              tabIndex={-1}
              data-invalido="true"
              className="mt-1 rounded text-theme-xs text-error-600 dark:text-error-400"
            >
              {errores[`${prefijo}_${campo}`].join(" ")}
            </p>
          ) : null,
        )}
        {!asignacion.disponible && (
          <p className="mt-2 text-theme-xs text-warning-600 dark:text-warning-400">
            {t("pedidoNoDisponibleTrabajo")}
          </p>
        )}
      </div>
      <div role="cell">
        <p className="inline-flex rounded-lg bg-gray-100 px-2 py-1 text-theme-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {t(
            asignacion.columna === "cajas"
              ? "cajasCantTrabajo"
              : "unidadesUniTrabajo",
          )}
        </p>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {asignacion.presentacion}
        </p>
      </div>
      <div role="cell">
        <span className="text-theme-xs text-gray-500 lg:sr-only dark:text-gray-400">
          {t("faltaPrepararTrabajo")}
        </span>
        <p className="mt-1 text-sm font-medium text-gray-700 tabular-nums dark:text-gray-200">
          {asignacion.pendiente}
        </p>
      </div>
      <div role="cell" className="min-w-0 lg:[&_label]:sr-only">
        <CampoDirectorio
          id={`${prefijo}_cantidad`}
          name={`${prefijo}_cantidad`}
          etiqueta={t("prepararAhoraTrabajo")}
          value={asignacion.cantidad}
          inputMode="numeric"
          pattern="[0-9]{1,6}"
          maxLength={6}
          placeholder="0"
          disabled={deshabilitado}
          errores={errores[`${prefijo}_cantidad`]}
          onChange={(evento) =>
            alCambiar({ ...asignacion, cantidad: evento.target.value })
          }
        />
        {!!asignacion.cantidad && /^\d+$/.test(asignacion.cantidad) && Number(asignacion.cantidad) <= asignacion.pendiente &&
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{t("quedaPorPrepararTrabajo", { cantidad: asignacion.pendiente - Number(asignacion.cantidad) })}</p>}
      </div>
      <div role="cell" className="col-span-2 min-w-0 space-y-3 lg:col-span-1">
        <span className="block text-theme-xs font-medium text-gray-600 lg:sr-only dark:text-gray-300">
          {t("cantidadRealUsadaTrabajo")}
        </span>
        {ids.map((lote) => {
          const fuente = fuentes.find((fila) => fila.lote.id === lote);
          if (!fuente) return null;
          const posicion = aportesMedidos.indexOf(lote);
          const base = `${prefijo}_aportes_${posicion >= 0 ? posicion : `nuevo_${lote}`}`;
          const aporte = asignacion.aportes[lote] || {
            cantidad: "",
            pesoKg: "",
          };
          return (
            <div
              key={lote}
              className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-theme-xs font-medium text-gray-600 dark:text-gray-300">
                  {fuente.lote.nombre}
                </p>
                {!!asignacion.aportes[lote] && (
                  <button
                    type="button"
                    disabled={ocupado}
                    aria-label={t("quitarAporteTrabajo", {
                      lote: fuente.lote.nombre,
                    })}
                    onClick={() => {
                      const aportes = { ...asignacion.aportes };
                      delete aportes[lote];
                      alCambiar({ ...asignacion, aportes });
                    }}
                    className="flex size-7 items-center justify-center rounded-lg text-gray-400 hover:text-error-500 focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    <IconoQuitar className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div
                className={`grid gap-3 ${fuente.lote.es_kg ? "" : "sm:grid-cols-2"}`}
              >
                <CampoDirectorio
                  id={`${base}_cantidad`}
                  name={`${base}_cantidad`}
                  etiqueta={t("usasteUnidadTrabajo", {
                    unidad: fuente.lote.unidad_abreviatura,
                  })}
                  value={aporte.cantidad}
                  inputMode="decimal"
                  pattern="[0-9]{1,11}([.][0-9]{1,3})?"
                  maxLength={15}
                  placeholder="0"
                  disabled={deshabilitado}
                  errores={[
                    ...(errores[`${base}_cantidad`] || []),
                    ...(errores[`${base}_lote`] || []),
                  ]}
                  onChange={(evento) =>
                    modificarAporte(lote, {
                      cantidad: evento.target.value.replace(",", "."),
                    })
                  }
                />
                {!fuente.lote.es_kg && (
                  <CampoDirectorio
                    id={`${base}_peso_kg`}
                    name={`${base}_peso_kg`}
                    etiqueta={t("pesoMedidoTrabajo")}
                    value={aporte.pesoKg}
                    inputMode="decimal"
                    pattern="[0-9]{1,11}([.][0-9]{1,3})?"
                    maxLength={15}
                    placeholder="0"
                    disabled={deshabilitado}
                    errores={errores[`${base}_peso_kg`]}
                    onChange={(evento) =>
                      modificarAporte(lote, {
                        pesoKg: evento.target.value.replace(",", "."),
                      })
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
        {!ids.length && (
          <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("elegirLoteSucursalAyuda")}
          </p>
        )}
        {ids.length < 20 && (
          <DesplegableCompra<LotePreparacion>
            tipo="general"
            agregar
            valor={null}
            ruta={`preparaciones/lotes/?${contexto}&almacen=${almacen || ""}&producto=${asignacion.producto}`}
            etiqueta={t(ids.length ? "otroLoteTrabajo" : "elegirLoteTrabajo")}
            deshabilitado={deshabilitado || !almacen}
            alError={alError}
            descripcion={(lote) =>
              t("saldoLoteDisponible", {
                cantidad: lote.saldo || "0",
                unidad: lote.unidad_abreviatura,
              })
            }
            alElegir={(lote) => {
              if (lote) alElegirLote(lote);
            }}
          />
        )}
        {!!errores[`${prefijo}_aportes`]?.length && (
          <p
            role="alert"
            tabIndex={-1}
            data-invalido="true"
            className="rounded text-theme-xs text-error-600 dark:text-error-400"
          >
            {errores[`${prefijo}_aportes`].join(" ")}
          </p>
        )}
      </div>
      <div role="cell" className="col-span-2 flex justify-end lg:col-span-1">
        <button
          type="button"
          disabled={ocupado || indice < 0}
          aria-label={t("borrarSucursalTrabajo", {
            sucursal: asignacion.sucursalNombre,
          })}
          onClick={alQuitar}
          className="flex size-9 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 disabled:opacity-30 dark:hover:bg-error-500/10"
        >
          <IconoLimpiar className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
