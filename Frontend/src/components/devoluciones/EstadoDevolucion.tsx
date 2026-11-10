"use client";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ClipboardClock,
  FilePenLine,
  CircleX,
} from "lucide-react";
import type { EstadoDevolucion as TipoEstado } from "./tipos";

export default function EstadoDevolucion({ estado }: { estado: TipoEstado }) {
  const t = useTranslations("devoluciones");
  const estilos = {
    borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    recibida:
      "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
    revisada:
      "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200",
    cancelada: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const Icono = {
    borrador: FilePenLine,
    recibida: ClipboardClock,
    revisada: CheckCircle2,
    cancelada: CircleX,
  }[estado];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium " +
        estilos[estado]
      }
    >
      <Icono aria-hidden="true" className="size-3.5" />
      {t("estados." + estado)}
    </span>
  );
}
