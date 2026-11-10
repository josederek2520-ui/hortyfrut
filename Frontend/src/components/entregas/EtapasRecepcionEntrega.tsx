"use client";
import { useTranslations } from "next-intl";
import {
  ClipboardPenLine as IconoRegistro,
  SearchCheck as IconoRevision,
  CircleCheck as IconoConfirmada,
} from "lucide-react";
import type { HojaEntrega } from "./tipos";

export default function EtapasRecepcionEntrega({
  estado,
  oficina,
}: {
  estado: HojaEntrega["estado"];
  oficina: boolean;
}) {
  const t = useTranslations("entregas");
  const activa = estado === "confirmada" ? 2 : estado === "revision" ? 1 : 0;
  const etapas = [
    { titulo: "etapaSucursal", icono: IconoRegistro },
    { titulo: "etapaOficina", icono: IconoRevision },
    { titulo: "etapaConfirmada", icono: IconoConfirmada },
  ];
  return (
    <div className="space-y-3">
      <ol aria-label={t("flujoRecepcion")} className="grid grid-cols-3 gap-2">
        {etapas.map(({ titulo, icono: Icono }, indice) => (
          <li
            key={titulo}
            aria-current={indice === activa ? "step" : undefined}
            className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-xs sm:text-sm ${indice === activa ? "border-brand-200 bg-brand-50 font-semibold text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200" : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}
          >
            <Icono
              className="hidden size-4 shrink-0 sm:block"
              aria-hidden="true"
            />
            <span>{t(titulo)}</span>
          </li>
        ))}
      </ol>
      {estado !== "confirmada" && (
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t(
            estado === "revision"
              ? oficina
                ? "ayudaRevisionOficina"
                : "esperandoOficina"
              : "ayudaRegistroSucursal",
          )}
        </p>
      )}
    </div>
  );
}
