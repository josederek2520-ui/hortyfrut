"use client";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import CampoFecha from "@/components/form/CampoFecha";
import EstadoEntrega from "./EstadoEntrega";
import ErrorCampoEntrega from "./ErrorCampoEntrega";
import { panelEntrega, entradaEntrega, type HojaEntrega } from "./tipos";

export default function CabeceraRecepcionEntrega({
  hoja,
  fecha,
  recibidoPor,
  editable,
  bloqueado,
  ocupado,
  errores,
  volver,
  alFecha,
  registradoPor,
}: {
  hoja: HojaEntrega;
  fecha: string;
  recibidoPor: string;
  editable: boolean;
  bloqueado: boolean;
  ocupado: boolean;
  errores: Record<string, string[]>;
  volver: () => void;
  alFecha: (valor: string) => void;
  registradoPor?: string;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  const confirmada = hoja.estado === "confirmada";
  const mostrarFecha = (valor: string | null, hora = false) =>
    valor
      ? new Date(hora ? valor : valor + "T12:00:00").toLocaleString(
          idioma,
          hora
            ? { dateStyle: "medium", timeStyle: "short" }
            : { dateStyle: "medium" },
        )
      : "—";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label={t("volver")}
          className="control-suave-hortyfru inline-flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
          disabled={ocupado}
          onClick={volver}
        >
          <ArrowLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
        </button>
        <h1 className="text-xl font-semibold md:text-2xl">
          {t(
            confirmada
              ? "consultaEntrega"
              : hoja.estado === "revision"
                ? "recepcionEnRevision"
                : "registrarRecepcion",
          )}
        </h1>
        <EstadoEntrega estado={hoja.estado} />
        {hoja.codigo && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {hoja.codigo}
          </span>
        )}
      </div>
      {confirmada && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
          <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("confirmadaSoloConsulta")}</p>
            <p className="mt-1">
              {t("confirmadaPor", { nombre: hoja.confirmado_por_nombre })} ·{" "}
              {mostrarFecha(hoja.confirmado_en, true)}
            </p>
          </div>
        </div>
      )}
      <div className={panelEntrega + " p-5"}>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {t("sucursal")}
            </dt>
            <dd className="mt-1 font-semibold">
              {hoja.origen.sucursal_nombre}
              <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                {hoja.origen.cliente_nombre}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {t("pedido")}
            </dt>
            <dd className="mt-1 font-semibold">
              {hoja.origen.codigo_pedido}
              <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                {t("despacho")}: {hoja.origen.codigo_despacho}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {t("fechaDescarga")}
            </dt>
            <dd className="mt-1 font-medium">
              {mostrarFecha(hoja.origen.descargada_en, true)}
            </dd>
          </div>
        </dl>
        {editable ? (
          <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-3 dark:border-gray-800">
            <div>
              <label
                htmlFor="entrega-fecha-recepcion"
                className="mb-1.5 block text-sm font-medium"
              >
                {t("fechaRecepcion")}
              </label>
              <CampoFecha
                id="entrega-fecha-recepcion"
                data-campo-entrega="fecha_recepcion"
                value={fecha}
                min={hoja.fecha_minima}
                max={hoja.fecha_maxima}
                disabled={bloqueado}
                error={!!errores.fecha_recepcion}
                aria-describedby={
                  errores.fecha_recepcion ? "error-fecha-recepcion" : undefined
                }
                alCambiar={alFecha}
              />
              <ErrorCampoEntrega
                mensajes={errores.fecha_recepcion}
                id="error-fecha-recepcion"
              />
            </div>
            <div>
              <label
                htmlFor="entrega-recibido-por"
                className="mb-1.5 block text-sm font-medium"
              >
                {t("recibidoPor")}
              </label>
              <input
                id="entrega-recibido-por"
                data-campo-entrega="recibido_por"
                className={
                  entradaEntrega +
                  (errores.recibido_por ? " border-error-500" : "")
                }
                value={recibidoPor}
                readOnly
                aria-readonly="true"
                maxLength={200}
                disabled={bloqueado}
                aria-invalid={!!errores.recibido_por}
                aria-describedby={
                  errores.recibido_por ? "error-recibido-por" : undefined
                }
                placeholder={t("sinEncargadoPedidos")}
              />
              <p
                className={`mt-2 text-xs leading-5 ${recibidoPor ? "text-gray-600 dark:text-gray-300" : "text-warning-800 dark:text-warning-300"}`}
              >
                {t(
                  !recibidoPor
                    ? "asignarEncargadoPedidos"
                    : hoja.id &&
                        !hoja.recibido_por_usuario &&
                        !hoja.receptor_por_registrar
                      ? "receptorHistorico"
                      : "receptorAutomatico",
                )}
              </p>
              <ErrorCampoEntrega
                mensajes={errores.recibido_por}
                id="error-recibido-por"
              />
            </div>
            <div>
              <p className="text-sm font-medium">{t("registradoPor")}</p>
              <p className="mt-2 text-sm font-semibold">
                {hoja.responsable_nombre || registradoPor || "—"}
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                {t("responsableRegistroAyuda")}
              </p>
            </div>
          </div>
        ) : (
          <dl className="mt-5 grid gap-4 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3 dark:border-gray-800">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("fechaRecepcion")}
              </dt>
              <dd className="mt-1 font-medium">{mostrarFecha(fecha)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("recibidoPor")}
              </dt>
              <dd className="mt-1 font-medium">{recibidoPor || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t("registradoPor")}
              </dt>
              <dd className="mt-1 font-medium">
                {hoja.responsable_nombre || "—"}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </>
  );
}
