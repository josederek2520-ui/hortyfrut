"use client";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { api, ApiError } from "@/lib/api";
import type { Preparacion } from "./tipos";
import RevisionPreparacion from "./RevisionPreparacion";
import { desdePreparacion } from "./calculos";

export default function ConfirmarPreparacion({
  preparacion,
  accion,
  alCerrar,
  alGuardar,
  alRecargar,
  alError,
  mostrarRevision = false,
}: {
  preparacion: Preparacion;
  accion: "confirmar" | "cancelar";
  alCerrar: () => void;
  alGuardar: (preparacion: Preparacion) => void;
  alRecargar: () => void;
  alError: (error: unknown) => void;
  mostrarRevision?: boolean;
}) {
  const t = useTranslations("preparaciones");
  const identificador = useId();
  const [clave] = useState(() => crypto.randomUUID());
  const [motivo, establecerMotivo] = useState("");
  const [ocupado, establecerOcupado] = useState(false);
  const [fallos, establecerFallos] = useState<string[]>([]);
  const [conflicto, establecerConflicto] = useState(false);
  const enviando = useRef(false);
  const registrar = async () => {
    if (
      enviando.current ||
      ocupado ||
      conflicto ||
      (accion === "cancelar" && !motivo.trim())
    )
      return;
    enviando.current = true;
    establecerOcupado(true);
    establecerFallos([]);
    try {
      alGuardar(
        await api<Preparacion>(`preparaciones/${preparacion.id}/${accion}/`, {
          method: "POST",
          body: JSON.stringify({
            version: preparacion.version,
            clave_operacion: clave,
            ...(accion === "cancelar" ? { motivo: motivo.trim() } : {}),
          }),
        }),
      );
    } catch (error) {
      establecerConflicto(error instanceof ApiError && error.status === 409);
      establecerFallos(
        error instanceof ApiError && Object.keys(error.errors).length
          ? Object.entries(error.errors).map(([campo, mensajes]) => {
              const referencia = /^(lineas|asignaciones|cajillas)_(\d+)_/.exec(
                campo,
              );
              return `${referencia ? `${t(referencia[1] === "lineas" ? "loteNumero" : referencia[1] === "asignaciones" ? "asignacionNumero" : "cajillasNumero", { numero: Number(referencia[2]) + 1 })}: ` : ""}${mensajes.join(" ")}`;
            })
          : [
              t(
                error instanceof ApiError && error.status === 409
                  ? "conflicto"
                  : "errorGuardar",
              ),
            ],
      );
      alError(error);
    } finally {
      enviando.current = false;
      establecerOcupado(false);
    }
  };
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      className={mostrarRevision ? "max-w-5xl" : "max-w-xl"}
      labelledBy={identificador}
      closeLabel={t("cerrar")}
    >
      <div className="custom-scrollbar max-h-[90dvh] space-y-5 overflow-y-auto p-6 sm:p-8">
        <h2
          id={identificador}
          className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t(
            accion === "confirmar"
              ? mostrarRevision
                ? "revisarTrabajo"
                : "confirmarPreparacion"
              : "cancelarBorrador",
          )}
        </h2>
        <p className="font-medium text-brand-700 dark:text-brand-300">
          {preparacion.codigo} · {preparacion.cliente_nombre}
        </p>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t(accion === "confirmar" ? "confirmarAyuda" : "cancelarAyuda")}
        </p>
        {accion === "confirmar" && (
          <p className="rounded-xl bg-brand-50 p-3 text-theme-xs leading-5 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
            {t("confirmarCajillasAviso")}
          </p>
        )}
        {accion === "cancelar" && (
          <CampoDirectorio
            id={`${identificador}-motivo`}
            etiqueta={t("motivoCancelacion")}
            value={motivo}
            required
            maxLength={500}
            disabled={ocupado}
            onChange={(evento) => establecerMotivo(evento.target.value)}
          />
        )}
        {!!fallos.length && (
          <ul
            role="alert"
            className="space-y-2 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
          >
            {fallos.map((fallo, indice) => (
              <li key={indice}>{fallo}</li>
            ))}
          </ul>
        )}
        {mostrarRevision && (
          <RevisionPreparacion documento={desdePreparacion(preparacion)} />
        )}
        <div
          className={`flex flex-wrap justify-end gap-3 ${mostrarRevision ? "sticky -bottom-6 border-t border-gray-200 bg-white py-4 sm:-bottom-8 dark:border-gray-800 dark:bg-gray-900" : ""}`}
        >
          <Button variant="outline" disabled={ocupado} onClick={alCerrar}>
            {t(mostrarRevision ? "volverTrabajo" : "volver")}
          </Button>
          {conflicto ? (
            <Button onClick={alRecargar}>{t("recargar")}</Button>
          ) : (
            <Button
              variant={accion === "cancelar" ? "danger" : "primary"}
              disabled={ocupado || (accion === "cancelar" && !motivo.trim())}
              onClick={registrar}
            >
              {t(
                ocupado
                  ? "guardando"
                  : accion === "confirmar"
                    ? "confirmarPreparacion"
                    : "cancelarBorrador",
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
