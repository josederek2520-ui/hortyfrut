"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { IconoPedidos } from "@/icons";
import Button from "@/components/ui/button/Button";
import SelectorPedido from "./SelectorPedido";
import { clasePanel, type OpcionPedido } from "./tipos";

export default function ElegirSucursalPedido({
  haySucursales,
  gestionGlobal,
  alElegir,
  alVolver,
  alError,
}: {
  haySucursales: boolean;
  gestionGlobal: boolean;
  alElegir: (sucursal: OpcionPedido) => void;
  alVolver: () => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("pedidos");
  const [sucursal, establecerSucursal] = useState<OpcionPedido | null>(null);
  return (
    <section className={`${clasePanel} mx-auto max-w-2xl space-y-6 p-6 sm:p-8`}>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <IconoPedidos className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t(haySucursales ? "elegirDestino" : "sinDestino")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t(
              haySucursales
                ? "elegirDestinoAyuda"
                : gestionGlobal
                  ? "sinSucursalesActivas"
                  : "sinSucursalAsignada",
            )}
          </p>
        </div>
      </div>
      {haySucursales && (
        <SelectorPedido
          ruta="pedidos/sucursales/"
          etiqueta={t("sucursal")}
          valor={sucursal}
          alCambiar={establecerSucursal}
          alError={alError}
        />
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={alVolver}>
          {t("volverListado")}
        </Button>
        {haySucursales && (
          <Button
            disabled={!sucursal}
            onClick={() => sucursal && alElegir(sucursal)}
          >
            {t("abrirHoja")}
          </Button>
        )}
      </div>
    </section>
  );
}
