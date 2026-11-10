"use client";
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CheckCheck as IconoConfirmar } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

export default function ConfirmacionLogistica({
  titulo,
  descripcion,
  accion,
  ocupado,
  error,
  children,
  deshabilitado = false,
  permitirReintento = false,
  alCerrar,
  alConfirmar,
}: {
  titulo: string;
  descripcion: string;
  accion: string;
  ocupado?: boolean;
  error?: string;
  children?: ReactNode;
  deshabilitado?: boolean;
  permitirReintento?: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  const t = useTranslations("logistica");
  const identificador = useId();
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      className="max-w-lg"
      labelledBy={identificador}
      closeLabel={t("cerrar")}
    >
      <div className="p-6 sm:p-8">
        <span className="mb-5 inline-flex rounded-2xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <IconoConfirmar className="size-6" />
        </span>
        <h2
          id={identificador}
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {titulo}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {descripcion}
        </p>
        {children}
        {error && (
          <p
            role="alert"
            className="mt-4 text-sm text-error-600 dark:text-error-400"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={alCerrar}
            disabled={ocupado}
          >
            {t("volver")}
          </Button>
          <Button
            size="sm"
            onClick={alConfirmar}
            disabled={
              ocupado || (!!error && !permitirReintento) || deshabilitado
            }
          >
            {t(ocupado ? "guardando" : "confirmar")} · {accion}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
