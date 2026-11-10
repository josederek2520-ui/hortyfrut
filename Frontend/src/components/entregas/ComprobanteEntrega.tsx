"use client";
import { useTranslations } from "next-intl";
import { Paperclip, Download, X } from "lucide-react";
import { panelEntrega } from "./tipos";

export default function ComprobanteEntrega({
  ruta,
  existe,
  archivo,
  soloLectura,
  bloqueado,
  alCambiar,
  alError,
}: {
  ruta: string;
  existe: boolean;
  archivo: File | null;
  soloLectura: boolean;
  bloqueado: boolean;
  alCambiar: (archivo: File | null) => void;
  alError: (mensaje: string) => void;
}) {
  const t = useTranslations("entregas");
  return (
    <div className={panelEntrega + " p-5"}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="size-4" aria-hidden="true" />
        {t("comprobante")}
      </h2>
      {!soloLectura && (
        <label
          className={
            "mt-3 inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-4 text-sm font-medium focus-within:ring-2 focus-within:ring-brand-500 dark:border-gray-700 " +
            (bloqueado ? "cursor-not-allowed opacity-60" : "cursor-pointer")
          }
        >
          {t(existe ? "reemplazarComprobante" : "adjuntarComprobante")}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={bloqueado}
            onChange={(evento) => {
              const elegido = evento.target.files?.[0] ?? null;
              if (!elegido) return;
              if (elegido.size > 8 * 1024 * 1024) {
                alError(t("archivoGrande"));
                evento.target.value = "";
                return;
              }
              if (
                ![
                  "image/jpeg",
                  "image/png",
                  "image/webp",
                  "application/pdf",
                ].includes(elegido.type)
              ) {
                alError(t("archivoTipo"));
                evento.target.value = "";
                return;
              }
              alCambiar(elegido);
              evento.target.value = "";
            }}
          />
        </label>
      )}
      {!soloLectura && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t("ayudaComprobante")}
        </p>
      )}
      {archivo && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
          <div className="min-w-0">
            <p className="truncate">{archivo.name}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("archivoPendienteGuardar")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("quitarArchivo")}
            disabled={bloqueado}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-error-700 focus-visible:outline-2 focus-visible:outline-error-500 dark:text-error-300"
            onClick={() => alCambiar(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {existe ? (
        <a
          href={"/api/v1/" + ruta + "comprobante/"}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
        >
          <Download className="size-4" aria-hidden="true" />
          {t("verComprobante")}
        </a>
      ) : (
        !archivo && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {t("sinComprobante")}
          </p>
        )
      )}
    </div>
  );
}
