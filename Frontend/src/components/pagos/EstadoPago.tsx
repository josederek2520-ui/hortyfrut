import { useTranslations } from "next-intl";
import { Clock3, CheckCircle2, CircleAlert } from "lucide-react";
import type { EstadoPago as TipoEstado } from "./tipos";
export default function EstadoPago({ estado }: { estado: TipoEstado }) {
  const t = useTranslations("pagos");
  const Icono = {
    por_verificar: Clock3,
    confirmado: CheckCircle2,
    observado: CircleAlert,
  }[estado];
  const estilos = {
    por_verificar:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    confirmado:
      "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300",
    observado:
      "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  }[estado];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        estilos
      }
    >
      <Icono className="size-3.5" aria-hidden="true" />
      {t("estados." + estado)}
    </span>
  );
}
