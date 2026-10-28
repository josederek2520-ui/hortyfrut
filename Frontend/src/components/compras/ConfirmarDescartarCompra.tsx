"use client";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

export default function ConfirmarDescartarCompra({
  recargar,
  alCerrar,
  alConfirmar,
}: {
  recargar: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  const t = useTranslations("compras");
  return (
    <Modal
      isOpen
      onClose={alCerrar}
      className="max-w-md"
      labelledBy="titulo-descartar-compra"
      closeLabel={t("cerrar")}
    >
      <div className="p-6 sm:p-8">
        <h2
          id="titulo-descartar-compra"
          className="pe-6 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t("cambiosSinGuardar")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(recargar ? "confirmarRecarga" : "confirmarSalida")}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            data-foco-inicial
            size="sm"
            variant="outline"
            onClick={alCerrar}
          >
            {t("seguirEditando")}
          </Button>
          <Button size="sm" onClick={alConfirmar}>
            {t(recargar ? "recargar" : "descartarSalir")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
