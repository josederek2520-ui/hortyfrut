"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Power as IconoEstado } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Almacen } from "./tipos";

export default function ConfirmarEstadoAlmacen({
  almacen,
  alCerrar,
  alGuardar,
  alError,
  alRecargar,
}: {
  almacen: Almacen;
  alCerrar: () => void;
  alGuardar: () => void;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("almacenes");
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const confirmar = async () => {
    if (guardando || conflicto) return;
    establecerGuardando(true);
    try {
      await api(`almacenes/${almacen.id}/estado/`, {
        method: "POST",
        body: JSON.stringify({
          activo: !almacen.activo,
          version: almacen.version,
        }),
      });
      alGuardar();
    } catch (error) {
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : "errorGuardar",
        ),
      );
      alError(error);
    } finally {
      establecerGuardando(false);
    }
  };
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!guardando) alCerrar();
      }}
      className="max-w-md"
      labelledBy="titulo-estado-almacen"
      closeLabel={t("cerrar")}
    >
      <div className="p-6 sm:p-8">
        <span
          className={`mb-5 flex size-12 items-center justify-center rounded-2xl ${almacen.activo ? "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400" : "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"}`}
        >
          <IconoEstado className="size-6" aria-hidden="true" />
        </span>
        <h2
          id="titulo-estado-almacen"
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t(almacen.activo ? "confirmarDesactivacion" : "confirmarActivacion")}
        </h2>
        <p className="mt-3 text-sm leading-6 break-words text-gray-500 dark:text-gray-400">
          {t(almacen.activo ? "ayudaDesactivar" : "ayudaActivar", {
            nombre: almacen.nombre,
          })}
        </p>
        {fallo && (
          <div
            role="alert"
            className="mt-4 space-y-3 text-sm text-error-500 dark:text-error-400"
          >
            <p>{fallo}</p>
            {conflicto && (
              <Button size="sm" variant="outline" onClick={alRecargar}>
                {t("recargar")}
              </Button>
            )}
          </div>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={alCerrar}
          >
            {t("cancelar")}
          </Button>
          <Button
            size="sm"
            disabled={guardando || conflicto}
            onClick={() => void confirmar()}
          >
            {t(
              guardando
                ? "guardando"
                : almacen.activo
                  ? "desactivar"
                  : "activar",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
