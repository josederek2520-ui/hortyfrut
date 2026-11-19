"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CampoFecha from "@/components/form/CampoFecha";
import { hoyBolivia, mostrarFechaVenta } from "./calculosVenta";
import type { FormularioVenta, Venta } from "./tipos";
import PeriodoRecepcionVenta from "./PeriodoRecepcionVenta";
import CampoSupermercadoVenta from "./CampoSupermercadoVenta";

export default function ContextoVenta({
  formulario,
  documento,
  revision,
  editable,
  bloqueado,
  alCambiar,
  alElegirCliente,
}: {
  formulario: FormularioVenta;
  documento: Venta | null;
  revision: boolean;
  editable: boolean;
  bloqueado: boolean;
  alCambiar: (cambios: Partial<FormularioVenta>) => void;
  alElegirCliente: () => void;
}) {
  const t = useTranslations("ventas"),
    idioma = useLocale();
  const [variosDias, establecerVariosDias] = useState(
    formulario.desde !== formulario.hasta,
  );
  const mostrarVariosDias = variosDias || formulario.desde !== formulario.hasta;
  const cambiarModo = (varios: boolean) => {
    if (bloqueado || !editable) return;
    establecerVariosDias(varios);
    if (!varios && formulario.desde !== formulario.hasta)
      alCambiar({ desde: formulario.desde, hasta: formulario.desde });
  };
  const fueraPeriodo = formulario.entregas.some(
    (fila) =>
      fila.fecha_recepcion < formulario.desde ||
      fila.fecha_recepcion > formulario.hasta,
  );
  const supermercado = (
    <CampoSupermercadoVenta
      cliente={formulario.cliente}
      editable={editable && !documento && !revision}
      bloqueado={bloqueado}
      alElegir={alElegirCliente}
    />
  );
  return (
    <div className="border-b border-gray-100 p-5 dark:border-gray-800">
      {revision ? (
        <>
          {supermercado}
          <div className="mt-5 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <dl className="text-sm">
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("fechaRecepcionEntregas")}
              </dt>
              <dd className="mt-1">
                {mostrarFechaVenta(formulario.desde, idioma)}
                {formulario.desde !== formulario.hasta && (
                  <> — {mostrarFechaVenta(formulario.hasta, idioma)}</>
                )}
              </dd>
            </dl>
            {editable ? (
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium"
                  htmlFor="venta-vencimiento"
                >
                  {t("vencimientoOpcional")}
                </label>
                <CampoFecha
                  id="venta-vencimiento"
                  value={formulario.vencimiento}
                  min={hoyBolivia()}
                  disabled={bloqueado}
                  alCambiar={(vencimiento) => alCambiar({ vencimiento })}
                />
              </div>
            ) : (
              <dl className="text-sm">
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {t("vencimiento")}
                </dt>
                <dd className="mt-1">
                  {formulario.vencimiento
                    ? mostrarFechaVenta(formulario.vencimiento, idioma)
                    : t("sinVencimiento")}
                </dd>
              </dl>
            )}
            {documento?.fecha_emision && (
              <dl className="text-sm">
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {t("fechaEmision")}
                </dt>
                <dd className="mt-1">
                  {mostrarFechaVenta(documento.fecha_emision, idioma)}
                </dd>
              </dl>
            )}
          </div>
        </>
      ) : (
        <>
          <PeriodoRecepcionVenta
            supermercado={supermercado}
            desde={formulario.desde}
            hasta={formulario.hasta}
            variosDias={mostrarVariosDias}
            bloqueado={bloqueado || !editable}
            alModo={cambiarModo}
            alCambiar={alCambiar}
          />
          {fueraPeriodo && (
            <p
              role="alert"
              className="mt-3 text-sm text-orange-700 dark:text-orange-300"
            >
              {t("fueraPeriodo")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
