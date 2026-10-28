"use client";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { CircleX as IconoCancelar } from "lucide-react";
import type { Pedido } from "./tipos";

export default function CancelarPedido({
  pedido,
  alCerrar,
  alGuardar,
  alError,
  alRecargar,
}: {
  pedido: Pick<Pedido, "id" | "codigo" | "version">;
  alCerrar: () => void;
  alGuardar: () => void;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("pedidos");
  const [error, establecerError] = useState(""),
    [ocupado, establecerOcupado] = useState(false),
    [conflicto, establecerConflicto] = useState(false);
  const enviando = useRef(false);
  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando.current || conflicto) return;
    enviando.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      await api(`pedidos/${pedido.id}/cancelar/`, {
        method: "POST",
        body: JSON.stringify({
          version: pedido.version,
        }),
      });
      alGuardar();
    } catch (fallo) {
      establecerConflicto(
        fallo instanceof ErrorApi && [403, 404, 409].includes(fallo.status),
      );
      establecerError(
        fallo instanceof ErrorApi && fallo.status === 409
          ? t("conflicto")
          : fallo instanceof ErrorApi && fallo.status === 403
            ? t("sinPermiso")
            : t("errorCarga"),
      );
      alError(fallo);
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
      labelledBy="titulo-cancelar-pedido"
      closeLabel={t("cerrar")}
      className="max-w-lg"
    >
      <form noValidate onSubmit={enviar} aria-busy={ocupado} className="p-6">
        <span className="mb-4 inline-flex rounded-2xl bg-error-50 p-3 text-error-600 dark:bg-error-500/10 dark:text-error-400">
          <IconoCancelar className="size-6" aria-hidden="true" />
        </span>
        <h2
          id="titulo-cancelar-pedido"
          className="pe-10 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t("cancelarPregunta", { codigo: pedido.codigo })}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t("cancelarAyuda")}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-error-500">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            data-foco-inicial
            disabled={ocupado}
            onClick={alCerrar}
          >
            {t("volver")}
          </Button>
          {conflicto ? (
            <Button variant="outline" size="sm" onClick={alRecargar}>
              {t("actualizarListado")}
            </Button>
          ) : (
            <Button variant="danger" size="sm" type="submit" disabled={ocupado}>
              {t(ocupado ? "cancelando" : "confirmarCancelacion")}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
