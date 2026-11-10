"use client";
import { CheckCircle2, Clock3, FilePenLine, SearchCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HojaEntrega } from "./tipos";

export default function EstadoEntrega({
  estado,
}: {
  estado: HojaEntrega["estado"];
}) {
  const t = useTranslations("entregas");
  const estilos = {
    pendiente:
      "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
    borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    revision:
      "bg-blue-light-50 text-blue-light-800 dark:bg-blue-light-950/50 dark:text-blue-light-200",
    confirmada:
      "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200",
  };
  const Icono = {
    pendiente: Clock3,
    borrador: FilePenLine,
    revision: SearchCheck,
    confirmada: CheckCircle2,
  }[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${estilos[estado]}`}
    >
      <Icono className="size-3.5 shrink-0" aria-hidden="true" />
      {t(`estados.${estado}`)}
    </span>
  );
}
