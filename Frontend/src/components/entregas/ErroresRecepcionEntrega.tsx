"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import Button from "@/components/ui/button/Button";
import type { ProductoEntrega } from "./tipos";

export default function ErroresRecepcionEntrega({
  fallo,
  errores,
  productos,
  incierto,
  ocupado,
  alElegir,
  alReintentar,
}: {
  fallo: string;
  errores: Record<string, string[]>;
  productos: ProductoEntrega[];
  incierto: boolean;
  ocupado: boolean;
  alElegir: (clave: string) => void;
  alReintentar: () => void;
}) {
  const t = useTranslations("entregas");
  if (!fallo && !Object.keys(errores).length) return null;
  const nombres: Record<string, string> = {
    fecha_recepcion: "fechaRecepcion",
    recibido_por: "recibidoPor",
    cajas_recibidas: "cajasRecibidas",
    unidades_recibidas: "unidadesRecibidas",
    peso_recibido_kg: "pesoRecibido",
    cajas_rechazadas: "cajasRechazadas",
    unidades_rechazadas: "unidadesRechazadas",
    peso_rechazado_kg: "pesoRechazado",
    motivo_rechazo: "motivoRechazo",
  };
  function etiqueta(clave: string) {
    if (nombres[clave]) return t(nombres[clave]);
    const coincidencia = /^(\d+)_(.+)$/.exec(clave),
      lote = /^lotes_(\d+)$/.exec(clave);
    const producto = productos.find(
      (fila) => fila.producto === Number(coincidencia?.[1] ?? lote?.[1]),
    );
    return producto
      ? producto.nombre +
          " · " +
          t(lote ? "lotes" : (nombres[coincidencia![2]] ?? "producto"))
      : t("productosEntrega");
  }
  return (
    <div
      role="alert"
      className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800 dark:border-error-800 dark:bg-error-950/30 dark:text-error-200"
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertCircle aria-hidden="true" className="size-5 shrink-0" />
        {t(fallo || "revisarErrores")}
      </p>
      {!!Object.keys(errores).length && (
        <ul className="mt-2 space-y-1">
          {Object.entries(errores).map(([clave, mensajes]) => (
            <li key={clave}>
              <button
                type="button"
                onClick={() => alElegir(clave)}
                className="min-h-11 rounded-lg px-2 py-2 text-start underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-error-700 dark:focus-visible:outline-error-300"
              >
                <span className="font-medium">{etiqueta(clave)}: </span>
                {mensajes
                  .map((mensaje) =>
                    t.has("errores." + mensaje)
                      ? t("errores." + mensaje)
                      : mensaje,
                  )
                  .join(" ")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {incierto && (
        <Button
          className="mt-3"
          variant="outline"
          disabled={ocupado}
          onClick={alReintentar}
        >
          {t("reintentar")}
        </Button>
      )}
    </div>
  );
}
