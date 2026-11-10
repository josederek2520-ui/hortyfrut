"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import Button from "@/components/ui/button/Button";
import type { LineaEditableDevolucion } from "./tipos";

export default function ErroresDevolucion({
  fallo,
  errores,
  lineas,
  incierto,
  ocupado,
  alElegir,
  alReintentar,
}: {
  fallo: string;
  errores: Record<string, string[]>;
  lineas: Record<number, LineaEditableDevolucion>;
  incierto: boolean;
  ocupado: boolean;
  alElegir: (clave: string) => void;
  alReintentar: () => void;
}) {
  const t = useTranslations("devoluciones");
  if (!fallo && !Object.keys(errores).length) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800 dark:border-error-800 dark:bg-error-950/30 dark:text-error-200"
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
        {t(fallo || "revisarErrores")}
      </p>
      <ul className="mt-2 space-y-1">
        {Object.entries(errores).map(([clave, mensajes]) => {
          const aporte = /^(\d+)_/.exec(clave);
          const etiqueta = aporte
            ? lineas[Number(aporte[1])]?.producto_nombre || t("aporte")
            : t.has("campos." + clave)
              ? t("campos." + clave)
              : t("datosRetorno");
          return (
            <li key={clave}>
              <button
                type="button"
                onClick={() => alElegir(clave)}
                className="min-h-11 rounded-lg px-2 py-2 text-start underline focus-visible:outline-2 focus-visible:outline-error-700 dark:focus-visible:outline-error-300"
              >
                <span className="font-semibold">{etiqueta}: </span>
                {mensajes
                  .map((mensaje) =>
                    t.has("errores." + mensaje)
                      ? t("errores." + mensaje)
                      : mensaje,
                  )
                  .join(" ")}
              </button>
            </li>
          );
        })}
      </ul>
      {incierto && (
        <Button
          className="mt-3"
          disabled={ocupado}
          variant="outline"
          onClick={alReintentar}
        >
          {t("comprobarOperacion")}
        </Button>
      )}
    </div>
  );
}
