"use client";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, X } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { validarArchivoCobro } from "./calculosCobro";

export default function AdjuntoCobro({
  archivo,
  bloqueado,
  alCambiar,
}: {
  archivo: File | null;
  bloqueado: boolean;
  alCambiar: (archivo: File | null) => void;
}) {
  const t = useTranslations("cobros"),
    identificador = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [fallo, establecerFallo] = useState(false);
  return (
    <div>
      <label htmlFor={identificador} className="mb-2 block text-sm font-medium">
        {t("comprobante")}
      </label>
      <input
        id={identificador}
        ref={entrada}
        type="file"
        className="sr-only"
        disabled={bloqueado}
        accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
        aria-describedby={identificador + "-ayuda"}
        aria-invalid={fallo}
        onChange={(evento) => {
          const elegido = evento.target.files?.[0];
          evento.target.value = "";
          if (!elegido || bloqueado) return;
          if (!validarArchivoCobro(elegido)) {
            establecerFallo(true);
            return;
          }
          establecerFallo(false);
          alCambiar(elegido);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={bloqueado}
        className="w-full"
        startIcon={<Paperclip className="size-4" />}
        onClick={() => entrada.current?.click()}
      >
        {t(archivo ? "cambiarComprobante" : "adjuntarComprobante")}
      </Button>
      <p
        id={identificador + "-ayuda"}
        className="mt-2 text-xs text-gray-500 dark:text-gray-400"
      >
        {t("comprobanteAyuda")}
      </p>
      {archivo && (
        <div className="mt-1 flex items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-300"
            title={archivo.name}
          >
            {archivo.name}
          </p>
          <button
            type="button"
            disabled={bloqueado}
            aria-label={t("quitarComprobante")}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
            onClick={() => {
              establecerFallo(false);
              alCambiar(null);
            }}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {fallo && (
        <p
          role="alert"
          className="mt-1 text-xs text-error-600 dark:text-error-300"
        >
          {t("errores.comprobanteValido")}
        </p>
      )}
    </div>
  );
}
