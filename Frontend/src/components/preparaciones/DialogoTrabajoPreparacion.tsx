"use client";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

export default function DialogoTrabajoPreparacion({
  tipo,
  ocupado,
  alCerrar,
  alConfirmar,
}: {
  tipo: "volver" | "recargar" | "almacen" | "lote";
  ocupado: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  const t = useTranslations("preparaciones");
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      className="max-w-lg"
      labelledBy="dialogo-trabajo-preparacion"
      closeLabel={t("cerrar")}
    >
      <div className="space-y-5 p-6 sm:p-8">
        <h2
          id="dialogo-trabajo-preparacion"
          className="pe-7 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t(
            tipo === "almacen"
              ? "cambiarAlmacenTrabajo"
              : tipo === "lote"
                ? "quitarLoteTrabajo"
                : "cambiosSinGuardar",
          )}
        </h2>
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(
            tipo === "almacen"
              ? "cambiarAlmacenTrabajoAyuda"
              : tipo === "lote"
                ? "quitarLoteTrabajoAyuda"
                : tipo === "recargar"
                  ? "recargarTrabajoAyuda"
                  : "salirTrabajoAyuda",
          )}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            size="sm"
            variant="outline"
            data-foco-inicial
            disabled={ocupado}
            onClick={alCerrar}
          >
            {t("seguirPreparandoTrabajo")}
          </Button>
          <Button size="sm" disabled={ocupado} onClick={alConfirmar}>
            {t(
              ocupado
                ? "guardando"
                : tipo === "almacen"
                  ? "cambiarAlmacenTrabajo"
                  : tipo === "lote"
                    ? "quitarLoteTrabajo"
                    : tipo === "recargar"
                      ? "recargar"
                      : "descartarSalir",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
