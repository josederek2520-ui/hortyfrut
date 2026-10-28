"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { IconoEstado } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import {
  CONFIGURACION_CATALOGOS,
  type TipoListado,
  type RegistroCatalogo,
} from "./tipos";

export default function ConfirmarEstadoCatalogo({
  tipo,
  registro,
  alCerrar,
  alGuardar,
  alError,
  alRecargar,
}: {
  tipo: TipoListado;
  registro: RegistroCatalogo;
  alCerrar: () => void;
  alGuardar: () => void;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("catalogos");
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const confirmar = async () => {
    establecerGuardando(true);
    establecerFallo("");
    establecerConflicto(false);
    try {
      await api(
        `${CONFIGURACION_CATALOGOS[tipo].ruta}/${registro.id}/estado/`,
        {
          method: "POST",
          body: JSON.stringify({
            activo: !registro.activo,
            version: registro.version,
          }),
        },
      );
      alGuardar();
    } catch (error) {
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        error instanceof ErrorApi &&
          error.status === 400 &&
          Object.keys(error.errors).length
          ? Object.values(error.errors).flat().join(" ")
          : t(
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
      labelledBy="titulo-estado-catalogo"
      closeLabel={t("cerrar")}
    >
      <div className="p-6 sm:p-8">
        <span
          className={`mb-5 flex size-12 items-center justify-center rounded-2xl ${registro.activo ? "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400" : "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"}`}
        >
          <IconoEstado className="size-6" />
        </span>
        <h2
          id="titulo-estado-catalogo"
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t(
            registro.activo ? "confirmarDesactivacion" : "confirmarActivacion",
          )}
        </h2>
        <p className="mt-3 text-sm leading-6 break-words text-gray-500 dark:text-gray-400">
          {t(registro.activo ? "ayudaDesactivar" : "ayudaActivar", {
            nombre: registro.nombre,
          })}
        </p>
        {fallo && (
          <div role="alert" className="mt-4 text-sm text-error-500">
            <p>{fallo}</p>
            {conflicto && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={alRecargar}
              >
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
            disabled={guardando}
            onClick={() => void confirmar()}
          >
            {t(
              guardando
                ? "guardando"
                : registro.activo
                  ? "desactivar"
                  : "activar",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
