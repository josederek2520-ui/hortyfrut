"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import { clasePanel } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import type { Session as Sesion } from "@/components/users/types";
import { claseEnlaceInventario, type Lote } from "./tipos";

export default function DetalleLote({
  lote,
  sesion,
  alGuardar,
  alError,
  alRecargar,
}: {
  lote: Lote;
  sesion: Sesion;
  alGuardar: (lote: Lote) => void;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("inventario");
  const idioma = useLocale();
  const identificador = useId();
  const modal = useModal();
  const [ocupado, establecerOcupado] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const cambiar = async () => {
    if (ocupado || conflicto) return;
    establecerOcupado(true);
    establecerFallo("");
    try {
      alGuardar(
        await api<Lote>(`inventario/lotes/${lote.id}/estado/`, {
          method: "POST",
          body: JSON.stringify({
            estado: lote.estado === "bloqueado" ? "disponible" : "bloqueado",
            version: lote.version,
          }),
        }),
      );
      modal.closeModal();
    } catch (error) {
      establecerConflicto(error instanceof ApiError && error.status === 409);
      establecerFallo(
        error instanceof ApiError && Object.keys(error.errors).length
          ? Object.values(error.errors).flat().join(" ")
          : t(
              error instanceof ApiError && error.status === 409
                ? "conflicto"
                : "errorCarga",
            ),
      );
      alError(error);
    } finally {
      establecerOcupado(false);
    }
  };
  const numero = (valor: string) =>
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(valor),
    );
  return (
    <section className={`${clasePanel} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {lote.codigo}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {lote.producto_nombre}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {lote.almacen_nombre}
          </p>
        </div>
        {sesion.permisos_inventario?.cambiar_estado_lotes && (
          <Button
            variant="outline"
            size="sm"
            disabled={
              (lote.vencido || lote.calidad === "aprovechable") &&
              lote.estado === "bloqueado"
            }
            onClick={() => {
              establecerFallo("");
              establecerConflicto(false);
              modal.openModal();
            }}
          >
            {t(
              lote.estado === "bloqueado" ? "desbloquearLote" : "bloquearLote",
            )}
          </Button>
        )}
      </div>
      <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/70 p-5 dark:border-brand-900 dark:bg-brand-500/10">
        <p className="text-sm text-brand-800 dark:text-brand-200">
          {t("saldoFisico")}
        </p>
        <p className="mt-2 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
          {numero(lote.saldo)}{" "}
          <span className="text-lg font-medium">{lote.unidad_abreviatura}</span>
        </p>
        <p className="mt-3 text-sm text-brand-800 dark:text-brand-200">
          {t(
            lote.vencido
              ? "vencidoAyuda"
              : lote.estado === "bloqueado"
                ? "bloqueadoAyuda"
                : lote.disponible
                  ? "disponibleAyuda"
                  : "noDisponibleAyuda",
          )}
        </p>
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["unidad", lote.unidad_nombre],
          ["fechaIngreso", mostrarFecha(lote.fecha_ingreso, idioma)],
          [
            "vencimiento",
            lote.fecha_vencimiento
              ? mostrarFecha(lote.fecha_vencimiento, idioma)
              : "—",
          ],
          [
            "pesoIngreso",
            lote.peso_kg_ingreso ? `${numero(lote.peso_kg_ingreso)} kg` : "—",
          ],
          [
            "estado",
            t(
              lote.vencido
                ? "vencido"
                : lote.calidad === "aprovechable"
                  ? "aprovechableAyuda"
                  : lote.estado === "bloqueado"
                    ? "bloqueado"
                    : lote.disponible
                      ? "disponible"
                      : "noDisponible",
            ),
          ],
          [
            "creadoEn",
            new Intl.DateTimeFormat(idioma, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/La_Paz",
            }).format(new Date(lote.creado_en)),
          ],
        ].map(([clave, valor]) => (
          <div key={clave}>
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t(clave)}
            </dt>
            <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
              {valor}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        {lote.preparacion &&
          (sesion.permisos_preparaciones?.ver ? (
            <Link
              href={`/preparaciones/${lote.preparacion.id}`}
              className={claseEnlaceInventario}
            >
              {lote.preparacion.codigo}
            </Link>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("origen")}: {lote.preparacion.codigo}
            </p>
          ))}
        {lote.lote_origen && (
          <Link
            href={`/lotes/${lote.lote_origen}`}
            className={claseEnlaceInventario}
          >
            {t("verLoteOrigen")}
          </Link>
        )}
        {lote.recepcion &&
          (sesion.permisos_recepciones?.ver ? (
            <Link
              className={claseEnlaceInventario}
              href={`/recepciones/${lote.recepcion.id}`}
            >
              {lote.recepcion.codigo}
            </Link>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("origen")}: {lote.recepcion.codigo}
            </p>
          ))}
        {sesion.permisos_productos?.ver && (
          <Link
            href={`/productos/${lote.producto}`}
            className={claseEnlaceInventario}
          >
            {t("verProducto")}
          </Link>
        )}
      </div>
      <Modal
        isOpen={modal.isOpen}
        onClose={() => {
          if (!ocupado) modal.closeModal();
        }}
        className="max-w-lg"
        labelledBy={identificador}
        closeLabel={t("cerrar")}
      >
        <div className="space-y-5 p-6">
          <h2
            id={identificador}
            className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t(
              lote.estado === "bloqueado" ? "desbloquearLote" : "bloquearLote",
            )}
          </h2>
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t("bloqueoAyuda")}
          </p>
          {fallo && (
            <p
              role="alert"
              className="text-sm text-error-500 dark:text-error-400"
            >
              {fallo}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={ocupado}
              onClick={modal.closeModal}
            >
              {t("cerrar")}
            </Button>
            {conflicto ? (
              <Button
                onClick={() => {
                  modal.closeModal();
                  alRecargar();
                }}
              >
                {t("recargar")}
              </Button>
            ) : (
              <Button disabled={ocupado} onClick={cambiar}>
                {t(ocupado ? "guardando" : "confirmar")}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
