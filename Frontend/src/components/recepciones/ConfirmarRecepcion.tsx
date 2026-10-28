"use client";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { api, ApiError } from "@/lib/api";
import type { Recepcion } from "./tipos";
import ResumenIngresoRecepcion from "./ResumenIngresoRecepcion";

export default function ConfirmarRecepcion({
  recepcion,
  accion,
  alCerrar,
  alGuardar,
  alError,
  alRecargar,
  mostrarRevision = false,
}: {
  recepcion: Recepcion;
  accion: "confirmar" | "cancelar";
  alCerrar: () => void;
  alGuardar: (recepcion: Recepcion) => void;
  alError: (error: unknown) => void;
  alRecargar: () => void;
  mostrarRevision?: boolean;
}) {
  const t = useTranslations("recepciones");
  const identificador = useId();
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [motivo, establecerMotivo] = useState("");
  const [ocupado, establecerOcupado] = useState(false);
  const [fallos, establecerFallos] = useState<string[]>([]);
  const [conflicto, establecerConflicto] = useState(false);
  const enviando = useRef(false);
  const ejecutar = async () => {
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
        await api<Recepcion>(`recepciones/${recepcion.id}/${accion}/`, {
          method: "POST",
          body: JSON.stringify({
            version: recepcion.version,
            clave_operacion: claveOperacion,
            ...(accion === "cancelar" ? { motivo: motivo.trim() } : {}),
          }),
        }),
      );
    } catch (error) {
      establecerConflicto(error instanceof ApiError && error.status === 409);
      establecerFallos(
        error instanceof ApiError && Object.keys(error.errors).length
          ? Object.entries(error.errors).map(([campo, mensajes]) => {
              const linea = /^detalle_(\d+)_/.exec(campo);
              return `${linea ? `${t("lineaNumero", { numero: Number(linea[1]) + 1 })}: ` : ""}${mensajes.join(" ")}`;
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
      className={mostrarRevision ? "max-w-4xl" : "max-w-lg"}
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
                ? "revisarIngreso"
                : "confirmarIngreso"
              : "cancelarBorrador",
          )}
        </h2>
        <p className="font-medium text-brand-700 dark:text-brand-300">
          {recepcion.codigo} · {recepcion.almacen_nombre}
        </p>
        {mostrarRevision && (
          <ResumenIngresoRecepcion recepcion={recepcion} ocupado={ocupado} />
        )}
        {!mostrarRevision && (
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t(accion === "confirmar" ? "confirmarAyuda" : "cancelarAyuda", {
              cantidad: recepcion.detalles.length,
            })}
          </p>
        )}
        {accion === "cancelar" && (
          <CampoDirectorio
            id={`${identificador}-motivo`}
            etiqueta={t("motivo")}
            value={motivo}
            maxLength={500}
            required
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
        <div
          className={`flex flex-wrap justify-end gap-3 ${mostrarRevision ? "sticky -bottom-6 border-t border-gray-200 bg-white py-4 sm:-bottom-8 dark:border-gray-800 dark:bg-gray-900" : ""}`}
        >
          <Button variant="outline" disabled={ocupado} onClick={alCerrar}>
            {t(mostrarRevision ? "volverHoja" : "volver")}
          </Button>
          {conflicto ? (
            <Button onClick={alRecargar}>{t("recargar")}</Button>
          ) : (
            <Button
              variant={accion === "cancelar" ? "danger" : "primary"}
              disabled={ocupado || (accion === "cancelar" && !motivo.trim())}
              onClick={ejecutar}
            >
              {t(
                ocupado
                  ? "guardando"
                  : accion === "confirmar"
                    ? "confirmarIngreso"
                    : "cancelarBorrador",
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
