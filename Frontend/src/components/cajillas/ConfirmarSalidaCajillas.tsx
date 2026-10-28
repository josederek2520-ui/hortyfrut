"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

export default function ConfirmarSalidaCajillas({
  alCerrar,
  alSalir,
}: {
  alCerrar: () => void;
  alSalir: () => void;
}) {
  const t = useTranslations("cajillas");
  const identificador = useId();
  return (
    <Modal
      isOpen
      onClose={alCerrar}
      className="max-w-lg"
      labelledBy={identificador}
      closeLabel={t("cerrar")}
    >
      <div className="space-y-5 p-6">
        <h2
          id={identificador}
          className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t("descartarTitulo")}
        </h2>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t("descartarAyuda")}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={alCerrar}>
            {t("seguirEditando")}
          </Button>
          <Button variant="danger" onClick={alSalir}>
            {t("descartar")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
