"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CircleCheck as IconoRegistrar,
  Ban as IconoCancelar,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Compra } from "./tipos";
import ResumenRegistroCompra from "./ResumenRegistroCompra";

export default function ConfirmarAccionCompra({
  compra,
  accion,
  alCerrar,
  alGuardar,
  alError,
  alRecargar,
  mostrarRevision = false,
}: {
  compra: Compra;
  accion: "registrar" | "cancelar";
  alCerrar: () => void;
  alGuardar: (compra: Compra) => void;
  alError: (error: unknown) => void;
  alRecargar: () => void;
  mostrarRevision?: boolean;
}) {
  const t = useTranslations("compras");
  const [motivo, establecerMotivo] = useState("");
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState<string[]>([]);
  const [conflicto, establecerConflicto] = useState(false);
  const enviando = useRef(false);
  const confirmar = async () => {
    if (
      enviando.current ||
      guardando ||
      conflicto ||
      (accion === "cancelar" && !motivo.trim())
    )
      return;
    enviando.current = true;
    establecerGuardando(true);
    establecerFallo([]);
    try {
      const respuesta = await api<Compra>(`compras/${compra.id}/${accion}/`, {
        method: "POST",
        body: JSON.stringify({
          version: compra.version,
          clave_operacion: claveOperacion,
          ...(accion === "cancelar" ? { motivo: motivo.trim() } : {}),
        }),
      });
      alGuardar(respuesta);
    } catch (error) {
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        error instanceof ErrorApi && Object.keys(error.errors).length
          ? Object.entries(error.errors).map(([campo, mensajes]) => {
              const linea = /^detalle_([0-9]+)_/.exec(campo);
              return `${linea ? `${t("lineaNumero", { numero: Number(linea[1]) + 1 })}: ` : ""}${mensajes.join(" ")}`;
            })
          : [
              t(
                error instanceof ErrorApi && error.status === 409
                  ? "conflicto"
                  : "errorGuardar",
              ),
            ],
      );
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  const Icono = accion === "registrar" ? IconoRegistrar : IconoCancelar;
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!guardando) alCerrar();
      }}
      className={mostrarRevision ? "max-w-5xl" : "max-w-lg"}
      labelledBy="titulo-accion-compra"
      closeLabel={t("cerrar")}
    >
      <div className="custom-scrollbar max-h-[90dvh] overflow-y-auto p-6 sm:p-8">
        <span
          className={`mb-5 flex size-12 items-center justify-center rounded-2xl ${accion === "registrar" ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" : "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400"}`}
        >
          <Icono className="size-6" aria-hidden="true" />
        </span>
        <h2
          id="titulo-accion-compra"
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t(
            accion === "registrar"
              ? mostrarRevision
                ? "revisarRegistro"
                : "confirmarRegistro"
              : "confirmarCancelacion",
          )}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(accion === "registrar" ? "registroAyuda" : "cancelacionAyuda", {
            codigo: compra.codigo,
          })}
        </p>
        {mostrarRevision && (
          <ResumenRegistroCompra compra={compra} ocupado={guardando} />
        )}
        {accion === "cancelar" && (
          <div className="mt-5">
            <CampoDirectorio
              id="motivo-cancelacion-compra"
              name="motivo"
              etiqueta={t("motivoCancelacion")}
              required
              maxLength={500}
              value={motivo}
              disabled={guardando}
              onChange={(evento) => establecerMotivo(evento.target.value)}
            />
          </div>
        )}
        {!!fallo.length && (
          <div
            role="alert"
            className="mt-4 space-y-2 text-sm text-error-500 dark:text-error-400"
          >
            {fallo.map((mensaje, indice) => (
              <p key={indice}>{mensaje}</p>
            ))}
            {conflicto && (
              <Button size="sm" variant="outline" onClick={alRecargar}>
                {t("recargar")}
              </Button>
            )}
          </div>
        )}
        <div
          className={`mt-7 flex flex-wrap justify-end gap-3 ${mostrarRevision ? "sticky -bottom-6 border-t border-gray-200 bg-white py-4 sm:-bottom-8 dark:border-gray-800 dark:bg-gray-900" : ""}`}
        >
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={alCerrar}
          >
            {t(mostrarRevision ? "volverHoja" : "volver")}
          </Button>
          <Button
            size="sm"
            disabled={
              guardando ||
              conflicto ||
              (accion === "cancelar" && !motivo.trim())
            }
            onClick={() => void confirmar()}
          >
            {t(
              guardando
                ? "guardando"
                : accion === "registrar"
                  ? "registrarCompra"
                  : "cancelarCompra",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
