"use client";
import { useTranslations } from "next-intl";
import { LoaderCircle, Save } from "lucide-react";
import Button from "@/components/ui/button/Button";
import {
  panelDevolucion,
  type Devolucion,
  type PermisosDevoluciones,
} from "./tipos";

export default function AccionesDevolucion({
  documento,
  permisos,
  ocupado,
  incierto,
  modificado,
  editarRecepcion,
  editarRevision,
  alVolver,
  alGuardar,
  alRecibir,
  alRevisar,
  alCancelar,
}: {
  documento: Devolucion | null;
  permisos: PermisosDevoluciones;
  ocupado: boolean;
  incierto: boolean;
  modificado: boolean;
  editarRecepcion: boolean;
  editarRevision: boolean;
  alVolver: () => void;
  alGuardar: () => void;
  alRecibir: () => void;
  alRevisar: () => void;
  alCancelar: () => void;
}) {
  const t = useTranslations("devoluciones");
  const estado = documento?.estado ?? "borrador";
  return (
    <footer
      className={
        panelDevolucion +
        " sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 p-4"
      }
    >
      <p
        role="status"
        className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      >
        {ocupado && (
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {t(
          ocupado
            ? "procesando"
            : incierto
              ? "resultadoIncierto"
              : modificado
                ? "sinGuardar"
                : estado === "recibida"
                  ? "pendienteCalidad"
                  : estado === "revisada"
                    ? "soloConsulta"
                    : estado === "cancelada"
                      ? "borradorCancelado"
                      : documento
                        ? "borradorGuardado"
                        : "sinRegistrar",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={ocupado} onClick={alVolver}>
          {t("salir")}
        </Button>
        {documento && estado === "borrador" && permisos.cancelar && (
          <Button
            variant="outline"
            disabled={ocupado || incierto}
            onClick={alCancelar}
          >
            {t("cancelarBorrador")}
          </Button>
        )}
        {(editarRecepcion || editarRevision) && (
          <Button
            variant="outline"
            disabled={ocupado || incierto}
            startIcon={<Save className="size-4" />}
            onClick={alGuardar}
          >
            {t(editarRevision ? "guardarRevision" : "guardarBorrador")}
          </Button>
        )}
        {estado === "borrador" && permisos.recibir && (
          <Button
            disabled={
              ocupado ||
              incierto ||
              (!documento && !permisos.crear) ||
              (modificado && !editarRecepcion)
            }
            onClick={alRecibir}
          >
            {t("confirmarRecepcion")}
          </Button>
        )}
        {estado === "recibida" && permisos.revisar && (
          <Button disabled={ocupado || incierto} onClick={alRevisar}>
            {t("confirmarRevision")}
          </Button>
        )}
      </div>
    </footer>
  );
}
