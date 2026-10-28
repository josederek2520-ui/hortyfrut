"use client";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

export default function ConfirmarCambiosRecepcion({
  tipo,
  ocupado,
  alCerrar,
  alConfirmar,
}: {
  tipo: "origen" | "salir" | "recargar";
  ocupado: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  const t = useTranslations("recepciones");
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      className="max-w-lg"
      labelledBy="cambios-recepcion"
      closeLabel={t("cerrar")}
    >
      <div className="space-y-5 p-6 sm:p-8">
        <h2
          id="cambios-recepcion"
          className="pe-7 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t(tipo === "origen" ? "cambiarOrigen" : "cambiosSinGuardar")}
        </h2>
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(
            tipo === "origen"
              ? "cambiarOrigenAyuda"
              : tipo === "salir"
                ? "descartarSalidaAyuda"
                : "descartarRecargaAyuda",
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
            {t("seguirAnotando")}
          </Button>
          <Button size="sm" disabled={ocupado} onClick={alConfirmar}>
            {t(
              ocupado
                ? "guardando"
                : tipo === "origen"
                  ? "cambiarOrigen"
                  : tipo === "salir"
                    ? "descartarSalir"
                    : "recargar",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
