"use client";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link } from "@/i18n/navigation";
import CampoFecha from "@/components/form/CampoFecha";
import EstadoDevolucion from "./EstadoDevolucion";
import SelectorDevolucion from "./SelectorDevolucion";
import ErrorDevolucion from "./ErrorDevolucion";
import { panelDevolucion, entradaDevolucion } from "./tipos";
import type useGestionDevolucion from "./useGestionDevolucion";

export default function CabeceraDevolucion({
  gestion,
  editarRecepcion,
  editarRevision,
  fechaMaxima,
  verEntrega,
  alVolver,
  alEntrega,
}: {
  gestion: ReturnType<typeof useGestionDevolucion>;
  editarRecepcion: boolean;
  editarRevision: boolean;
  fechaMaxima?: string;
  verEntrega: boolean;
  alVolver: () => void;
  alEntrega: (identificador: number) => void;
}) {
  const t = useTranslations("devoluciones"),
    idioma = useLocale();
  const { documento, origen, errores, ocupado, incierto } = gestion;
  const bloqueado = ocupado || incierto;
  const titulo =
    documento?.estado === "recibida"
      ? "revisarCalidad"
      : documento
        ? "detalle"
        : "nueva";
  const fecha = (valor: string | null) =>
    valor ? new Date(valor + "T12:00:00").toLocaleDateString(idioma) : "—";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={ocupado}
          onClick={alVolver}
          aria-label={t("volver")}
          className="control-suave-hortyfru inline-flex size-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold md:text-2xl">{t(titulo)}</h1>
        {documento && (
          <>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {documento.codigo}
            </span>
            <EstadoDevolucion estado={documento.estado} />
          </>
        )}
      </div>
      <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
        {t("reglaCalidad")}
      </p>
      <div className={panelDevolucion + " space-y-4 p-5"}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium">{t("entregaOrigen")}</p>
            {!documento ? (
              <SelectorDevolucion
                tipo="entrega"
                valor={
                  gestion.entrega
                    ? {
                        id: gestion.entrega,
                        nombre: origen
                          ? origen.codigo + " · " + origen.sucursal_nombre
                          : "ENT-" + String(gestion.entrega).padStart(6, "0"),
                      }
                    : null
                }
                bloqueado={bloqueado || !editarRecepcion}
                alElegir={(opcion) => alEntrega(opcion.id)}
              />
            ) : (
              <p className="text-sm font-semibold">
                {documento.codigo_entrega} · {documento.sucursal_nombre}
              </p>
            )}
            <ErrorDevolucion
              mensajes={errores.entrega}
              id="error-entrega-devolucion"
            />
            {origen && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {origen.cliente_nombre} · {origen.codigo_pedido}
                {verEntrega && (
                  <Link
                    className="ms-3 inline-block rounded font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                    href={"/entregas/" + origen.despacho + "/" + origen.pedido}
                  >
                    {t("verEntrega")}
                  </Link>
                )}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">{t("almacenReceptor")}</p>
            {editarRecepcion ? (
              <SelectorDevolucion
                tipo="almacen"
                valor={gestion.almacen}
                bloqueado={bloqueado}
                alElegir={gestion.cambiarAlmacen}
              />
            ) : (
              <p className="text-sm font-semibold">
                {gestion.almacen?.nombre || "—"}
              </p>
            )}
            <ErrorDevolucion
              mensajes={errores.almacen}
              id="error-almacen-devolucion"
            />
          </div>
        </div>
        <div className="grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-3 dark:border-gray-800">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              htmlFor={editarRecepcion ? "fecha-devolucion" : undefined}
            >
              {t("fechaRetorno")}
            </label>
            {editarRecepcion ? (
              <CampoFecha
                id="fecha-devolucion"
                data-campo-devolucion="fecha_recepcion"
                value={gestion.fecha}
                min={origen?.fecha_minima}
                max={fechaMaxima}
                disabled={bloqueado}
                error={!!errores.fecha_recepcion}
                aria-describedby={
                  errores.fecha_recepcion ? "error-fecha-devolucion" : undefined
                }
                alCambiar={gestion.cambiarFecha}
              />
            ) : (
              <p className="text-sm">{fecha(gestion.fecha)}</p>
            )}
            <ErrorDevolucion
              mensajes={errores.fecha_recepcion}
              id="error-fecha-devolucion"
            />
          </div>
          <div className="md:col-span-2">
            <label
              className="mb-1.5 block text-sm font-medium"
              htmlFor={editarRecepcion ? "motivo-devolucion" : undefined}
            >
              {t("motivoRetorno")}
            </label>
            {editarRecepcion ? (
              <textarea
                id="motivo-devolucion"
                data-campo-devolucion="motivo"
                value={gestion.motivo}
                maxLength={500}
                disabled={bloqueado}
                aria-invalid={!!errores.motivo}
                aria-describedby={
                  errores.motivo ? "error-motivo-devolucion" : undefined
                }
                className={
                  entradaDevolucion +
                  " min-h-20 " +
                  (errores.motivo ? "border-error-500" : "")
                }
                onChange={(evento) =>
                  gestion.cambiarMotivo(evento.target.value)
                }
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {gestion.motivo || "—"}
              </p>
            )}
            <ErrorDevolucion
              mensajes={errores.motivo}
              id="error-motivo-devolucion"
            />
          </div>
        </div>
        {(editarRevision || documento?.motivo_revision) && (
          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <label
              className="mb-1.5 block text-sm font-medium"
              htmlFor={
                editarRevision ? "motivo-revision-devolucion" : undefined
              }
            >
              {t("motivoRevision")}
            </label>
            {editarRevision ? (
              <textarea
                id="motivo-revision-devolucion"
                data-campo-devolucion="motivo_revision"
                className={
                  entradaDevolucion +
                  " min-h-20 " +
                  (errores.motivo_revision ? "border-error-500" : "")
                }
                value={gestion.motivoRevision}
                maxLength={500}
                disabled={bloqueado}
                aria-invalid={!!errores.motivo_revision}
                aria-describedby={
                  errores.motivo_revision ? "error-motivo-revision" : undefined
                }
                onChange={(evento) =>
                  gestion.cambiarMotivoRevision(evento.target.value)
                }
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {gestion.motivoRevision}
              </p>
            )}
            <ErrorDevolucion
              mensajes={errores.motivo_revision}
              id="error-motivo-revision"
            />
          </div>
        )}
        {documento?.revisado_en && (
          <p className="flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
            <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
            {t("revisadaPor", {
              nombre: documento.revisado_por_nombre,
              fecha: new Date(documento.revisado_en).toLocaleString(idioma),
            })}
          </p>
        )}
        {documento?.recibido_en && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("recibidaPor", {
              nombre: documento.recibido_por_nombre,
              fecha: new Date(documento.recibido_en).toLocaleString(idioma),
            })}
          </p>
        )}
      </div>
    </>
  );
}
