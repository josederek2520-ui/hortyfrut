import { useTranslations } from "next-intl";
import { CheckCircle2, Clock3, FilePenLine, Ban, XCircle } from "lucide-react";
import type { EstadoPrecio as TipoEstado } from "./tipos";

export default function EstadoPrecio({ estado }: { estado: TipoEstado }) {
  const t = useTranslations("precios");
  const estilos = {
    borrador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    propuesta:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    aceptado:
      "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300",
    rechazado:
      "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300",
    cancelado: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const Icono = {
    borrador: FilePenLine,
    propuesta: Clock3,
    aceptado: CheckCircle2,
    rechazado: XCircle,
    cancelado: Ban,
  }[estado];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        estilos[estado]
      }
    >
      <Icono className="size-3.5" aria-hidden="true" />
      {t("estados." + estado)}
    </span>
  );
}
