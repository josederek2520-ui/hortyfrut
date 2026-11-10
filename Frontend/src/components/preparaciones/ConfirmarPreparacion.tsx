"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { api, ApiError } from "@/lib/api";
import type { Preparacion } from "./tipos";
import RevisionPreparacion, {
  ResumenRevisionPreparacion,
} from "./RevisionPreparacion";
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
  const listaFallos = useRef<HTMLUListElement>(null);
  const documento = desdePreparacion(preparacion);
  const esRevision = mostrarRevision && accion === "confirmar";
  useEffect(() => {
    if (!fallos.length) return;
    listaFallos.current?.focus({ preventScroll: true });
    listaFallos.current?.scrollIntoView({
      block: "nearest",
      behavior: "instant",
    });
  }, [fallos.length]);
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
      className={
        esRevision ? "max-w-5xl overflow-hidden" : "max-w-xl overflow-hidden"
      }
      labelledBy={identificador}
      closeLabel={t("cerrar")}
    >
      <div className="flex max-h-[90dvh] flex-col" aria-busy={ocupado}>
        <header className="shrink-0 space-y-2 border-b border-gray-100 px-5 pt-5 pb-4 sm:px-6 dark:border-gray-800">
          <h2
            id={identificador}
            data-foco-inicial
            tabIndex={-1}
            className="rounded pe-10 text-xl font-semibold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white"
          >
            {t(
              accion === "confirmar"
                ? esRevision
                  ? "revisarTrabajo"
                  : "confirmarPreparacion"
                : "cancelarBorrador",
            )}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {preparacion.codigo} · {preparacion.cliente_nombre}
          </p>
          {esRevision && <ResumenRevisionPreparacion documento={documento} />}
        </header>
        <div className="custom-scrollbar min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t(accion === "confirmar" ? "confirmarAyuda" : "cancelarAyuda")}
          </p>
          {accion === "confirmar" && (
            <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
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
              ref={listaFallos}
              role="alert"
              tabIndex={-1}
              className="space-y-2 rounded-xl bg-error-50 p-4 text-sm text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 dark:bg-error-500/10 dark:text-error-400"
            >
              {fallos.map((fallo, indice) => (
                <li key={indice}>{fallo}</li>
              ))}
            </ul>
          )}
          {esRevision && (
            <RevisionPreparacion documento={documento} mostrarResumen={false} />
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
          <Button
            variant="outline"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={ocupado}
            onClick={alCerrar}
          >
            {t(esRevision ? "volverTrabajo" : "volver")}
          </Button>
          {conflicto ? (
            <Button onClick={alRecargar}>{t("recargar")}</Button>
          ) : (
            <Button
              className="min-h-11 flex-1 sm:flex-none"
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
